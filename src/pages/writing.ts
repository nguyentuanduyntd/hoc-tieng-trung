// Luyện viết Mễ tự cách (#/luyen-tap/viet[/<lessonId> | /chu/<chữ>]) — SPEC 3.16 —
// và phiếu in luyện viết (#/luyen-tap/in/<lessonId> | /in/chu/<chữ>) — nút “In PDF luyện viết” của 3.14.

import HanziWriter from "hanzi-writer";
import { XP } from "../lib/xp.ts";
import {
  DEFAULT_WORKSHEET,
  charInfo,
  classifyMistake,
  glyphSvg,
  lessonChars,
  miziGridSvg,
  mistakeMessage,
  uniqueChars,
  worksheetCells,
  type StrokeJson,
  type WorksheetOptions,
} from "../lib/writing.ts";
import { isHanzi } from "../lib/pinyin.ts";
import { wordsAtLevel } from "../config/hsk.ts";
import { loadLessons, setProgress, state } from "../state.ts";
import { esc } from "../ui/html.ts";
import { loadChar, strokeOptions } from "../ui/strokes.ts";
import { speak } from "../ui/speech.ts";

type Mode = "trace" | "guided" | "free";
const MODES: [Mode, string, string][] = [
  ["trace", "Tô theo", "Hiện chữ mờ, sai 1 lần là gợi ý nét."],
  ["guided", "Có gợi ý", "Không hiện chữ mờ; sai 2 lần hoặc bấm 💡 để xem nét tiếp theo."],
  ["free", "Tự do", "Không gợi ý — tự nhớ thứ tự nét."],
];

/** Tham số route: "", "<lessonId>", "chu/<chữ>". */
function parseTarget(rest: string): { lessonId?: string; chars?: string } {
  if (rest.startsWith("chu/")) return { chars: [...rest.slice(4)].filter(isHanzi).join("") };
  return rest ? { lessonId: rest } : {};
}

// ---------- Bảng luyện viết ----------
const board: { mode: Mode; chars: string[]; i: number; results: Record<string, number>; source: string } = {
  mode: "trace",
  chars: [],
  i: 0,
  results: {},
  source: "",
};

export const writingPage = () => `<div id="write-root"><p class="muted">Đang tải…</p></div>`;

export async function mountWriting(rest: string) {
  const el = document.getElementById("write-root");
  if (!el || !state.vocab) return;
  await loadLessons();
  if (!document.getElementById("write-root")) return;
  const t = parseTarget(rest);
  const lesson = t.lessonId ? state.lessons?.lessons.find((l) => l.id === t.lessonId) : undefined;
  const chars = t.chars ? [...t.chars] : lesson ? lessonChars(lesson, state.wordsById) : [];
  const source = rest || "hsk1";
  if (source !== board.source) {
    board.source = source;
    board.chars = chars.length ? chars : uniqueChars(wordsAtLevel(state.vocab.words, state.progress.hskStandard, 1));
    board.i = 0;
    board.results = {};
  }
  renderBoard(el, lesson?.title ?? (t.chars ? `Chữ ${t.chars}` : "Chữ HSK 1"));
}

let writer: HanziWriter | null = null;

function renderBoard(el: HTMLElement, title: string) {
  const ch = board.chars[board.i];
  const info = charInfo(ch, state.vocab!.words);
  const lessons = state.lessons;
  el.innerHTML = `
    <div class="row review-head"><h1>✍️ Luyện viết · ${esc(title)}</h1>
      <a class="btn small" href="#/luyen-tap/in/${board.source.startsWith("chu/") ? board.source : board.source === "hsk1" ? "" : board.source}" ${board.source === "hsk1" ? "hidden" : ""}>🖨 In phiếu luyện viết</a></div>
    <div class="toolbar row">
      <label class="row"><span class="muted">Chữ của</span>
        <select id="w-source" aria-label="Chọn nhóm chữ">
          <option value="hsk1" ${board.source === "hsk1" ? "selected" : ""}>Cả HSK 1</option>
          ${board.source.startsWith("chu/") ? `<option value="${esc(board.source)}" selected>${esc(title)}</option>` : ""}
          ${(lessons?.units ?? [])
            .map(
              (u) => `<optgroup label="Unit ${u.unit}: ${esc(u.title)}">${u.lessonIds
                .map((id) => lessons!.lessons.find((l) => l.id === id))
                .filter((l) => !!l)
                .map((l) => `<option value="${esc(l!.id)}" ${board.source === l!.id ? "selected" : ""}>${esc(l!.title)}</option>`)
                .join("")}</optgroup>`,
            )
            .join("")}
        </select></label>
      <form id="w-custom" class="row"><input id="w-chars" type="text" lang="zh-CN" placeholder="Hoặc gõ chữ muốn luyện" aria-label="Chữ muốn luyện" size="14"/><button class="btn small">Luyện</button></form>
    </div>
    <div class="write-layout">
      <div>
        <div class="tabs" role="group" aria-label="Chế độ">${MODES.map(([m, label]) => `<button class="btn small ${board.mode === m ? "primary" : ""}" data-w-mode="${m}" aria-pressed="${board.mode === m}">${label}</button>`).join("")}</div>
        <p class="small muted">${esc(MODES.find(([m]) => m === board.mode)![2])}</p>
        <div class="mizi-board" id="w-board">${miziGridSvg()}<div id="w-writer" class="mizi-writer" aria-label="Ô viết chữ ${esc(ch)}"></div></div>
        <p class="write-msg" id="w-msg" aria-live="polite"></p>
        <div class="row">
          <button class="btn" data-w="restart">↺ Viết lại</button>
          <button class="btn" data-w="animate">▶ Xem nét</button>
          ${board.mode === "guided" ? `<button class="btn" data-w="hint">💡 Nét tiếp</button>` : ""}
          <span class="spacer"></span>
          <button class="btn" data-w="prev" ${board.i === 0 ? "disabled" : ""}>←</button>
          <button class="btn primary" data-w="next" ${board.i >= board.chars.length - 1 ? "disabled" : ""}>Chữ tiếp →</button>
        </div>
      </div>
      <aside class="card write-info">
        <div class="write-big" lang="zh-CN">${esc(ch)}</div>
        <p>${info.pinyin ? `<strong>${esc(info.pinyin)}</strong> · ` : ""}${info.hanViet ? esc(info.hanViet) : ""} <button class="btn icon-btn small" data-w="speak" aria-label="Nghe">🔊</button></p>
        ${info.meaning ? `<p class="small">${esc(info.meaning)}</p>` : ""}
        <p class="small muted" id="w-strokes"></p>
        ${info.examples.length ? `<p class="small">Từ có chữ này: <span lang="zh-CN">${info.examples.map((w) => esc(w.hanzi)).join("、")}</span></p>` : ""}
      </aside>
    </div>
    <nav class="write-chars" aria-label="Danh sách chữ">${board.chars
      .map((c, k) => {
        const r = board.results[c];
        return `<button class="write-char ${k === board.i ? "current" : ""} ${r === undefined ? "" : r === 0 ? "perfect" : "done"}" data-w-go="${k}" lang="zh-CN" aria-label="${esc(c)}${r === undefined ? "" : `, đã viết, ${r} lỗi`}">${esc(c)}</button>`;
      })
      .join("")}</nav>`;
  bindBoard(el, title);
  startQuiz();
}

function bindBoard(el: HTMLElement, title: string) {
  el.querySelector<HTMLSelectElement>("#w-source")!.onchange = (e) => {
    const v = (e.target as HTMLSelectElement).value;
    location.hash = v === "hsk1" ? "#/luyen-tap/viet" : v.startsWith("chu/") ? `#/luyen-tap/viet/${v}` : `#/luyen-tap/viet/${encodeURIComponent(v)}`;
  };
  el.querySelector<HTMLFormElement>("#w-custom")!.onsubmit = (e) => {
    e.preventDefault();
    const v = [...el.querySelector<HTMLInputElement>("#w-chars")!.value].filter(isHanzi).join("");
    if (v) location.hash = `#/luyen-tap/viet/chu/${encodeURIComponent(v)}`;
  };
  el.onclick = (e) => {
    const t = e.target as HTMLElement;
    const act = t.closest<HTMLElement>("[data-w]")?.dataset.w;
    const mode = t.closest<HTMLElement>("[data-w-mode]")?.dataset.wMode as Mode | undefined;
    const go = t.closest<HTMLElement>("[data-w-go]")?.dataset.wGo;
    if (mode) {
      board.mode = mode;
      renderBoard(el, title);
    } else if (go !== undefined) {
      board.i = Number(go);
      renderBoard(el, title);
    } else if (act === "next" || act === "prev") {
      board.i = Math.max(0, Math.min(board.chars.length - 1, board.i + (act === "next" ? 1 : -1)));
      renderBoard(el, title);
    } else if (act === "restart") startQuiz();
    else if (act === "animate") {
      const w = writer;
      if (!w) return;
      w.cancelQuiz();
      w.showOutline();
      void w.animateCharacter({ onComplete: () => writer === w && startQuiz() });
    } else if (act === "hint") writer?.highlightStroke(current);
    else if (act === "speak") speak(board.chars[board.i]);
  };
}

let current = 0;

function msg(text: string, kind: "" | "ok" | "bad" = "") {
  const m = document.getElementById("w-msg");
  if (!m) return;
  m.textContent = text;
  m.className = `write-msg ${kind}`;
}

function startQuiz() {
  const box = document.getElementById("w-writer");
  const boardEl = document.getElementById("w-board");
  if (!box || !boardEl) return;
  const ch = board.chars[board.i];
  box.innerHTML = "";
  const size = Math.round(boardEl.clientWidth) || 300;
  current = 0;
  msg("");
  let data: StrokeJson | null = null;
  void loadChar(ch).then((d) => {
    data = d as unknown as StrokeJson;
    const s = document.getElementById("w-strokes");
    if (s) s.textContent = `${data.strokes.length} nét`;
  });
  writer = HanziWriter.create(box, ch, {
    ...strokeOptions(size),
    padding: Math.round(size * 0.06),
    showCharacter: false,
    showOutline: board.mode === "trace",
    showHintAfterMisses: board.mode === "trace" ? 1 : board.mode === "guided" ? 2 : false,
    highlightOnComplete: true,
    drawingWidth: Math.max(14, Math.round(size / 18)),
    onLoadCharDataError: () => msg(`Chưa có dữ liệu nét cho chữ ${ch}.`, "bad"),
  });
  writer.quiz({
    onMistake: (sd) => {
      if (!data) return msg(`Nét ${sd.strokeNum + 1} chưa đúng — thử lại.`, "bad");
      msg(mistakeMessage(classifyMistake(sd.drawnPath.points, data.medians, sd.strokeNum, sd.isBackwards), sd.strokeNum), "bad");
    },
    onCorrectStroke: (sd) => {
      current = sd.strokeNum + 1;
      msg(sd.strokesRemaining ? `✓ Nét ${sd.strokeNum + 1} — còn ${sd.strokesRemaining} nét` : "", "ok");
    },
    onComplete: (sum) => {
      board.results[ch] = sum.totalMistakes;
      msg(sum.totalMistakes === 0 ? `🎉 Viết đúng hết chữ ${ch}!` : `Xong chữ ${ch} — ${sum.totalMistakes} lần sai. Viết lại cho thuộc nhé.`, "ok");
      setProgress((p) => p, { activity: true, silent: true, xp: sum.totalMistakes === 0 ? XP.writeCharPerfect : XP.writeChar });
      const btn = document.querySelector(`.write-char[data-w-go="${board.i}"]`);
      btn?.classList.add(sum.totalMistakes === 0 ? "perfect" : "done");
    },
  });
}

// ---------- Phiếu in ----------
const sheet: WorksheetOptions & { pinyin: boolean; order: boolean } = { ...DEFAULT_WORKSHEET, pinyin: true, order: true };

export const worksheetPage = () => `<div id="sheet-root"><p class="muted">Đang tạo phiếu…</p></div>`;

export async function mountWorksheet(rest: string) {
  const el = document.getElementById("sheet-root");
  if (!el || !state.vocab) return;
  await loadLessons();
  const t = parseTarget(rest);
  const lesson = t.lessonId ? state.lessons?.lessons.find((l) => l.id === t.lessonId) : undefined;
  const chars = t.chars ? [...new Set(t.chars)] : lesson ? lessonChars(lesson, state.wordsById) : [];
  if (!chars.length) {
    el.innerHTML = `<div class="notice">Chưa chọn bài hoặc chữ để in. Mở một bài học rồi bấm “In PDF luyện viết”, hoặc <a href="#/luyen-tap/viet">luyện viết</a> rồi in.</div>`;
    return;
  }
  const datas = await Promise.all(chars.map((c) => loadChar(c).then((d) => d as unknown as StrokeJson).catch(() => null)));
  if (!document.getElementById("sheet-root")) return;
  const title = lesson ? lesson.title : `Chữ ${chars.join("")}`;
  const render = () => {
    const cells = worksheetCells(sheet);
    el.innerHTML = `
      <div class="no-print">
        <h1>🖨 Phiếu luyện viết · ${esc(title)}</h1>
        <p class="lead">Bấm <strong>In / Lưu PDF</strong> rồi chọn máy in “Lưu dưới dạng PDF” (Save as PDF). Khổ A4, lề mặc định.</p>
        <div class="toolbar row">
          <label class="row">Số dòng mỗi chữ <select id="s-rows">${[1, 2, 3, 4].map((n) => `<option ${n === sheet.rows ? "selected" : ""}>${n}</option>`).join("")}</select></label>
          <label class="row">Ô chữ mờ <select id="s-traced">${[0, 3, 5, 9].map((n) => `<option ${n === sheet.traced ? "selected" : ""}>${n}</option>`).join("")}</select></label>
          <label class="check"><input type="checkbox" id="s-pinyin" ${sheet.pinyin ? "checked" : ""}/> Pinyin & Hán Việt</label>
          <label class="check"><input type="checkbox" id="s-order" ${sheet.order ? "checked" : ""}/> Thứ tự nét</label>
          <button class="btn primary" id="s-print">🖨 In / Lưu PDF</button>
          <a class="btn" href="#/luyen-tap/viet/${t.chars ? `chu/${encodeURIComponent(t.chars)}` : encodeURIComponent(rest)}">✍️ Luyện viết trên máy</a>
        </div>
      </div>
      <article class="worksheet">
        <header class="ws-head"><strong>Luyện viết chữ Hán · ${esc(title)}</strong><span>Họ tên: ____________ Ngày: ________</span></header>
        ${chars
          .map((ch, k) => {
            const d = datas[k];
            const info = charInfo(ch, state.vocab!.words);
            const glyph = (cls: string) => (d ? glyphSvg(d, { className: cls }) : `<span class="ws-fallback ${cls}" lang="zh-CN">${esc(ch)}</span>`);
            return `<section class="ws-char">
              <div class="ws-meta">
                <span class="ws-ch" lang="zh-CN">${esc(ch)}</span>
                ${sheet.pinyin ? `<span>${esc(info.pinyin ?? "")}${info.hanViet ? ` · ${esc(info.hanViet)}` : ""}</span>` : ""}
                ${d ? `<span class="muted">${d.strokes.length} nét</span>` : ""}
                ${
                  sheet.order && d
                    ? `<span class="ws-order">${d.strokes
                        .map((_, i) => glyphSvg(d, { upto: i + 1, className: "ws-step", lastClass: "ws-new" }))
                        .join("")}</span>`
                    : ""
                }
              </div>
              ${cells
                .map(
                  (row) => `<div class="ws-row" style="--cols:${sheet.cols}">${row
                    .map((kind) => `<div class="ws-cell">${miziGridSvg("ws-grid")}${kind === "model" ? glyph("ws-model") : kind === "trace" ? glyph("ws-trace") : ""}</div>`)
                    .join("")}</div>`,
                )
                .join("")}
            </section>`;
          })
          .join("")}
        <footer class="ws-foot">Dữ liệu nét: Make Me a Hanzi (Arphic Public License) · Học Tiếng Trung</footer>
      </article>`;
    const num = (id: string) => Number(el.querySelector<HTMLSelectElement>(id)!.value);
    el.querySelector("#s-rows")!.addEventListener("change", () => ((sheet.rows = num("#s-rows")), render()));
    el.querySelector("#s-traced")!.addEventListener("change", () => ((sheet.traced = num("#s-traced")), render()));
    el.querySelector("#s-pinyin")!.addEventListener("change", (e) => ((sheet.pinyin = (e.target as HTMLInputElement).checked), render()));
    el.querySelector("#s-order")!.addEventListener("change", (e) => ((sheet.order = (e.target as HTMLInputElement).checked), render()));
    el.querySelector("#s-print")!.addEventListener("click", () => window.print());
  };
  render();
}
