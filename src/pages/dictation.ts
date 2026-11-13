// Chép chính tả (#/luyen-tap/chinh-ta, #/luyen-tap/chinh-ta/<readingId>) — SPEC 3.13.
// Nghe từng câu của bài đọc / hội thoại tự soạn → gõ lại bằng pinyin hoặc chữ Hán (bộ gõ của máy),
// chấm từng âm tiết / chữ. Điểm tốt nhất từng câu lưu trong tiến độ.

import { PASS, checkHanzi, checkPinyin, dictationStatus, recordSentence, targetSyllables, type DictationResult, type DictationStatus } from "../lib/dictation.ts";
import { XP } from "../lib/xp.ts";
import { isHanzi } from "../lib/pinyin.ts";
import { setProgress, state } from "../state.ts";
import type { Reading, ReadingSentence } from "../types.ts";
import { esc, zhWord } from "../ui/html.ts";
import { baseRate, speakAsync, stopSpeaking, ttsSupported } from "../ui/speech.ts";
import { loadReadings } from "./reading.ts";

type InputMode = "pinyin" | "hanzi";
const prefs: { mode: InputMode; level: string; status: "all" | DictationStatus } = { mode: "pinyin", level: "1", status: "all" };

const STATUS_LABEL: Record<DictationStatus, string> = { done: "Xong", learning: "Đang học", new: "Chưa học" };
const STATUS_ICON: Record<DictationStatus, string> = { done: "✅", learning: "✏️", new: "⬜" };

export const dictationPage = () => `<div id="dict-root"><p class="muted">Đang tải bài…</p></div>`;

const root = () => document.getElementById("dict-root");
const statusOf = (r: Reading) => dictationStatus(state.progress.dictation[r.id], r.sentences.length);

export async function mountDictation(id: string) {
  stopSpeaking();
  const file = await loadReadings();
  const el = root();
  if (!el) return;
  if (!file) return void (el.innerHTML = `<div class="notice">Không tải được dữ liệu bài đọc.</div>`);
  if (!id) return renderList(el, file.readings);
  const reading = file.readings.find((r) => r.id === id);
  if (!reading) return void (el.innerHTML = `<div class="notice">Không có bài này. <a href="#/luyen-tap/chinh-ta">Về danh sách</a></div>`);
  const best = state.progress.dictation[reading.id] ?? {};
  // bắt đầu ở câu đầu tiên chưa đạt
  const start = reading.sentences.findIndex((_, i) => (best[i] ?? 0) < PASS);
  run = { reading, i: start < 0 ? 0 : start, hint: 0, result: null, typed: "" };
  renderRun(el);
  if (ttsSupported()) play();
}

// ---------- Danh sách ----------
function renderList(el: HTMLElement, readings: Reading[]) {
  const levels = [...new Set(readings.map((r) => r.hskLevel))].sort();
  const shown = readings.filter((r) => String(r.hskLevel) === prefs.level && (prefs.status === "all" || statusOf(r) === prefs.status));
  const count = (s: DictationStatus) => readings.filter((r) => String(r.hskLevel) === prefs.level && statusOf(r) === s).length;
  el.innerHTML = `
    <h1>✍️ Chép chính tả</h1>
    <p class="lead">Nghe từng câu rồi gõ lại bằng <strong>pinyin</strong> (không cần dấu; có gõ thanh thì chấm cả thanh) hoặc <strong>chữ Hán</strong> bằng bộ gõ của máy. Câu đạt từ ${Math.round(PASS * 100)}% là xong.</p>
    ${ttsSupported() ? "" : `<div class="notice">Trình duyệt không có giọng đọc tiếng Trung nên chưa nghe được câu. Hãy thử Chrome hoặc Edge.</div>`}
    <div class="notice small">Câu lấy từ bài đọc và hội thoại do dự án tự soạn (bản nháp, đang chờ duyệt).</div>
    <div class="toolbar row">
      <label class="row"><span class="muted">Cấp</span>
        <select id="d-level" aria-label="Lọc theo cấp HSK">${levels.map((l) => `<option value="${l}" ${String(l) === prefs.level ? "selected" : ""}>HSK ${l}</option>`).join("")}</select></label>
      <div class="tabs" role="group" aria-label="Lọc theo trạng thái">
        ${(["all", "learning", "new", "done"] as const)
          .map((s) => `<button class="btn small ${prefs.status === s ? "primary" : ""}" data-d-status="${s}" aria-pressed="${prefs.status === s}">${s === "all" ? "Tất cả" : `${STATUS_LABEL[s]} (${count(s)})`}</button>`)
          .join("")}
      </div>
    </div>
    ${
      shown.length
        ? `<div class="grid">${shown
            .map((r) => {
              const st = statusOf(r);
              const best = state.progress.dictation[r.id] ?? {};
              const passed = r.sentences.filter((_, i) => (best[i] ?? 0) >= PASS).length;
              return `<div class="card">
                <h3>${esc(r.title)} ${r.titleZh ? `<span lang="zh-CN" class="muted">${esc(r.titleZh)}</span>` : ""}</h3>
                <p class="small">${r.kind === "dialogue" ? "Hội thoại" : "Bài đọc"} · ${r.sentences.length} câu · <span class="badge ${st === "done" ? "accent" : ""}">${STATUS_ICON[st]} ${STATUS_LABEL[st]}</span>${st === "learning" ? ` <span class="muted">${passed}/${r.sentences.length} câu</span>` : ""}</p>
                <a class="btn ${st === "done" ? "" : "primary"}" href="#/luyen-tap/chinh-ta/${esc(r.id)}">${st === "new" ? "Bắt đầu" : st === "done" ? "Làm lại" : "Làm tiếp"}</a>
              </div>`;
            })
            .join("")}</div>`
        : `<p class="muted">Không có bài nào ở bộ lọc này.</p>`
    }`;
  el.querySelector<HTMLSelectElement>("#d-level")!.onchange = (e) => {
    prefs.level = (e.target as HTMLSelectElement).value;
    renderList(el, readings);
  };
  el.onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-d-status]");
    if (!b) return;
    prefs.status = b.dataset.dStatus as typeof prefs.status;
    renderList(el, readings);
  };
}

// ---------- Làm bài ----------
interface Run {
  reading: Reading;
  i: number;
  hint: number;
  result: DictationResult | null;
  typed: string;
}
let run: Run | null = null;

const sentence = () => run!.reading.sentences[run!.i];
const roleFor = (r: Reading, s: ReadingSentence): "primary" | "partner" =>
  s.speaker && Object.keys(r.speakers ?? {}).indexOf(s.speaker) === 1 ? "partner" : "primary";

function play(slow = false) {
  if (!run || !ttsSupported()) return;
  stopSpeaking();
  const s = sentence();
  speakAsync(s.zh, { rate: slow ? Math.max(0.3, baseRate() * 0.6) : baseRate(), role: roleFor(run.reading, s) }).done.catch(() => {});
}

/** Đơn vị gợi ý: âm tiết (pinyin) hoặc chữ (chữ Hán). */
const hintUnits = (s: ReadingSentence) => (prefs.mode === "pinyin" ? targetSyllables(s).map((x) => x.marked) : [...s.zh].filter(isHanzi));

let sameSoundMap: Map<string, string> | null = null;
function sameSound(a: string, b: string): boolean {
  if (!sameSoundMap) {
    sameSoundMap = new Map();
    for (const w of state.vocab?.words ?? []) if ([...w.hanzi].length === 1 && !sameSoundMap.has(w.hanzi)) sameSoundMap.set(w.hanzi, w.pinyinNumbered);
  }
  const pa = sameSoundMap.get(a);
  return !!pa && pa === sameSoundMap.get(b);
}

function rubyHtml(s: ReadingSentence): string {
  return `<span class="exam-zh" lang="zh-CN">${s.tokens
    .map((t, k) => {
      const inner = t.wordId ? zhWord(t.text, t.wordId) : esc(t.text);
      return s.tokenPinyin[k] ? `<ruby>${inner}<rt>${esc(s.tokenPinyin[k])}</rt></ruby>` : inner;
    })
    .join("")}</span>`;
}

const MARK_LABEL: Record<string, string> = { ok: "đúng", homophone: "đồng âm", tone: "sai thanh", wrong: "sai", missing: "thiếu" };

function resultHtml(r: DictationResult): string {
  return `<div class="dict-cells" aria-label="Kết quả từng ${prefs.mode === "pinyin" ? "âm tiết" : "chữ"}">${r.cells
    .map(
      (c) => `<span class="dict-cell ${c.mark}" title="${MARK_LABEL[c.mark]}${c.got ? ` — bạn gõ: ${esc(c.got)}` : ""}">
        <span class="dc-target" ${prefs.mode === "hanzi" ? 'lang="zh-CN"' : ""}>${esc(c.target)}</span>
        <span class="dc-got">${c.mark === "missing" ? "—" : c.got ? esc(c.got) : "✓"}</span></span>`,
    )
    .join("")}</div>
    ${r.extra.length ? `<p class="small">Gõ thừa: <span class="dict-extra">${r.extra.map(esc).join(" ")}</span></p>` : ""}
    <p class="small muted dict-legend"><span class="dict-cell ok">đúng</span> <span class="dict-cell tone">sai thanh</span> <span class="dict-cell homophone">đồng âm</span> <span class="dict-cell wrong">sai</span> <span class="dict-cell missing">thiếu</span></p>`;
}

function renderRun(el: HTMLElement) {
  const R = run!;
  const s = sentence();
  const best = state.progress.dictation[R.reading.id] ?? {};
  const units = hintUnits(s);
  const speakerName = s.speaker ? (R.reading.speakers?.[s.speaker] ?? s.speaker) : "";
  el.innerHTML = `
    <div class="row review-head">
      <h1>✍️ ${esc(R.reading.title)}</h1>
      <a class="btn small" href="#/luyen-tap/chinh-ta">Danh sách bài</a>
    </div>
    <nav class="dict-dots" aria-label="Các câu">${R.reading.sentences
      .map((_, k) => {
        const b = best[k];
        const cls = b === undefined ? "" : b >= PASS ? "done" : "tried";
        return `<button class="dict-dot ${cls} ${k === R.i ? "current" : ""}" data-d-go="${k}" aria-label="Câu ${k + 1}${b !== undefined ? `, tốt nhất ${Math.round(b * 100)}%` : ""}" ${k === R.i ? 'aria-current="step"' : ""}>${k + 1}</button>`;
      })
      .join("")}</nav>
    <div class="card section dict-card">
      <div class="row">
        <strong>Câu ${R.i + 1}/${R.reading.sentences.length}</strong>
        ${speakerName ? `<span class="badge">${esc(speakerName)}</span>` : ""}
        <span class="spacer"></span>
        <div class="tabs" role="group" aria-label="Cách gõ">
          <button class="btn small ${prefs.mode === "pinyin" ? "primary" : ""}" data-d-mode="pinyin" aria-pressed="${prefs.mode === "pinyin"}">Pinyin</button>
          <button class="btn small ${prefs.mode === "hanzi" ? "primary" : ""}" data-d-mode="hanzi" aria-pressed="${prefs.mode === "hanzi"}">Chữ Hán</button>
        </div>
      </div>
      <div class="row dict-controls">
        <button class="btn" data-d="play" ${ttsSupported() ? "" : "disabled"}>🔊 Nghe</button>
        <button class="btn" data-d="slow" ${ttsSupported() ? "" : "disabled"}>🐢 Chậm</button>
        <button class="btn" data-d="hint" ${R.hint >= units.length || R.result ? "disabled" : ""}>💡 Gợi ý</button>
      </div>
      ${R.hint && !R.result ? `<p class="dict-hint">Gợi ý: <span ${prefs.mode === "hanzi" ? 'lang="zh-CN"' : ""}>${units.slice(0, R.hint).map(esc).join(prefs.mode === "pinyin" ? " " : "")}</span> …</p>` : ""}
      <form id="d-form" class="game-input" autocomplete="off">
        <input id="d-input" type="text" value="${esc(R.typed)}" ${prefs.mode === "hanzi" ? 'lang="zh-CN"' : 'lang="en" autocapitalize="off" autocorrect="off" spellcheck="false"'}
          placeholder="${prefs.mode === "pinyin" ? "Gõ pinyin — vd: wo shi xuesheng / wo3 shi4 xue2sheng" : "Gõ chữ Hán bằng bộ gõ tiếng Trung của máy"}" aria-label="Gõ lại câu vừa nghe" ${R.result ? "readonly" : ""}/>
        ${R.result ? "" : `<button type="submit" class="btn primary">Kiểm tra</button>`}
      </form>
      ${
        R.result
          ? `<div class="dict-result">
              <p><strong class="${R.result.accuracy >= PASS ? "ok-text" : ""}">${Math.round(R.result.accuracy * 100)}%</strong> ${R.result.accuracy >= PASS ? "— đạt 👏" : `— cần ${Math.round(PASS * 100)}% để xong câu này`}${R.hint ? ` <span class="muted small">(dùng ${R.hint} gợi ý)</span>` : ""}</p>
              ${resultHtml(R.result)}
              <div class="dict-answer">${rubyHtml(s)}<p class="muted">${esc(s.vi)}</p></div>
              <div class="row">
                <button class="btn" data-d="retry">Làm lại câu này</button>
                ${R.i < R.reading.sentences.length - 1 ? `<button class="btn primary" data-d="next">Câu tiếp →</button>` : `<a class="btn primary" href="#/luyen-tap/chinh-ta">Xong bài — về danh sách</a>`}
              </div>
            </div>`
          : `<p class="small muted">Nhấn <kbd>Enter</kbd> để kiểm tra. Không thấy giọng đọc? Xem <a href="#/cai-dat">Cài đặt</a>.</p>`
      }
    </div>`;
  const input = el.querySelector<HTMLInputElement>("#d-input")!;
  input.addEventListener("input", () => (R.typed = input.value));
  el.querySelector<HTMLFormElement>("#d-form")!.addEventListener("submit", (e) => {
    e.preventDefault();
    if (R.result) return;
    check(el, input.value);
  });
  el.onclick = (e) => {
    const t = e.target as HTMLElement;
    const act = t.closest<HTMLElement>("[data-d]")?.dataset.d;
    const mode = t.closest<HTMLElement>("[data-d-mode]")?.dataset.dMode as InputMode | undefined;
    const go = t.closest<HTMLElement>("[data-d-go]")?.dataset.dGo;
    if (act === "play") play();
    else if (act === "slow") play(true);
    else if (act === "hint") {
      R.hint++;
      renderRun(el);
      el.querySelector<HTMLInputElement>("#d-input")?.focus();
    } else if (act === "retry") gotoSentence(el, R.i, false);
    else if (act === "next") gotoSentence(el, R.i + 1, true);
    else if (mode && mode !== prefs.mode) {
      prefs.mode = mode;
      R.result = null;
      R.typed = "";
      R.hint = 0;
      renderRun(el);
    } else if (go !== undefined) gotoSentence(el, Number(go), true);
  };
  if (!R.result) input.focus();
}

function gotoSentence(el: HTMLElement, i: number, autoplay: boolean) {
  if (!run) return;
  run.i = i;
  run.hint = 0;
  run.result = null;
  run.typed = "";
  renderRun(el);
  if (autoplay) play();
}

function check(el: HTMLElement, typed: string) {
  if (!run || !typed.trim()) return;
  const s = sentence();
  const raw = prefs.mode === "pinyin" ? checkPinyin(s, typed) : checkHanzi(s.zh, typed, sameSound);
  // mỗi gợi ý trừ một phần điểm tương ứng
  const units = hintUnits(s).length || 1;
  const accuracy = Math.max(0, Math.round((raw.accuracy - run.hint / units) * 100) / 100);
  run.result = { ...raw, accuracy };
  run.typed = typed;
  const { reading, i } = run;
  setProgress((p) => ({ ...p, dictation: recordSentence(p, reading.id, i, accuracy) }), {
    activity: true,
    silent: true,
    xp: accuracy >= PASS ? XP.dictationPass : XP.dictationTry,
  });
  renderRun(el);
  el.querySelector<HTMLElement>(".dict-result")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
