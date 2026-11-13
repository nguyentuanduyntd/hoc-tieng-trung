// Luyện tập (#/luyen-tap): trang tổng hợp + game gõ pinyin “Mưa từ vựng” (#/luyen-tap/go-pinyin, SPEC 3.12).
// Vòng lặp dùng requestAnimationFrame, tự tạm dừng khi tab bị ẩn. Kỷ lục và từ gõ sai lưu trong tiến độ.

import { wordsAtLevel } from "../config/hsk.ts";
import { applyWrongToSrs } from "../lib/exam.ts";
import {
  LIVES,
  cardPrompt,
  MISSES_TO_SRS,
  missedWords,
  newGame,
  recordKey,
  settleGame,
  step,
  submit,
  weakWordIds,
  type FallingCard,
  type GameMode,
  type GameState,
} from "../lib/pinyinGame.ts";
import { localDate } from "../lib/srs.ts";
import { dictationPage, mountDictation } from "./dictation.ts";
import { mountWorksheet, mountWriting, worksheetPage, writingPage } from "./writing.ts";
import { mountRadicals, radicalsPage } from "./radicals.ts";
import { loadLessons, setProgress, state } from "../state.ts";
import type { Word } from "../types.ts";
import { esc, zhWord } from "../ui/html.ts";
import { speakAsync, stopSpeaking, ttsSupported } from "../ui/speech.ts";

// ---------- Trang tổng hợp ----------
export function practicePage(param: string): string {
  if (param === "go-pinyin") return `<div id="game-root"><p class="muted">Đang tải dữ liệu…</p></div>`;
  if (param === "chinh-ta" || param.startsWith("chinh-ta/")) return dictationPage();
  if (param === "viet" || param.startsWith("viet/")) return writingPage();
  if (param === "in" || param.startsWith("in/")) return worksheetPage();
  if (param === "bo-thu" || param.startsWith("bo-thu/")) return radicalsPage();
  return `
    <h1>Luyện tập</h1>
    <p class="lead">Các bài luyện ngắn, chơi lúc nào cũng được. Từ bạn hay sai sẽ tự vào ôn tập.</p>
    <div class="grid">
      <div class="card">
        <h2>⌨️ Mưa từ vựng</h2>
        <p>Thẻ từ rơi xuống, gõ pinyin để “bắn”. Gõ kèm thanh điệu đúng (<code>ni3hao3</code> hoặc <code>nǐ hǎo</code>) được nhân đôi điểm. Có chế độ nghe.</p>
        <a class="btn primary" href="#/luyen-tap/go-pinyin">Chơi</a>
      </div>
      <div class="card">
        <h2>✍️ Chép chính tả</h2>
        <p>Nghe từng câu của bài đọc / hội thoại rồi gõ lại bằng pinyin hoặc chữ Hán; chấm và tô màu từng âm tiết, từng chữ.</p>
        <a class="btn primary" href="#/luyen-tap/chinh-ta">Luyện</a>
      </div>
      <div class="card">
        <h2>🖌 Luyện viết Mễ tự cách</h2>
        <p>Viết từng nét trên ô 米, máy chấm và báo sai thứ tự / sai hướng. Ba mức: tô theo, có gợi ý, tự do. In được phiếu luyện viết theo bài.</p>
        <a class="btn primary" href="#/luyen-tap/viet">Luyện viết</a>
      </div>
      <div class="card">
        <h2>部 Bộ thủ</h2>
        <p>Bộ thủ thông dụng chia theo chủ đề: nghĩa, Hán Việt, thứ tự nét, mẹo nhớ, chữ ví dụ; luyện nhận diện bộ trong chữ và ghép bộ thành chữ.</p>
        <a class="btn primary" href="#/luyen-tap/bo-thu">Học bộ thủ</a>
      </div>
      <div class="card">
        <h2>🔤 Lộ trình Pinyin</h2>
        <p>9 bài trước HSK 1: thanh điệu, thanh mẫu, vận mẫu, biến điệu, quy tắc viết — có so sánh với âm tiếng Việt và bài nghe-chọn.</p>
        <a class="btn primary" href="#/pinyin">Học Pinyin</a>
      </div>
      <div class="card">
        <h2>🗣 Phát âm & thanh điệu</h2>
        <p>Nghe phân biệt thanh, cặp thanh, biến điệu và nói theo câu.</p>
        <a class="btn" href="#/phat-am">Mở</a>
      </div>
    </div>`;
}

export function mountPractice(param: string) {
  if (param === "go-pinyin") void mountGame();
  else if (param === "chinh-ta" || param.startsWith("chinh-ta/")) void mountDictation(param.slice("chinh-ta/".length));
  else if (param === "viet" || param.startsWith("viet/")) void mountWriting(param.slice("viet/".length));
  else if (param === "in" || param.startsWith("in/")) void mountWorksheet(param.slice("in/".length));
  else if (param === "bo-thu" || param.startsWith("bo-thu/")) void mountRadicals(param.slice("bo-thu/".length));
}

// ---------- Cài đặt ván ----------
type Source = { kind: "level" } | { kind: "lesson"; id: string } | { kind: "weak" };
const setup: { mode: GameMode; source: Source } = { mode: "text", source: { kind: "level" } };

const root = () => document.getElementById("game-root");

function poolFor(src: Source): Word[] {
  const words = state.vocab?.words ?? [];
  if (src.kind === "weak") {
    const weak = weakWordIds(state.progress);
    return words.filter((w) => weak.has(w.id));
  }
  if (src.kind === "lesson") {
    const l = state.lessons?.lessons.find((x) => x.id === src.id);
    return (l?.newWordIds ?? []).map((id) => state.wordsById.get(id)).filter((w): w is Word => !!w);
  }
  return wordsAtLevel(words, state.progress.hskStandard, 1);
}

const MIN_POOL = 3;
const srcValue = (s: Source) => (s.kind === "lesson" ? `lesson:${s.id}` : s.kind);
const parseSrc = (v: string): Source => (v.startsWith("lesson:") ? { kind: "lesson", id: v.slice(7) } : v === "weak" ? { kind: "weak" } : { kind: "level" });

async function mountGame() {
  stopGame();
  const r = root();
  if (!r) return;
  if (!state.vocab) return; // main.ts vẽ lại khi dữ liệu tải xong
  await loadLessons();
  if (root() !== r) return;
  renderSetup(r);
}

function renderSetup(r: HTMLElement) {
  r.onclick = null;
  const lessons = state.lessons;
  const weakCount = poolFor({ kind: "weak" }).length;
  if (setup.source.kind === "weak" && weakCount < MIN_POOL) setup.source = { kind: "level" };
  const rec = (m: GameMode) => state.progress.gameRecords[recordKey(m)];
  r.innerHTML = `
    <h1>⌨️ Mưa từ vựng</h1>
    <p class="lead">Thẻ từ rơi xuống — gõ pinyin rồi nhấn <kbd>Enter</kbd> để bắn. Không cần dấu; gõ kèm thanh đúng thì <strong>×2 điểm</strong>. Cứ 5 thẻ có một <strong>boss</strong> (từ dài, ×3 điểm). Để rơi chạm đáy mất 1 mạng, hết ${LIVES} mạng là thua.</p>
    <div class="card section game-setup">
      <fieldset class="row"><legend>Chế độ</legend>
        <label class="check"><input type="radio" name="g-mode" value="text" ${setup.mode === "text" ? "checked" : ""}/> 📝 Chữ — hiện nghĩa tiếng Việt</label>
        <label class="check"><input type="radio" name="g-mode" value="audio" ${setup.mode === "audio" ? "checked" : ""} ${ttsSupported() ? "" : "disabled"}/> 🔊 Nghe — phát âm thanh</label>
      </fieldset>
      ${ttsSupported() ? "" : `<p class="small muted">Trình duyệt không có giọng đọc tiếng Trung nên chưa chơi được chế độ nghe.</p>`}
      <label class="row"><span>Từ vựng</span>
        <select id="g-source" aria-label="Chọn nhóm từ">
          <option value="level" ${setup.source.kind === "level" ? "selected" : ""}>Cả HSK 1 (${poolFor({ kind: "level" }).length} từ)</option>
          <option value="weak" ${setup.source.kind === "weak" ? "selected" : ""} ${weakCount < MIN_POOL ? "disabled" : ""}>Chỉ từ yếu (${weakCount} từ${weakCount < MIN_POOL ? ` — cần ít nhất ${MIN_POOL}` : ""})</option>
          ${(lessons?.units ?? [])
            .map(
              (u) => `<optgroup label="Unit ${u.unit}: ${esc(u.title)}">${u.lessonIds
                .map((id) => lessons!.lessons.find((l) => l.id === id))
                .filter((l) => !!l)
                .map((l) => `<option value="lesson:${esc(l!.id)}" ${srcValue(setup.source) === `lesson:${l!.id}` ? "selected" : ""}>${esc(l!.title)} (${l!.newWordIds.length} từ)</option>`)
                .join("")}</optgroup>`,
            )
            .join("")}
        </select></label>
      <p class="small muted">Từ yếu = từ bạn từng gõ sai ở đây hoặc từng quên khi ôn tập. Một từ gõ sai từ ${MISSES_TO_SRS} lần trở lên sẽ tự vào ôn tập.</p>
      <p class="small">Kỷ lục: 📝 Chữ <strong>${rec("text")?.score ?? "–"}</strong> · 🔊 Nghe <strong>${rec("audio")?.score ?? "–"}</strong></p>
      <p><button class="btn primary big-btn" data-g="start">Bắt đầu</button> <a class="btn" href="#/luyen-tap">Quay lại</a></p>
    </div>`;
  r.querySelectorAll<HTMLInputElement>('input[name="g-mode"]').forEach((i) => i.addEventListener("change", () => (setup.mode = i.value as GameMode)));
  r.querySelector<HTMLSelectElement>("#g-source")!.addEventListener("change", (e) => (setup.source = parseSrc((e.target as HTMLSelectElement).value)));
  r.querySelector('[data-g="start"]')!.addEventListener("click", () => startGame(r));
}

// ---------- Ván chơi ----------
interface Run {
  s: GameState;
  raf: number;
  last: number;
  paused: boolean;
  /** Phần tử DOM của từng thẻ. */
  els: Map<number, HTMLElement>;
  fieldH: number;
  cleanup: () => void;
}
let run: Run | null = null;

function stopGame() {
  if (!run) return;
  cancelAnimationFrame(run.raf);
  run.cleanup();
  run = null;
  stopSpeaking();
}

const hearts = (n: number) => "❤️".repeat(Math.max(0, n)) + "🤍".repeat(Math.max(0, LIVES - n));
const meaningOf = cardPrompt;

function startGame(r: HTMLElement) {
  const pool = poolFor(setup.source);
  if (pool.length < MIN_POOL) return;
  stopGame();
  const best = state.progress.gameRecords[recordKey(setup.mode)]?.score ?? 0;
  r.innerHTML = `
    <div class="game-hud" role="status">
      <span>Điểm <strong id="g-score">0</strong></span>
      <span id="g-lives" aria-label="Số mạng">${hearts(LIVES)}</span>
      <span class="muted small">Kỷ lục ${best}</span>
      <span class="spacer"></span>
      <button class="btn small" data-g="pause" aria-label="Tạm dừng">⏸</button>
      <button class="btn small" data-g="quit">Kết thúc</button>
    </div>
    <div class="game-field ${setup.mode}" id="g-field">
      <div class="game-overlay" id="g-overlay" hidden><div class="card center"><p><strong>Tạm dừng</strong></p><button class="btn primary" data-g="resume">Tiếp tục</button></div></div>
      <div class="game-flash" id="g-flash" aria-live="polite"></div>
    </div>
    <form class="game-input" id="g-form" autocomplete="off">
      <input id="g-input" type="text" inputmode="latin" autocapitalize="off" autocorrect="off" spellcheck="false" lang="en"
        placeholder="Gõ pinyin rồi Enter — vd: ni hao, ni3hao3" aria-label="Gõ pinyin" />
      ${setup.mode === "audio" ? `<button type="button" class="btn icon-btn" data-g="replay" aria-label="Nghe lại">🔊</button>` : ""}
      <button type="submit" class="btn primary">Bắn</button>
    </form>
    <p class="muted small center">${setup.mode === "audio" ? "Nhấn Enter khi ô trống để nghe lại. " : ""}<kbd>Esc</kbd> tạm dừng.</p>`;
  const field = r.querySelector<HTMLElement>("#g-field")!;
  const input = r.querySelector<HTMLInputElement>("#g-input")!;
  const onVis = () => document.hidden && setPaused(true);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && run) {
      e.preventDefault();
      setPaused(!run.paused);
    }
  };
  const onHash = () => {
    if (!location.hash.startsWith("#/luyen-tap/go-pinyin")) stopGame();
  };
  document.addEventListener("visibilitychange", onVis);
  document.addEventListener("keydown", onKey);
  window.addEventListener("hashchange", onHash);
  run = {
    s: newGame(pool, setup.mode),
    raf: 0,
    last: performance.now(),
    paused: false,
    els: new Map(),
    fieldH: field.clientHeight,
    cleanup: () => {
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("hashchange", onHash);
    },
  };
  r.querySelector<HTMLFormElement>("#g-form")!.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!run || run.paused) return;
    const v = input.value;
    if (!v.trim()) {
      if (run.s.mode === "audio") replay();
      return;
    }
    handle([submit(run.s, v)]);
    input.value = "";
  });
  r.onclick = (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>("[data-g]")?.dataset.g;
    if (!run) return;
    if (act === "pause") setPaused(true);
    else if (act === "resume") setPaused(false);
    else if (act === "replay") replay();
    else if (act === "quit") endGame();
    if (act && act !== "quit") input.focus();
  };
  input.focus();
  run.raf = requestAnimationFrame(frame);
}

function setPaused(p: boolean) {
  if (!run || run.s.over) return;
  run.paused = p;
  document.getElementById("g-overlay")!.hidden = !p;
  if (p) stopSpeaking();
  else {
    run.last = performance.now();
    document.getElementById("g-input")?.focus();
  }
}

function replay() {
  const c = run?.s.cards.reduce<FallingCard | undefined>((a, x) => (!a || x.y > a.y ? x : a), undefined);
  if (c) say(c.word.hanzi);
}

function say(text: string) {
  if (!ttsSupported()) return;
  speakAsync(text).done.catch(() => {});
}

function frame(now: number) {
  if (!run) return;
  const field = document.getElementById("g-field");
  if (!field) return stopGame();
  const dt = Math.min(100, now - run.last);
  run.last = now;
  if (!run.paused) {
    run.fieldH = field.clientHeight;
    handle(step(run.s, dt));
    if (run) for (const c of run.s.cards) place(c);
  }
  if (run && !run.s.over) run.raf = requestAnimationFrame(frame);
}

const CARD_H = 64;
function place(c: FallingCard) {
  const el = run!.els.get(c.key);
  if (el) el.style.transform = `translate(-50%, ${Math.round(c.y * Math.max(0, run!.fieldH - CARD_H))}px)`;
}

function handle(events: ReturnType<typeof step>) {
  if (!run) return;
  const field = document.getElementById("g-field")!;
  for (const ev of events) {
    if (ev.type === "spawn") {
      const el = document.createElement("div");
      el.className = `fall-card${ev.card.boss ? " boss" : ""}`;
      el.style.left = `${ev.card.x * 100}%`;
      el.innerHTML =
        run.s.mode === "audio"
          ? `<span class="fc-main">🔊</span>${ev.card.boss ? `<span class="fc-tag">BOSS</span>` : ""}`
          : `<span class="fc-main">${esc(meaningOf(ev.card.word))}</span>${ev.card.boss ? `<span class="fc-tag">BOSS</span>` : ""}`;
      field.appendChild(el);
      run.els.set(ev.card.key, el);
      place(ev.card);
      if (run.s.mode === "audio") say(ev.card.word.hanzi);
    } else if (ev.type === "hit") {
      const el = run.els.get(ev.card.key);
      run.els.delete(ev.card.key);
      if (el) {
        el.classList.add("pop");
        el.innerHTML = `<span class="fc-zh" lang="zh-CN">${esc(ev.card.word.hanzi)}</span><span class="fc-py">${esc(ev.card.word.pinyin)}</span><span class="fc-pts">+${ev.points}${ev.toneBonus ? " ×2" : ""}</span>`;
        setTimeout(() => el.remove(), 900);
      }
      say(ev.card.word.hanzi);
      document.getElementById("g-score")!.textContent = String(run.s.score);
    } else if (ev.type === "drop") {
      run.els.get(ev.card.key)?.remove();
      run.els.delete(ev.card.key);
      flash(`💥 ${ev.card.word.hanzi} — ${ev.card.word.pinyin}`, "bad");
      document.getElementById("g-lives")!.textContent = hearts(run.s.lives);
      field.classList.remove("shake");
      void field.offsetWidth;
      field.classList.add("shake");
    } else if (ev.type === "wrong") {
      const input = document.getElementById("g-input");
      input?.classList.remove("shake");
      void input?.offsetWidth;
      input?.classList.add("shake");
    } else if (ev.type === "over") {
      endGame();
      return;
    }
  }
}

function flash(msg: string, kind: "bad" | "good") {
  const el = document.getElementById("g-flash");
  if (!el) return;
  el.textContent = msg;
  el.className = `game-flash show ${kind}`;
  window.setTimeout(() => el.classList.remove("show"), 1600);
}

// ---------- Kết thúc ----------
function endGame() {
  if (!run) return;
  const s = run.s;
  s.over = true;
  stopGame();
  const today = localDate(new Date());
  const out = settleGame(state.progress, s.mode, s.score, s.misses, today);
  const missed = missedWords(s);
  setProgress(
    (p) => ({
      ...p,
      wordMisses: out.wordMisses,
      gameRecords: out.record ? { ...p.gameRecords, [recordKey(s.mode)]: out.record } : p.gameRecords,
      cards: out.toSrs.length ? applyWrongToSrs(p.cards, out.toSrs, p.srsCardTypes, new Date()) : p.cards,
    }),
    { activity: s.hits > 0, silent: true },
  );
  const r = root();
  if (!r) return;
  r.innerHTML = `
    <div class="card summary center">
      <h1>${out.record ? "🏆 Kỷ lục mới!" : "Kết thúc"}</h1>
      <div class="stat">${s.score}<span class="muted" style="font-size:1rem"> điểm</span></div>
      <div class="row center">
        <span class="badge">Bắn trúng ${s.hits} từ</span>
        <span class="badge accent">Đúng thanh ${s.toneHits}</span>
        <span class="badge">${s.mode === "audio" ? "🔊 Nghe" : "📝 Chữ"}</span>
      </div>
      ${out.toSrs.length ? `<p>${out.toSrs.length} từ sai từ ${MISSES_TO_SRS} lần trở lên đã được đưa vào <a href="#/on-tap">ôn tập</a>.</p>` : ""}
      <div class="row center"><button class="btn primary" data-g="again">Chơi lại</button><button class="btn" data-g="setup">Đổi cài đặt</button></div>
    </div>
    ${
      missed.length
        ? `<section class="section"><h2>Từ gõ sai (${missed.length})</h2><div class="table-wrap"><table class="sandhi">
            <thead><tr><th>Từ</th><th>Pinyin</th><th>Nghĩa</th><th>Sai</th></tr></thead><tbody>
            ${missed.map(({ word, count }) => `<tr><td lang="zh-CN">${zhWord(word.hanzi, word.id)}</td><td>${esc(word.pinyin)}</td><td class="wrap">${esc(meaningOf(word))}</td><td>${count}</td></tr>`).join("")}
            </tbody></table></div></section>`
        : `<p class="center">Không gõ sai từ nào 👏</p>`
    }`;
  r.onclick = (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>("[data-g]")?.dataset.g;
    if (act === "again") startGame(r);
    else if (act === "setup") renderSetup(r);
  };
}
