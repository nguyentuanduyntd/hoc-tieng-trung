// Thư viện bài đọc (#/doc) + trình đọc/nghe (#/doc/<id>):
// pinyin <ruby>, dịch từng câu, tô màu từ theo mức thuộc, phát từng câu / cả bài, tốc độ 0.5–1.25x,
// lặp câu, shadowing (tạm dừng bằng độ dài câu, tùy chọn ghi âm), phụ đề 3 lớp bật/tắt độc lập.
// Phím: Space phát/dừng, ←/→ câu trước/sau, R lặp câu, P pinyin, T dịch.

import { checkAnswer } from "../lib/grading.ts";
import { SPEEDS, estimateSpeechMs, nextSentenceIndex, shadowPauseMs } from "../lib/readings.ts";
import { addWordCards, localDate, wordStatuses, type WordStatus } from "../lib/srs.ts";
import { setProgress, state } from "../state.ts";
import type { Reading, ReadingsFile } from "../types.ts";
import { esc, zhWord } from "../ui/html.ts";
import { resourceHint } from "../ui/resourceHint.ts";
import { baseRate, speakAsync, stopSpeaking, ttsSupported, zhVoiceCount, type SpeakHandle } from "../ui/speech.ts";
import { recordOnce, recorderSupported } from "../ui/speechInput.ts";

// ---------- Dữ liệu ----------
let readingsPromise: Promise<ReadingsFile | null> | null = null;
export function loadReadings(): Promise<ReadingsFile | null> {
  readingsPromise ??= fetch(`${import.meta.env.BASE_URL}data/readings/hsk1.json`)
    .then((r) => (r.ok ? (r.json() as Promise<ReadingsFile>) : null))
    .catch(() => null);
  return readingsPromise;
}

// ---------- Cài đặt hiển thị (tiện ích riêng mỗi máy -> localStorage, bọc try/catch) ----------
interface ViewPrefs {
  hanzi: boolean;
  pinyin: boolean;
  vi: boolean;
  color: boolean;
  speed: number;
  shadow: boolean;
  record: boolean;
  loop: boolean;
}
const PREFS_KEY = "htt.reader.v1";
const defaults: ViewPrefs = { hanzi: true, pinyin: true, vi: false, color: true, speed: 1, shadow: false, record: false, loop: false };
function loadPrefs(): ViewPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const p = raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
    if (!SPEEDS.includes(p.speed)) p.speed = 1;
    return p;
  } catch {
    return { ...defaults };
  }
}
function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...prefs, loop: false }));
  } catch {
    /* bỏ qua */
  }
}
let prefs = loadPrefs();

// ---------- Thư viện ----------
export function readingListPage(): string {
  return `<div id="reading-list"><p class="muted">Đang tải bài đọc…</p></div>`;
}

export async function mountReadingList() {
  const file = await loadReadings();
  const el = document.getElementById("reading-list");
  if (!el) return;
  if (!file) return void (el.innerHTML = `<div class="notice">Không tải được bài đọc.</div>`);
  const results = state.progress.readingResults;
  el.innerHTML = `
    <h1>Bài đọc & nghe</h1>
    <p class="lead">Bài ngắn theo cấp HSK, chỉ dùng từ trong cấp. Bật/tắt pinyin và bản dịch, nghe từng câu, chỉnh tốc độ, luyện shadowing.</p>
    <h2>HSK 1</h2>
    <div class="grid">
      ${file.readings
        .map((r) => {
          const res = results[r.id];
          return `<a class="card reading-card" href="#/doc/${r.id}">
            <div class="reading-zh" lang="zh-CN">${esc(r.titleZh ?? "")}</div>
            <h3>${esc(r.title)}</h3>
            <div class="row">
              <span class="badge">${r.kind === "dialogue" ? "Hội thoại" : "Bài văn"}</span>
              <span class="badge">${r.stats.hanzi} chữ · ${r.sentences.length} câu</span>
              ${res ? `<span class="badge accent">✓ Đọc hiểu ${Math.round(res.score * 100)}%</span>` : ""}
            </div>
          </a>`;
        })
        .join("")}
    </div>`;
}

// ---------- Trình đọc ----------
interface Player {
  reading: Reading;
  index: number;
  playing: boolean;
  handle: SpeakHandle | null;
  stopRec: (() => void) | null;
  timer: number | undefined;
  /** Câu đang mở bản dịch riêng lẻ. */
  openVi: Set<number>;
  /** Bản ghi shadowing theo câu (blob URL cục bộ). */
  recordings: Map<number, string>;
  status: string;
  answers: Map<string, number>;
  submitted: boolean;
  /** Tăng mỗi lần dừng/phát lại để hủy vòng lặp cũ. */
  token: number;
}
let P: Player | null = null;

export function readerPage(): string {
  return `<div id="reader-root" class="reader"><p class="muted">Đang tải bài…</p></div>`;
}

export async function mountReader(id: string) {
  stop();
  const file = await loadReadings();
  const root = document.getElementById("reader-root");
  if (!root) return;
  const reading = file?.readings.find((r) => r.id === id);
  if (!reading || !state.vocab) {
    root.innerHTML = state.vocab
      ? `<div class="notice">Không tìm thấy bài đọc. <a href="#/doc">Về thư viện</a></div>`
      : `<p class="muted">Đang tải dữ liệu…</p>`;
    return;
  }
  P = {
    reading,
    index: 0,
    playing: false,
    handle: null,
    stopRec: null,
    timer: undefined,
    openVi: new Set(),
    recordings: new Map(),
    status: "",
    answers: new Map(),
    submitted: false,
    token: 0,
  };
  renderReader();
}

function statusClass(s: WordStatus | undefined): string {
  return s === "known" ? "w-known" : s === "learning" ? "w-learning" : "w-new";
}

function sentenceHtml(i: number, statuses: Map<string, WordStatus>): string {
  const r = P!.reading;
  const s = r.sentences[i];
  const zh = s.tokens
    .map((t, k) => {
      if (!t.wordId) return `<span class="punct-tok">${esc(t.text)}</span>`;
      const word = zhWord(t.text, t.wordId, prefs.color ? statusClass(statuses.get(t.wordId)) : "");
      return prefs.pinyin ? `<ruby>${word}<rt>${esc(s.tokenPinyin[k])}</rt></ruby>` : word;
    })
    .join("");
  const showVi = prefs.vi || P!.openVi.has(i);
  const speaker = s.speaker && r.speakers ? r.speakers[s.speaker] : "";
  const rec = P!.recordings.get(i);
  return `<div class="sent ${i === P!.index ? "current" : ""}" data-sent="${i}">
    ${speaker ? `<div class="speaker spk-${esc(s.speaker!)}">${esc(speaker)}</div>` : ""}
    <div class="sent-body">
      <div class="sent-zh ${prefs.hanzi ? "" : "hidden-zh"}" lang="zh-CN">${prefs.hanzi ? zh : `<span class="muted">(ẩn chữ Hán — nghe và đoán)</span>`}</div>
      ${!prefs.hanzi && prefs.pinyin ? `<div class="sent-py">${esc(s.pinyin)}</div>` : ""}
      ${showVi ? `<div class="sent-vi">${esc(s.vi)}</div>` : ""}
      ${rec ? `<audio class="rec" controls src="${rec}" aria-label="Bản ghi của bạn"></audio>` : ""}
    </div>
    <div class="sent-btns">
      <button class="btn icon-btn" data-play-one="${i}" aria-label="Nghe câu ${i + 1}" title="Nghe câu này">🔊</button>
      <button class="btn icon-btn ${showVi ? "on" : ""}" data-vi="${i}" aria-label="Bật/tắt dịch câu ${i + 1}" title="Dịch câu này">VI</button>
    </div>
  </div>`;
}

function toggle(name: keyof ViewPrefs, label: string, key?: string) {
  const on = !!prefs[name];
  return `<button class="btn toggle ${on ? "on" : ""}" data-toggle="${name}" aria-pressed="${on}">${label}${key ? ` <kbd>${key}</kbd>` : ""}</button>`;
}

function renderReader() {
  const root = document.getElementById("reader-root");
  if (!root || !P) return;
  const r = P.reading;
  const statuses = wordStatuses(state.progress.cards);
  const newWords = [...new Set(r.sentences.flatMap((s) => s.tokens.map((t) => t.wordId)).filter((x): x is string => !!x))].filter(
    (id) => !statuses.has(id),
  );
  root.innerHTML = `
    <div class="reader-head">
      <a class="btn icon-btn" href="#/doc" aria-label="Về thư viện">←</a>
      <div><h1><span lang="zh-CN">${esc(r.titleZh ?? "")}</span> · ${esc(r.title)}</h1>
      <p class="muted small">${r.kind === "dialogue" ? "Hội thoại" : "Bài văn"} · HSK ${r.hskLevel} · ${r.stats.hanzi} chữ</p></div>
    </div>
    <div class="reader-toolbar" role="toolbar" aria-label="Hiển thị">
      ${toggle("hanzi", "Hán tự")}${toggle("pinyin", "Pinyin", "P")}${toggle("vi", "Tiếng Việt", "T")}${toggle("color", "Tô màu từ")}
    </div>
    ${prefs.color ? `<p class="legend small"><span class="w-new">từ mới</span> <span class="w-learning">đang học</span> <span class="w-known">đã thuộc</span> — bấm vào từ để tra.</p>` : ""}
    <div class="sentences ${prefs.pinyin ? "with-ruby" : ""}">${r.sentences.map((_, i) => sentenceHtml(i, statuses)).join("")}</div>
    ${
      newWords.length
        ? `<p class="center"><button class="btn" data-add-new>+ Thêm ${newWords.length} từ chưa học trong bài vào ôn tập</button></p>`
        : ""
    }
    ${questionsHtml()}
    ${resourceHint(["reading", "listening"], "Đọc & nghe thêm (chỉ dẫn link, không nhúng video)")}
    <div class="player-bar" role="region" aria-label="Điều khiển nghe">
      <div class="row">
        <button class="btn icon-btn" data-prev aria-label="Câu trước (←)">⏮</button>
        <button class="btn primary play-btn" data-play aria-label="${P.playing ? "Dừng" : "Phát"} (Space)">${P.playing ? "⏸ Dừng" : "▶ Phát"}</button>
        <button class="btn icon-btn" data-next aria-label="Câu sau (→)">⏭</button>
        <label class="speed"><span class="speed-label">Tốc độ</span>
          <select data-speed aria-label="Tốc độ đọc">${SPEEDS.map((s) => `<option value="${s}" ${s === prefs.speed ? "selected" : ""}>${s}x</option>`).join("")}</select>
        </label>
        ${toggle("loop", "🔁 Lặp câu", "R")}
        ${toggle("shadow", "🗣 Shadowing")}
        ${prefs.shadow && recorderSupported() ? toggle("record", "⏺ Ghi âm") : ""}
      </div>
      <div class="player-status small" aria-live="polite">${esc(P.status || `Câu ${P.index + 1}/${r.sentences.length}`)}</div>
      ${ttsSupported() ? "" : `<div class="small bad-text">Trình duyệt không có giọng đọc tiếng Trung — không phát được âm.</div>`}
    </div>`;
}

function questionsHtml(): string {
  const r = P!.reading;
  const correct = r.questions.filter((q) => P!.answers.has(q.id) && checkAnswer(q, { type: "comprehension", value: P!.answers.get(q.id)! })).length;
  return `<section class="card questions">
    <h2>Đọc hiểu</h2>
    ${r.questions
      .map((q, qi) => {
        if (q.type !== "comprehension") return "";
        const picked = P!.answers.get(q.id);
        return `<fieldset class="question"><legend>${qi + 1}. ${esc(q.prompt.question)}</legend>
          <div class="options">${q.prompt.options
            .map((o, oi) => {
              const cls = P!.submitted ? (oi === q.answer ? "correct" : oi === picked ? "wrong" : "") : picked === oi ? "selected" : "";
              return `<button class="btn option ${cls}" data-q="${esc(q.id)}" data-a="${oi}" ${P!.submitted ? "disabled" : ""} aria-pressed="${picked === oi}">${esc(o)}</button>`;
            })
            .join("")}</div></fieldset>`;
      })
      .join("")}
    ${
      P!.submitted
        ? `<div class="feedback ${correct === r.questions.length ? "ok" : "bad"}">Đúng ${correct}/${r.questions.length}. ${
            correct === r.questions.length ? "Tuyệt vời! 🎉" : "Đọc lại câu liên quan (bật Tiếng Việt nếu cần) rồi thử lại."
          }</div><p class="center"><button class="btn" data-retry>Làm lại</button> <a class="btn primary" href="#/doc">Bài khác</a></p>`
        : `<p class="center"><button class="btn primary" data-submit ${P!.answers.size === r.questions.length ? "" : "disabled"}>Nộp bài</button></p>`
    }
  </section>`;
}

// ---------- Phát âm & shadowing ----------
const voiceFor = (i: number) => {
  const s = P!.reading.sentences[i];
  if (!s.speaker || zhVoiceCount() < 2) return 0;
  return Object.keys(P!.reading.speakers ?? {}).indexOf(s.speaker);
};

function setStatus(msg: string) {
  if (!P) return;
  P.status = msg;
  const el = document.querySelector(".player-status");
  if (el) el.textContent = msg;
}

function highlight(i: number) {
  document.querySelectorAll(".sent.current").forEach((e) => e.classList.remove("current"));
  const el = document.querySelector<HTMLElement>(`.sent[data-sent="${i}"]`);
  el?.classList.add("current");
  el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

const wait = (ms: number, token: number) =>
  new Promise<boolean>((resolve) => {
    P!.timer = window.setTimeout(() => resolve(P?.token === token), ms);
  });

/** Đọc một câu; trả về thời lượng (ms) hoặc null nếu bị dừng. */
async function sayOne(i: number, token: number): Promise<number | null> {
  const s = P!.reading.sentences[i];
  // 1x = tốc độ chuẩn trong Cài đặt
  const rate = prefs.speed * baseRate();
  const h = speakAsync(s.zh, { rate, voiceIndex: voiceFor(i), fallbackMs: estimateSpeechMs(s.zh, rate) });
  P!.handle = h;
  try {
    const ms = await h.done;
    return P?.token === token ? ms : null;
  } catch {
    return null;
  }
}

async function playLoop(from: number) {
  if (!P) return;
  const token = ++P.token;
  P.playing = true;
  renderReader();
  let i: number | null = from;
  while (i !== null && P && P.token === token) {
    P.index = i;
    highlight(i);
    setStatus(`▶ Câu ${i + 1}/${P.reading.sentences.length}${prefs.loop ? " (lặp)" : ""}`);
    const ms = await sayOne(i, token);
    if (ms === null || !P || P.token !== token) return;
    if (prefs.shadow) {
      const pause = shadowPauseMs(ms);
      setStatus(`🗣 Đến lượt bạn — nói theo câu ${i + 1} (${(pause / 1000).toFixed(1)} giây)`);
      document.querySelector(`.sent[data-sent="${i}"]`)?.classList.add("your-turn");
      if (prefs.record && recorderSupported()) {
        const h = recordOnce(pause);
        P.stopRec = h.stop;
        const idx = i;
        h.result.then((rec) => P && P.recordings.set(idx, rec.url)).catch(() => setStatus("Không ghi âm được (micro bị chặn?)."));
      }
      const ok = await wait(pause, token);
      document.querySelector(`.sent[data-sent="${i}"]`)?.classList.remove("your-turn");
      if (!ok) return;
    } else {
      if (!(await wait(350, token))) return;
    }
    i = nextSentenceIndex(i, P.reading.sentences.length, prefs.loop);
  }
  if (P && P.token === token) {
    P.playing = false;
    P.status = "Hết bài.";
    renderReader();
  }
}

function stop() {
  if (!P) return;
  P.token++;
  P.playing = false;
  window.clearTimeout(P.timer);
  P.handle?.cancel();
  P.stopRec?.();
  P.stopRec = null;
  stopSpeaking();
}

async function playSingle(i: number) {
  stop();
  if (!P) return;
  P.index = i;
  renderReader();
  const token = P.token;
  setStatus(`🔊 Câu ${i + 1}`);
  await sayOne(i, token);
  if (P && P.token === token) setStatus(`Câu ${i + 1}/${P.reading.sentences.length}`);
}

function go(delta: number) {
  if (!P) return;
  const n = P.reading.sentences.length;
  const i = Math.min(n - 1, Math.max(0, P.index + delta));
  if (P.playing) playLoop(i);
  else {
    P.index = i;
    highlight(i);
    setStatus(`Câu ${i + 1}/${n}`);
  }
}

// ---------- Sự kiện ----------
let installed = false;
export function installReaderHandlers() {
  if (installed) return;
  installed = true;
  document.addEventListener("click", (e) => {
    if (!P || !document.getElementById("reader-root")) return;
    const t = e.target as HTMLElement;
    const tg = t.closest<HTMLElement>("[data-toggle]");
    if (tg) {
      const k = tg.dataset.toggle as keyof ViewPrefs;
      (prefs as unknown as Record<string, boolean>)[k] = !prefs[k];
      savePrefs();
      renderReader();
      return;
    }
    const one = t.closest<HTMLElement>("[data-play-one]");
    if (one) return void playSingle(Number(one.dataset.playOne));
    const vi = t.closest<HTMLElement>("[data-vi]");
    if (vi) {
      const i = Number(vi.dataset.vi);
      P.openVi.has(i) ? P.openVi.delete(i) : P.openVi.add(i);
      return renderReader();
    }
    if (t.closest("[data-play]")) {
      if (!P.playing) return void playLoop(P.index);
      stop();
      P.status = `⏸ Đã dừng ở câu ${P.index + 1}/${P.reading.sentences.length}`;
      return renderReader();
    }
    if (t.closest("[data-prev]")) return go(-1);
    if (t.closest("[data-next]")) return go(1);
    if (t.closest("[data-add-new]")) {
      const statuses = wordStatuses(state.progress.cards);
      const ids = [...new Set(P.reading.sentences.flatMap((s) => s.tokens.map((x) => x.wordId)).filter((x): x is string => !!x))].filter((id) => !statuses.has(id));
      setProgress((p) => ({ ...p, cards: ids.reduce((c, id, k) => addWordCards(c, id, p.srsCardTypes, new Date(Date.now() + k)), p.cards) }), { silent: true });
      return renderReader();
    }
    const q = t.closest<HTMLElement>("[data-q]");
    if (q && !P.submitted) {
      P.answers.set(q.dataset.q!, Number(q.dataset.a));
      return renderReader();
    }
    if (t.closest("[data-submit]")) {
      P.submitted = true;
      const r = P.reading;
      const correct = r.questions.filter((x) => checkAnswer(x, { type: "comprehension", value: P!.answers.get(x.id) ?? -1 })).length;
      setProgress(
        (p) => ({ ...p, readingResults: { ...p.readingResults, [r.id]: { score: correct / r.questions.length, date: localDate(new Date()) } } }),
        { activity: "readings", silent: true },
      );
      return renderReader();
    }
    if (t.closest("[data-retry]")) {
      P.submitted = false;
      P.answers.clear();
      return renderReader();
    }
    // bấm vào vùng câu (không phải từ) -> chọn câu đó làm vị trí phát
    const sent = t.closest<HTMLElement>(".sent");
    if (sent && !t.closest(".zh-word, button, audio")) {
      P.index = Number(sent.dataset.sent);
      highlight(P.index);
      setStatus(`Câu ${P.index + 1}/${P.reading.sentences.length}`);
    }
  });
  document.addEventListener("change", (e) => {
    const sel = (e.target as HTMLElement).closest<HTMLSelectElement>("[data-speed]");
    if (sel && P) {
      prefs.speed = Number(sel.value);
      savePrefs();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (!P || !document.getElementById("reader-root") || document.querySelector("dialog[open]")) return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if ((e.target as HTMLElement).closest?.(".zh-word")) return; // Enter/Space trên từ = mở pop-up
    const key = e.key.toLowerCase();
    if (e.key === " ") {
      e.preventDefault();
      document.querySelector<HTMLElement>("[data-play]")?.click();
    } else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "ArrowRight") go(1);
    else if (key === "r") document.querySelector<HTMLElement>('[data-toggle="loop"]')?.click();
    else if (key === "p") document.querySelector<HTMLElement>('[data-toggle="pinyin"]')?.click();
    else if (key === "t") document.querySelector<HTMLElement>('[data-toggle="vi"]')?.click();
  });
  window.addEventListener("hashchange", () => {
    if (!location.hash.startsWith("#/doc/")) stop();
  });
}
