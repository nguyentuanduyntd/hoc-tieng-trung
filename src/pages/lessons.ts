// Lộ trình bài học (#/bai-hoc) + trình chạy bài (#/bai-hoc/<id>) + thi vượt (#/bai-hoc/thi-vuot/<unit>).
// Phím: 1–4 chọn đáp án, Enter = kiểm tra / tiếp tục, Space = nghe lại.

import { getLevelInfo } from "../config/hsk.ts";
import { XP } from "../lib/xp.ts";
import { checkAnswer, shuffle, type Response } from "../lib/grading.ts";
import { completeUnit, findCheckpoint, isUnlocked, lessonOrder, nextLesson, passed, unitProgress } from "../lib/lessons.ts";
import { applyTone } from "../lib/pinyin.ts";
import { addWordCards } from "../lib/srs.ts";
import { TONE_MARKS } from "../lib/tones.ts";
import { loadLessons, setProgress, state } from "../state.ts";
import { loadReadings } from "./reading.ts";
import type { Checkpoint, Exercise, Lesson, Unit, Word } from "../types.ts";
import { esc, zhTokens, zhWord } from "../ui/html.ts";
import { resourceHint } from "../ui/resourceHint.ts";
import { speak, ttsSupported } from "../ui/speech.ts";
import { mountSpeakWidget } from "../ui/speakWidget.ts";
import { mountStrokeAnimation, mountWritingQuiz } from "../ui/strokes.ts";

// ---------- Danh sách lộ trình ----------

export function lessonsListPage(): string {
  return `<div id="lessons-root"><p class="muted">Đang tải lộ trình…</p></div>`;
}

export async function mountLessonsList() {
  const [file, readings] = await Promise.all([loadLessons(), loadReadings()]);
  const root = document.getElementById("lessons-root");
  if (!root) return;
  if (!file) {
    root.innerHTML = `<div class="notice">Không tải được dữ liệu bài học.</div>`;
    return;
  }
  const done = state.progress.completedLessonIds;
  const next = nextLesson(file, done);
  const lessonById = new Map(file.lessons.map((l) => [l.id, l]));
  // số thứ tự bài liên tục qua các unit (checkpoint đặt sau bài 3, 6, 9…)
  const globalNo = new Map(lessonOrder(file).map((id, i) => [id, i + 1]));
  const cpAfter = new Map((file.checkpoints ?? []).map((c) => [c.lessonIds[c.lessonIds.length - 1], c]));
  const checkpointRow = (c: Checkpoint) => {
    const open = isUnlocked(file, c.id, done);
    const isDone = done.includes(c.id);
    const from = globalNo.get(c.lessonIds[0]);
    const to = globalNo.get(c.lessonIds[c.lessonIds.length - 1]);
    const inner = `<span class="lesson-num cp">${isDone ? "✓" : open ? "🏁" : "🔒"}</span>
      <span class="lesson-info"><strong>Checkpoint ${c.order}</strong>
      <span class="small">Ôn tập bài ${from}–${to} · đạt ≥ ${Math.round(c.passRatio * 100)}% để mở bài tiếp theo</span></span>
      ${c.id === next ? `<span class="badge accent">Tiếp theo</span>` : ""}`;
    return `<li>${
      open
        ? `<a class="card lesson-item checkpoint ${isDone ? "done" : ""} ${c.id === next ? "next" : ""}" href="#/bai-hoc/${c.id}">${inner}</a>`
        : `<div class="card lesson-item checkpoint locked" aria-disabled="true" title="Học xong các bài trước để mở">${inner}</div>`
    }</li>`;
  };
  root.innerHTML = `
    <h1>Lộ trình ${esc(getLevelInfo(state.progress.hskStandard, 1)?.label ?? "HSK 1")}</h1>
    <p class="lead">${file.units.length} unit · ${file.lessons.length} bài · ${(file.checkpoints ?? []).length} checkpoint. Mỗi bài 5–10 phút: từ mới → ngữ pháp → bài tập trộn → tổng kết (từ mới tự vào ôn tập). Cứ 3 bài có một checkpoint ôn tập. Bài mở lần lượt; đã biết rồi thì “thi vượt” cả unit.</p>
    ${pinyinHint()}
    ${file.units
      .map((u) => {
        const pr = unitProgress(u, done);
        return `<section class="section">
          <div class="unit-head">
            <h2>Unit ${u.unit}: ${esc(u.title)}</h2>
            <div class="row"><span class="badge">${pr.done}/${pr.total} bài</span>
              ${pr.done < pr.total ? `<a class="btn small" href="#/bai-hoc/thi-vuot/${u.unit}">⚡ Thi vượt</a>` : `<span class="badge accent">✓ Hoàn thành</span>`}</div>
          </div>
          <div class="progress" aria-hidden="true"><span style="width:${(pr.done / pr.total) * 100}%"></span></div>
          ${(() => {
            const rs = (readings?.readings ?? []).filter((x) => x.unit === u.unit);
            return rs.length
              ? `<p class="small unit-readings">📖 Bài đọc cùng chủ đề: ${rs.map((x) => `<a href="#/doc/${x.id}" lang="zh-CN">${esc(x.titleZh ?? "")}</a> <span class="muted">(${esc(x.title)})</span>`).join(" · ")}</p>`
              : "";
          })()}
          <ol class="lesson-list">
            ${u.lessonIds
              .map((id) => {
                const l = lessonById.get(id)!;
                const open = isUnlocked(file, id, done);
                const isDone = done.includes(id);
                const words = l.newWordIds.map((w) => state.wordsById.get(w)?.hanzi ?? "").join(" · ");
                const inner = `<span class="lesson-num">${isDone ? "✓" : open ? globalNo.get(id) : "🔒"}</span>
                  <span class="lesson-info"><strong>${esc(l.title)}</strong>
                  <span class="muted small" lang="zh-CN">${esc(words)}</span>
                  ${l.grammar ? `<span class="small">Ngữ pháp: ${esc(l.grammar.pattern)}</span>` : ""}</span>
                  ${id === next ? `<span class="badge accent">Tiếp theo</span>` : ""}`;
                return `<li>${
                  open
                    ? `<a class="card lesson-item ${isDone ? "done" : ""} ${id === next ? "next" : ""}" href="#/bai-hoc/${id}">${inner}</a>`
                    : `<div class="card lesson-item locked" aria-disabled="true" title="Học xong bài trước để mở">${inner}</div>`
                }</li>${cpAfter.has(id) ? checkpointRow(cpAfter.get(id)!) : ""}`;
              })
              .join("")}
          </ol>
        </section>`;
      })
      .join("")}`;
}

// ---------- Trình chạy bài ----------

type Phase = "words" | "grammar" | "exercises" | "summary";

interface Item {
  ex: Exercise;
  /** Lượt làm lại (bài sai được đưa xuống cuối hàng một lần). */
  retry: boolean;
}

interface Run {
  mode: "lesson" | "skip" | "checkpoint";
  /** Tham số route (để làm lại). */
  param: string;
  lesson?: Lesson;
  unit?: Unit;
  checkpoint?: Checkpoint;
  phase: Phase;
  queue: Item[];
  pos: number;
  total: number;
  firstTryCorrect: number;
  skipped: number;
  /** Đã chấm câu hiện tại chưa (đang hiện phản hồi). */
  checked: boolean;
  lastCorrect: boolean;
  /** Dữ liệu tạm cho câu hiện tại. */
  order: string[];
  tiles: { text: string; used: boolean }[];
  options: string[];
  /** Phương án người học đã chọn (để tô màu sai). */
  picked?: string;
  /** Đã chuẩn bị câu hiện tại (trộn phương án, phát âm) chưa. */
  prepared: boolean;
}

let run: Run | null = null;

export function lessonPlayerPage(): string {
  return `<div id="player-root" class="player"><p class="muted">Đang tải bài…</p></div>`;
}

export async function mountLessonPlayer(param: string) {
  const file = await loadLessons();
  const root = document.getElementById("player-root");
  if (!root) return;
  if (!file || !state.vocab) {
    root.innerHTML = `<div class="notice">Đang tải dữ liệu… <a href="#/bai-hoc">Quay lại lộ trình</a></div>`;
    return;
  }
  const skipMatch = /^thi-vuot\/(\d+)$/.exec(param);
  if (skipMatch) {
    const unit = file.units.find((u) => u.unit === Number(skipMatch[1]));
    if (!unit) return void (root.innerHTML = `<div class="notice">Không có unit này.</div>`);
    run = newRun("skip", unit.skipTest, { unit }, param);
    run.phase = "exercises";
  } else if (findCheckpoint(file, param)) {
    const checkpoint = findCheckpoint(file, param)!;
    if (!isUnlocked(file, checkpoint.id, state.progress.completedLessonIds))
      return void (root.innerHTML = `<div class="notice">Checkpoint này chưa mở — học xong 3 bài trước đó. <a href="#/bai-hoc">Quay lại lộ trình</a></div>`);
    run = newRun("checkpoint", checkpoint.exercises, { checkpoint }, param);
    run.phase = "exercises";
  } else {
    const lesson = file.lessons.find((l) => l.id === param);
    if (!lesson) return void (root.innerHTML = `<div class="notice">Không tìm thấy bài. <a href="#/bai-hoc">Quay lại lộ trình</a></div>`);
    if (!isUnlocked(file, lesson.id, state.progress.completedLessonIds))
      return void (root.innerHTML = `<div class="notice">Bài này chưa mở — học xong bài hoặc checkpoint trước đó, hoặc thi vượt cả unit. <a href="#/bai-hoc">Quay lại lộ trình</a></div>`);
    run = newRun("lesson", lesson.exercises, { lesson }, param);
  }
  render();
}

function newRun(mode: Run["mode"], exercises: Exercise[], ctx: { lesson?: Lesson; unit?: Unit; checkpoint?: Checkpoint }, param: string): Run {
  return {
    mode,
    param,
    ...ctx,
    phase: "words",
    queue: exercises.map((ex) => ({ ex, retry: false })),
    pos: 0,
    total: exercises.length,
    firstTryCorrect: 0,
    skipped: 0,
    checked: false,
    lastCorrect: false,
    order: [],
    tiles: [],
    options: [],
    prepared: false,
  };
}

const word = (id: string): Word | undefined => state.wordsById.get(id);
const root = () => document.getElementById("player-root");

function header(): string {
  if (!run) return "";
  const title =
    run.mode === "skip"
      ? `Thi vượt Unit ${run.unit!.unit}`
      : run.mode === "checkpoint"
        ? `Checkpoint ${run.checkpoint!.order}`
        : `Unit ${run.lesson!.unit} · Bài ${run.lesson!.order}: ${run.lesson!.title}`;
  const doneCount = run.queue.slice(0, run.pos).filter((i) => !i.retry).length;
  const pct = run.phase === "exercises" ? (doneCount / run.total) * 100 : run.phase === "summary" ? 100 : 0;
  return `<div class="player-head">
    <a class="btn icon-btn" href="#/bai-hoc" aria-label="Thoát bài">✕</a>
    <div class="progress grow" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
    <span class="muted small">${esc(title)}</span>
  </div>`;
}

function render() {
  const r = root();
  if (!r || !run) return;
  switch (run.phase) {
    case "words":
      return renderWords(r);
    case "grammar":
      return renderGrammar(r);
    case "exercises":
      return renderExercise(r);
    case "summary":
      return renderSummary(r);
  }
}

/** Gợi ý Lộ trình Pinyin cho người mới (chưa xong bài nào của HSK 1). */
function pinyinHint(): string {
  const p = state.progress;
  const pyDone = Object.values(p.pinyinCourse).filter((x) => x.best >= 0.8).length;
  // đã học khá xa mà chưa học Pinyin: chỉ một dòng nhỏ, không chiếm chỗ
  if (p.completedLessonIds.length > 3 && pyDone === 0)
    return `<p class="small muted">🔤 Cần ôn phát âm? <a href="#/pinyin">Lộ trình Pinyin</a> — thanh điệu, thanh mẫu, vận mẫu.</p>`;
  return `<div class="card section py-hint"><strong>🔤 Lộ trình Pinyin${pyDone ? ` — đã xong ${pyDone} bài` : ""}</strong>
    <p class="small">${pyDone ? "Ôn lại thanh điệu, thanh mẫu, vận mẫu khi cần." : "Mới bắt đầu? Học pinyin trước (9 bài ngắn: thanh điệu, thanh mẫu, vận mẫu, biến điệu, quy tắc viết) rồi vào bài 1."}</p>
    <a class="btn small ${pyDone ? "" : "primary"}" href="#/pinyin">${pyDone ? "Mở Lộ trình Pinyin" : "Học Pinyin trước"}</a></div>`;
}

function renderWords(r: HTMLElement) {
  const l = run!.lesson!;
  r.innerHTML = `${header()}
    <h1>Từ mới</h1>
    <p class="muted">Bấm vào chữ để xem chi tiết và thứ tự nét. Nghe và đọc to từng từ.</p>
    <div class="row lesson-tools">
      <a class="btn small" href="#/luyen-tap/viet/${encodeURIComponent(l.id)}">✍️ Luyện viết chữ của bài</a>
      <a class="btn small" href="#/luyen-tap/in/${encodeURIComponent(l.id)}">🖨 In PDF luyện viết</a>
    </div>
    <div class="word-list">
      ${l.newWordIds
        .map((id) => {
          const w = word(id)!;
          return `<article class="card word">
            <div class="hanzi">${zhWord(w.hanzi, w.id)}</div>
            <div><div class="pinyin">${esc(w.pinyin)}</div><div class="hv">${esc(w.hanViet ?? "")}</div><div class="meaning">${esc(w.meaningVi)}</div></div>
            <button class="btn icon-btn" data-speak="${esc(w.hanzi)}" aria-label="Phát âm ${esc(w.hanzi)}">🔊</button>
          </article>`;
        })
        .join("")}
    </div>
    <div class="player-foot"><button class="btn primary" data-next>${l.grammar ? "Tiếp: Ngữ pháp" : "Bắt đầu luyện tập"} <kbd>Enter</kbd></button></div>`;
}

function renderGrammar(r: HTMLElement) {
  const g = run!.lesson!.grammar!;
  r.innerHTML = `${header()}
    <h1>Ngữ pháp</h1>
    <div class="card grammar">
      <div class="pattern" lang="zh-CN">${esc(g.pattern)}</div>
      <p>${esc(g.explanationVi)}</p>
      ${g.examples
        .map(
          (e) => `<div class="example">
            <div class="ex-zh">${e.tokens ? zhTokens(e.tokens) : esc(e.zh)} <button class="btn icon-btn small" data-speak="${esc(e.zh)}" aria-label="Nghe câu">🔊</button></div>
            <div class="ex-py">${esc(e.pinyin)}</div><div class="ex-vi">${esc(e.vi)}</div></div>`,
        )
        .join("")}
    </div>
    <div class="player-foot"><button class="btn primary" data-next>Bắt đầu luyện tập <kbd>Enter</kbd></button></div>`;
}

const optionKey = (i: number) => `<kbd>${i + 1}</kbd>`;

function renderExercise(r: HTMLElement) {
  const it = run!.queue[run!.pos];
  if (!it) {
    run!.phase = "summary";
    return finishRun(r);
  }
  const ex = it.ex;
  if (!run!.prepared) prepare(ex);
  let body = "";
  const opts = run!.options;
  const disabled = run!.checked ? "disabled" : "";
  switch (ex.type) {
    case "choose-meaning": {
      const w = word(ex.prompt.wordId)!;
      body = `<p class="q-title">Chọn nghĩa đúng</p>
        <div class="q-hanzi" lang="zh-CN">${esc(w.hanzi)} <button class="btn icon-btn" data-speak="${esc(w.hanzi)}" aria-label="Nghe">🔊</button></div>
        <div class="options">${opts.map((id, i) => `<button class="btn option ${optClass(ex, id)}" data-opt="${esc(id)}" ${disabled}>${optionKey(i)} ${esc(word(id)!.meaningVi)}</button>`).join("")}</div>`;
      break;
    }
    case "listen-choose-hanzi": {
      const w = word(ex.prompt.wordId)!;
      body = `<p class="q-title">Nghe và chọn chữ Hán</p>
        <div class="center">${
          ttsSupported()
            ? `<button class="btn primary big-btn" data-speak="${esc(w.hanzi)}">🔊 Nghe lại <kbd>Space</kbd></button>`
            : `<p class="notice small">Trình duyệt không phát được âm — đọc pinyin thay thế: <strong>${esc(w.pinyin)}</strong></p>`
        }</div>
        <div class="options hanzi-options">${opts.map((id, i) => `<button class="btn option ${optClass(ex, id)}" data-opt="${esc(id)}" ${disabled} lang="zh-CN">${optionKey(i)} <span class="zh">${esc(word(id)!.hanzi)}</span></button>`).join("")}</div>`;
      break;
    }
    case "fill-blank": {
      const toks = ex.prompt.sentence.tokens
        .map((t, i) => (i === ex.prompt.blankIndex ? `<span class="blank">${run!.checked ? esc(t.text) : "＿＿"}</span>` : `<span lang="zh-CN">${esc(t.text)}</span>`))
        .join("");
      body = `<p class="q-title">Chọn từ điền vào chỗ trống</p>
        <div class="q-sentence">${toks}</div>
        <p class="muted">${esc(ex.prompt.sentence.vi)}</p>
        <div class="options hanzi-options">${opts.map((id, i) => `<button class="btn option ${optClass(ex, id)}" data-opt="${esc(id)}" ${disabled} lang="zh-CN">${optionKey(i)} <span class="zh">${esc(word(id)!.hanzi)}</span></button>`).join("")}</div>`;
      break;
    }
    case "choose-tone": {
      const w = word(ex.prompt.wordId)!;
      body = `<p class="q-title">Nghe và chọn thanh điệu</p>
        <div class="q-hanzi" lang="zh-CN">${esc(w.hanzi)}</div>
        <div class="center"><button class="btn big-btn" data-speak="${esc(w.hanzi)}">🔊 Nghe <kbd>Space</kbd></button></div>
        <div class="options tone-options">${[1, 2, 3, 4]
          .map((t, i) => `<button class="btn option ${optClass(ex, String(t))}" data-opt="${t}" ${disabled}>${optionKey(i)} <strong>${esc(applyTone(ex.prompt.toneless, t))}</strong> <span class="muted">${TONE_MARKS[t]}</span></button>`)
          .join("")}</div>`;
      break;
    }
    case "order-words": {
      const last = ex.prompt.sentence.tokens[ex.prompt.sentence.tokens.length - 1];
      const punct = last && !last.wordId ? last.text : "";
      body = `<p class="q-title">Sắp xếp thành câu đúng</p>
        <p class="q-vi">${esc(ex.prompt.sentence.vi)}</p>
        <div class="answer-line" lang="zh-CN">${run!.order.map((t, i) => `<button class="btn tile" data-unpick="${i}" ${disabled}>${esc(t)}</button>`).join("")}<span class="punct">${esc(punct)}</span></div>
        <div class="tiles" lang="zh-CN">${run!.tiles.map((t, i) => `<button class="btn tile" data-pick="${i}" ${t.used || run!.checked ? "disabled" : ""}>${esc(t.text)}</button>`).join("")}</div>`;
      break;
    }
    case "match-pairs":
      body = `<p class="q-title">Ghép chữ Hán với nghĩa</p><div class="match" id="match"></div>`;
      break;
    case "write-stroke": {
      const w = word(ex.prompt.wordId)!;
      body = `<p class="q-title">Viết chữ <span class="zh">${esc(ex.prompt.char)}</span> theo đúng thứ tự nét</p>
        <p class="center muted">${esc(w.hanzi)} · ${esc(w.pinyin)} · ${esc(w.meaningVi)}</p>
        <div class="row center"><div class="stroke-demo"></div></div>
        <div class="quiz-area"></div>
        <p class="center small muted">Xem hoạt ảnh mẫu rồi viết lại vào khung lớn. Sai 2 lần ở một nét sẽ có gợi ý.</p>`;
      break;
    }
    case "speak":
      body = `<p class="q-title">Nói theo câu mẫu</p><div class="speak-box"></div>`;
      break;
  }

  const needsCheck = ex.type === "order-words";
  r.innerHTML = `${header()}
    ${it.retry ? `<p class="badge warn">Làm lại câu sai</p>` : ""}
    <div class="card exercise">${body}</div>
    <div class="player-foot">${feedback(ex)}${
      run!.checked
        ? `<button class="btn primary" data-continue>Tiếp tục <kbd>Enter</kbd></button>`
        : needsCheck
          ? `<button class="btn primary" data-check ${run!.order.length === run!.tiles.length ? "" : "disabled"}>Kiểm tra <kbd>Enter</kbd></button>`
          : ""
    }</div>`;

  if (!run!.checked) mountInteractive(r, ex);
}

function prepare(ex: Exercise) {
  run!.prepared = true;
  if ("options" in ex.prompt) run!.options = shuffle(ex.prompt.options as string[]);
  if (ex.type === "order-words") run!.tiles = ex.prompt.tiles.map((text) => ({ text, used: false }));
  run!.order = [];
  if (ex.type === "listen-choose-hanzi" || ex.type === "choose-tone") speak(word(ex.prompt.wordId)!.hanzi);
}

function optClass(ex: Exercise, id: string): string {
  if (!run!.checked) return "";
  if (String(ex.answer) === id) return "correct";
  return run!.picked === id ? "wrong" : "";
}

function feedback(ex: Exercise): string {
  if (!run!.checked) return "";
  if (run!.lastCorrect) return `<div class="feedback ok">✅ Chính xác!</div>`;
  let ans = "";
  switch (ex.type) {
    case "choose-meaning":
    case "listen-choose-hanzi":
    case "fill-blank": {
      const w = word(ex.answer)!;
      ans = `${zhWord(w.hanzi, w.id)} — ${esc(w.pinyin)} — ${esc(w.meaningVi)}`;
      break;
    }
    case "choose-tone":
      ans = `${esc(word(ex.prompt.wordId)!.pinyin)} (thanh ${ex.answer})`;
      break;
    case "order-words":
      ans = `${zhTokens(ex.prompt.sentence.tokens)} <span class="muted">${esc(ex.prompt.sentence.pinyin)}</span>`;
      break;
    default:
      ans = "";
  }
  return `<div class="feedback bad">❌ Chưa đúng.${ans ? ` Đáp án: ${ans}` : ""}${run!.mode === "lesson" ? " <span class='muted small'>(Câu này sẽ được hỏi lại.)</span>" : ""}</div>`;
}

function mountInteractive(r: HTMLElement, ex: Exercise) {
  if (ex.type === "match-pairs") mountMatch(r.querySelector<HTMLElement>("#match")!, ex);
  if (ex.type === "write-stroke") {
    mountStrokeAnimation(r.querySelector<HTMLElement>(".stroke-demo")!, ex.prompt.char, 90);
    mountWritingQuiz(r.querySelector<HTMLElement>(".quiz-area")!, ex.prompt.char, (mistakes) => grade({ type: "write-stroke", value: mistakes <= 3 ? ex.prompt.char : "" }), 220, { outline: true });
  }
  if (ex.type === "speak") {
    mountSpeakWidget(r.querySelector<HTMLElement>(".speak-box")!, ex.prompt.sentence, (res) => {
      if (res.score === null) {
        run!.skipped++;
        run!.pos++;
        resetItem();
        render();
      } else grade({ type: "speak", score: res.score });
    });
  }
}

function mountMatch(el: HTMLElement, ex: Extract<Exercise, { type: "match-pairs" }>) {
  const ids = ex.prompt.wordIds;
  const left = shuffle(ids);
  const right = shuffle(ids);
  let selected: string | null = null;
  let matched = new Set<string>();
  let mistakes = 0;
  el.innerHTML = `<div class="match-col">${left.map((id) => `<button class="btn tile zh-tile" data-l="${esc(id)}" lang="zh-CN">${esc(word(id)!.hanzi)}</button>`).join("")}</div>
    <div class="match-col">${right.map((id) => `<button class="btn tile" data-r="${esc(id)}">${esc(word(id)!.meaningVi)}</button>`).join("")}</div>`;
  el.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!b || b.disabled) return;
    if (b.dataset.l) {
      el.querySelectorAll("[data-l]").forEach((x) => x.classList.remove("selected"));
      selected = b.dataset.l;
      b.classList.add("selected");
      speak(word(selected)!.hanzi);
      return;
    }
    if (b.dataset.r && selected) {
      if (b.dataset.r === selected) {
        matched.add(selected);
        for (const x of el.querySelectorAll<HTMLButtonElement>(`[data-l="${CSS.escape(selected)}"], [data-r="${CSS.escape(selected)}"]`)) {
          x.disabled = true;
          x.classList.remove("selected");
          x.classList.add("correct");
        }
        selected = null;
        if (matched.size === ids.length) grade({ type: "match-pairs", mistakes });
      } else {
        mistakes++;
        b.classList.add("wrong");
        setTimeout(() => b.classList.remove("wrong"), 500);
      }
    }
  });
}

function grade(resp: Response) {
  const it = run!.queue[run!.pos];
  const ok = checkAnswer(it.ex, resp);
  run!.checked = true;
  run!.lastCorrect = ok;
  if ("value" in resp) run!.picked = String(resp.value);
  if (!it.retry && ok) run!.firstTryCorrect++;
  if (!ok && run!.mode === "lesson" && !it.retry) run!.queue.push({ ex: it.ex, retry: true });
  render();
}

function resetItem() {
  run!.checked = false;
  run!.lastCorrect = false;
  run!.options = [];
  run!.tiles = [];
  run!.order = [];
  run!.picked = undefined;
  run!.prepared = false;
}

function advance() {
  if (!run) return;
  if (run.phase === "words") {
    run.phase = run.lesson?.grammar ? "grammar" : "exercises";
  } else if (run.phase === "grammar") {
    run.phase = "exercises";
  } else if (run.phase === "exercises" && run.checked) {
    run.pos++;
    resetItem();
  } else if (run.phase === "exercises" && run.queue[run.pos]?.ex.type === "order-words" && run.order.length === run.tiles.length) {
    grade({ type: "order-words", value: run.order });
    return;
  } else return;
  render();
  window.scrollTo(0, 0);
}

function finishRun(r: HTMLElement) {
  const R = run!;
  const scored = R.total - R.skipped;
  if (R.mode === "lesson") {
    const l = R.lesson!;
    const first = !state.progress.completedLessonIds.includes(l.id);
    setProgress(
      (p) => ({
        ...p,
        completedLessonIds: p.completedLessonIds.includes(l.id) ? p.completedLessonIds : [...p.completedLessonIds, l.id],
        cards: l.newWordIds.reduce((cards, id, i) => addWordCards(cards, id, p.srsCardTypes, new Date(Date.now() + i)), p.cards),
      }),
      { activity: "lessons", silent: true, xp: first ? XP.lesson : 5 },
    );
  } else if (R.mode === "checkpoint") {
    const c = R.checkpoint!;
    if (passed(R.firstTryCorrect, scored, c.passRatio))
      setProgress(
        (p) => ({ ...p, completedLessonIds: p.completedLessonIds.includes(c.id) ? p.completedLessonIds : [...p.completedLessonIds, c.id] }),
        { activity: true, silent: true, xp: state.progress.completedLessonIds.includes(c.id) ? 5 : XP.checkpoint },
      );
  } else if (passed(R.firstTryCorrect, scored, R.unit!.passRatio)) {
    const u = R.unit!;
    const ids = state.lessons!.lessons.filter((l) => u.lessonIds.includes(l.id)).flatMap((l) => l.newWordIds);
    setProgress(
      (p) => ({
        ...p,
        completedLessonIds: completeUnit(u, p.completedLessonIds, state.lessons?.checkpoints ?? []),
        cards: ids.reduce((cards, id, i) => addWordCards(cards, id, p.srsCardTypes, new Date(Date.now() + i)), p.cards),
      }),
      { activity: "lessons", silent: true, xp: XP.skipUnit },
    );
  }
  renderSummary(r);
}

function renderSummary(r: HTMLElement) {
  const R = run!;
  const scored = R.total - R.skipped;
  const pct = scored ? Math.round((R.firstTryCorrect / scored) * 100) : 100;
  const file = state.lessons!;
  const nxt = nextLesson(file, state.progress.completedLessonIds);
  if (R.mode === "checkpoint") {
    const c = R.checkpoint!;
    const ok = passed(R.firstTryCorrect, scored, c.passRatio);
    const lessons = c.lessonIds.map((id) => file.lessons.find((l) => l.id === id)).filter((l): l is Lesson => !!l);
    r.innerHTML = `${header()}<div class="card summary center">
      <h1>${ok ? "🏁 Qua checkpoint!" : "Chưa đạt"}</h1>
      <div class="stat">${pct}%<span class="muted" style="font-size:1rem"> (cần ${Math.round(c.passRatio * 100)}%)</span></div>
      ${
        ok
          ? `<p>Bạn đã nắm chắc 3 bài vừa học. Bài tiếp theo đã mở.</p>`
          : `<p>Ôn lại các bài dưới đây rồi làm lại checkpoint nhé:</p>
             <p>${lessons.map((l) => `<a class="btn small" href="#/bai-hoc/${l.id}">Unit ${l.unit} · Bài ${l.order}: ${esc(l.title)}</a>`).join(" ")}</p>`
      }
      <div class="row center">
        <a class="btn" href="#/bai-hoc">Về lộ trình</a>
        <button class="btn ${ok ? "" : "primary"}" data-retry-run>↻ Làm lại</button>
        ${ok && nxt ? `<a class="btn primary" href="#/bai-hoc/${nxt}">Bài tiếp theo →</a>` : ""}
      </div></div>`;
    return;
  }
  if (R.mode === "skip") {
    const ok = passed(R.firstTryCorrect, scored, R.unit!.passRatio);
    r.innerHTML = `${header()}<div class="card summary center">
      <h1>${ok ? "⚡ Vượt qua!" : "Chưa đạt"}</h1>
      <div class="stat">${pct}%</div>
      <p>${ok ? `Đã mở toàn bộ Unit ${R.unit!.unit} và đưa từ vựng vào ôn tập.` : `Cần đạt ${Math.round(R.unit!.passRatio * 100)}% để thi vượt. Hãy học lần lượt từng bài nhé.`}</p>
      <div class="row center"><a class="btn" href="#/bai-hoc">Về lộ trình</a>${ok && nxt ? `<a class="btn primary" href="#/bai-hoc/${nxt}">Bài tiếp theo</a>` : ""}</div></div>`;
    return;
  }
  const l = R.lesson!;
  r.innerHTML = `${header()}<div class="card summary center">
    <h1>🎉 Xong bài!</h1>
    <div class="stat">${pct}%<span class="muted" style="font-size:1rem"> đúng ngay lần đầu</span></div>
    ${R.skipped ? `<p class="muted small">Bỏ qua ${R.skipped} câu nói (không tính điểm).</p>` : ""}
    <p>${l.newWordIds.length} từ mới đã được thêm vào <a href="#/on-tap">ôn tập</a>:</p>
    <p class="summary-words">${l.newWordIds.map((id) => zhWord(word(id)!.hanzi, id)).join(" ")}</p>
    <div class="row center">
      <a class="btn" href="#/bai-hoc">Về lộ trình</a>
      ${nxt ? `<a class="btn primary" href="#/bai-hoc/${nxt}">Bài tiếp theo →</a>` : `<a class="btn primary" href="#/on-tap">Ôn tập ngay</a>`}
    </div>
    ${resourceHint(["lesson"], l.grammar ? `Muốn nghe giảng thêm về “${l.grammar.pattern}” hoặc luyện thêm?` : "Luyện thêm")}
  </div>`;
}

// ---------- Sự kiện ----------
let installed = false;
export function installPlayerHandlers() {
  if (installed) return;
  installed = true;
  document.addEventListener("click", (e) => {
    if (!root() || !run) return;
    const t = e.target as HTMLElement;
    if (t.closest("[data-retry-run]")) return void mountLessonPlayer(run.param);
    if (t.closest("[data-next], [data-continue]")) return advance();
    if (t.closest("[data-check]")) return advance();
    const opt = t.closest<HTMLElement>("[data-opt]");
    if (opt && !run.checked) {
      const ex = run.queue[run.pos].ex;
      const v = opt.dataset.opt!;
      if (ex.type === "choose-tone") grade({ type: "choose-tone", value: Number(v) });
      else if (ex.type === "choose-meaning" || ex.type === "listen-choose-hanzi" || ex.type === "fill-blank") grade({ type: ex.type, value: v });
      return;
    }
    const pick = t.closest<HTMLElement>("[data-pick]");
    if (pick && !run.checked) {
      const tile = run.tiles[Number(pick.dataset.pick)];
      tile.used = true;
      run.order.push(tile.text);
      return render();
    }
    const unpick = t.closest<HTMLElement>("[data-unpick]");
    if (unpick && !run.checked) {
      const i = Number(unpick.dataset.unpick);
      const text = run.order.splice(i, 1)[0];
      const tile = run.tiles.find((x) => x.used && x.text === text);
      if (tile) tile.used = false;
      return render();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (!root() || !run || document.querySelector("dialog[open]")) return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.key === "Enter") {
      e.preventDefault();
      advance();
    } else if (/^[1-4]$/.test(e.key) && !run.checked) {
      const btn = document.querySelectorAll<HTMLButtonElement>("[data-opt]")[Number(e.key) - 1];
      if (btn) {
        e.preventDefault();
        btn.click();
      }
    } else if (e.key === " " && run.phase === "exercises") {
      const sp = document.querySelector<HTMLElement>(".exercise [data-speak]");
      if (sp) {
        e.preventDefault();
        speak(sp.dataset.speak!);
      }
    }
  });
}
