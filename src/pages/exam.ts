// Thi thử (#/thi-thu, #/thi-thu/<examId>). Mọi cấu trúc/thời gian lấy từ src/config/exams.ts.
// Luật phần Nghe: mỗi câu tự phát `playsPerItem` lần, KHÔNG nghe lại, tự chuyển câu; hết phần Nghe có
// `reviewSeconds` để sửa đáp án (không có âm thanh). Phần Đọc đếm ngược, hết giờ tự nộp.

import { getExamConfig, isListening, type ExamConfig, type ListeningTiming } from "../config/exams.ts";
import { allQuestions, applyWrongToSrs, formatClock, scoreExam, wrongWordIds, type ExamResult } from "../lib/exam.ts";
import { localDate } from "../lib/srs.ts";
import { setProgress, state } from "../state.ts";
import type { Exam, ExamOption, ExamQuestion, ExamSentence, ExamsFile } from "../types.ts";
import { esc, zhWord } from "../ui/html.ts";
import { resourceHint } from "../ui/resourceHint.ts";
import { speakAsync, stopSpeaking, ttsSupported, zhVoiceCount, type SpeakHandle } from "../ui/speech.ts";

let examsPromise: Promise<ExamsFile | null> | null = null;
export function loadExams(): Promise<ExamsFile | null> {
  examsPromise ??= fetch(`${import.meta.env.BASE_URL}data/exams/hsk1.json`)
    .then((r) => (r.ok ? (r.json() as Promise<ExamsFile>) : null))
    .catch(() => null);
  return examsPromise;
}

const LETTERS = ["A", "B", "C", "D"];

// ---------- Danh sách đề & cấu trúc ----------
export function examListPage(): string {
  return `<div id="exam-list"><p class="muted">Đang tải đề…</p></div>`;
}

function structureTable(c: ExamConfig): string {
  return `<div class="table-wrap"><table class="sandhi structure">
    <thead><tr><th>Phần thi</th><th>Phần</th><th>Dạng câu</th><th>Số câu</th></tr></thead><tbody>
    ${c.sections
      .map((s) =>
        s.parts
          .map(
            (p, i) => `<tr>${i === 0 ? `<td rowspan="${s.parts.length}"><strong>${esc(s.title)}</strong><br><span class="muted small">${
              isListening(s.timing) ? `~${s.timing.nominalMinutes} phút · nghe ${s.timing.playsPerItem} lần` : `${s.timing.minutes} phút`
            } · ${s.scoreMax} điểm</span></td>` : ""}
            <td>${esc(p.id)}</td><td class="wrap">${esc(p.instructionsVi)}</td><td>${p.count}</td></tr>`,
          )
          .join(""),
      )
      .join("")}
    </tbody></table></div>
    <p class="small">Tổng điểm <strong>${c.totalScore}</strong> · Đạt từ <strong>${c.passScore}</strong> điểm.</p>`;
}

export async function mountExamList() {
  const file = await loadExams();
  const el = document.getElementById("exam-list");
  if (!el) return;
  const std = state.progress.hskStandard;
  const config = getExamConfig(std, 1);
  const exams = (file?.exams ?? []).filter((e) => e.standard === std);
  const attempts = state.progress.examAttempts;
  el.innerHTML = `
    <h1>Thi thử HSK</h1>
    <p class="lead">Mô phỏng cấu trúc và thời gian của đề thật: phần Nghe tự phát (không nghe lại), phần Đọc đếm ngược, nộp bài là có điểm ngay. Câu sai tự đưa từ liên quan vào ôn tập.</p>
    ${
      config
        ? `<section class="card section">
            <h2>Cấu trúc đề HSK 1 — chuẩn ${esc(std)}</h2>
            ${structureTable(config)}
            ${config.verified ? "" : `<div class="notice small"><strong>Chưa đối chiếu với đề chính thức.</strong> ${config.notes.map(esc).join(" ")}</div>`}
          </section>`
        : `<div class="notice">Chưa có cấu trúc đề cho chuẩn ${esc(std)}.</div>`
    }
    <h2>Đề thi</h2>
    ${
      exams.length
        ? `<div class="grid">${exams
            .map((x) => {
              const mine = attempts.filter((a) => a.examId === x.id);
              const best = mine.length ? Math.max(...mine.map((a) => a.score)) : null;
              return `<div class="card">
                <h3>${esc(x.title)}</h3>
                <p>${allQuestions(x).length} câu · HSK ${esc(x.standard)} cấp ${x.level}</p>
                ${best !== null ? `<p class="small">Đã làm ${mine.length} lần · cao nhất <strong>${best}</strong>/${config?.totalScore ?? 200}</p>` : ""}
                <a class="btn primary" href="#/thi-thu/${esc(x.id)}">Vào thi</a>
              </div>`;
            })
            .join("")}</div>`
        : `<div class="notice">Chưa có đề cho chuẩn HSK ${esc(std)}. Đổi chuẩn ở trang chủ (đề hiện có: HSK 3.0).</div>`
    }
    ${
      attempts.length
        ? `<section class="section"><h2>Lịch sử</h2><div class="table-wrap"><table class="sandhi">
            <thead><tr><th>Ngày</th><th>Đề</th><th>Nghe</th><th>Đọc</th><th>Tổng</th></tr></thead><tbody>
            ${[...attempts]
              .reverse()
              .slice(0, 10)
              .map((a) => `<tr><td>${esc(a.date)}</td><td>${esc(a.examId)}</td><td>${a.sectionScores.listening ?? "–"}</td><td>${a.sectionScores.reading ?? "–"}</td><td><strong>${a.score}</strong></td></tr>`)
              .join("")}
            </tbody></table></div></section>`
        : ""
    }`;
}

// ---------- Phòng thi ----------
type Phase = "intro" | "listening" | "listening-review" | "reading" | "result";

interface Session {
  exam: Exam;
  config: ExamConfig;
  phase: Phase;
  answers: Record<string, number>;
  /** Vị trí câu đang nghe trong danh sách câu phần Nghe. */
  li: number;
  /** Hạn chót (Date.now()) của giai đoạn hiện tại. */
  deadline: number;
  token: number;
  handle: SpeakHandle | null;
  timers: number[];
  ticker: number | undefined;
  result: ExamResult | null;
  addedWords: number;
  onlyWrong: boolean;
  confirmSubmit: boolean;
}
let S: Session | null = null;

export function examRunPage(): string {
  return `<div id="exam-root" class="exam"><p class="muted">Đang tải đề…</p></div>`;
}

export async function mountExamRun(id: string) {
  cleanup();
  const file = await loadExams();
  const root = document.getElementById("exam-root");
  if (!root) return;
  const exam = file?.exams.find((x) => x.id === id);
  const config = exam && getExamConfig(exam.standard, exam.level);
  if (!exam || !config || !state.vocab) {
    root.innerHTML = state.vocab ? `<div class="notice">Không tìm thấy đề. <a href="#/thi-thu">Về danh sách</a></div>` : `<p class="muted">Đang tải dữ liệu…</p>`;
    return;
  }
  S = { exam, config, phase: "intro", answers: {}, li: 0, deadline: 0, token: 0, handle: null, timers: [], ticker: undefined, result: null, addedWords: 0, onlyWrong: false, confirmSubmit: false };
  render();
}

function cleanup() {
  if (!S) return;
  S.token++;
  S.timers.forEach((t) => window.clearTimeout(t));
  S.timers = [];
  window.clearInterval(S.ticker);
  S.handle?.cancel();
  stopSpeaking();
}

const listeningQs = () => S!.exam.sections.find((s) => s.id === "listening")?.parts.flatMap((p) => p.questions) ?? [];
const readingSection = () => S!.exam.sections.find((s) => s.id === "reading");
const sectionCfg = (id: string) => S!.config.sections.find((s) => s.id === id)!;
const partCfg = (pid: string) => S!.config.sections.flatMap((s) => s.parts).find((p) => p.id === pid)!;

function root() {
  return document.getElementById("exam-root");
}

function render() {
  const r = root();
  if (!r || !S) return;
  switch (S.phase) {
    case "intro":
      return renderIntro(r);
    case "listening":
      return renderListening(r);
    case "listening-review":
      return renderListeningReview(r);
    case "reading":
      return renderReading(r);
    case "result":
      return renderResult(r);
  }
}

function clockBar(label: string): string {
  return `<div class="exam-bar"><strong>${esc(S!.exam.title)}</strong><span class="muted">${esc(label)}</span>
    <span class="exam-clock" aria-live="off">${S!.deadline ? formatClock(S!.deadline - Date.now()) : ""}</span></div>`;
}

function startTicker(onTimeout: () => void) {
  window.clearInterval(S!.ticker);
  const token = S!.token;
  S!.ticker = window.setInterval(() => {
    if (!S || S.token !== token) return;
    const left = S.deadline - Date.now();
    const el = document.querySelector(".exam-clock");
    if (el) {
      el.textContent = formatClock(left);
      el.classList.toggle("urgent", left < 60_000);
    }
    if (left <= 0) {
      window.clearInterval(S.ticker);
      onTimeout();
    }
  }, 250);
}

function renderIntro(r: HTMLElement) {
  const c = S!.config;
  const lt = c.sections.find((s) => isListening(s.timing))?.timing as ListeningTiming | undefined;
  r.innerHTML = `
    <h1>${esc(S!.exam.title)}</h1>
    ${structureTable(c)}
    <div class="card section">
      <h2>Quy định</h2>
      <ul>
        ${lt ? `<li>Phần Nghe tự chạy: mỗi câu phát <strong>${lt.playsPerItem} lần</strong>, <strong>không nghe lại</strong>, có ${lt.answerSeconds} giây để chọn rồi tự chuyển câu.</li>` : ""}
        ${lt?.reviewSeconds ? `<li>Hết phần Nghe có ${Math.round(lt.reviewSeconds / 60)} phút để xem lại đáp án phần Nghe (không có âm thanh).</li>` : ""}
        <li>Phần Đọc có đồng hồ đếm ngược; hết giờ bài tự nộp.</li>
        <li>Câu bỏ trống tính là sai. Nộp bài xong có điểm ngay và xem lại từng câu.</li>
        <li>Phím tắt: <kbd>1</kbd>–<kbd>3</kbd> hoặc <kbd>A</kbd>–<kbd>C</kbd> để chọn đáp án ở phần Nghe.</li>
      </ul>
      ${
        ttsSupported()
          ? `<p class="small muted">Hãy bật loa / đeo tai nghe trước khi bắt đầu.</p>`
          : `<div class="notice small">Trình duyệt không có giọng đọc tiếng Trung — phần Nghe sẽ hiện lời thoại dạng chữ thay cho âm thanh (không giống thi thật).</div>`
      }
      <p><button class="btn primary big-btn" data-ex="start">Bắt đầu làm bài</button> <a class="btn" href="#/thi-thu">Quay lại</a></p>
    </div>`;
}

// ---------- Phần Nghe ----------
function optionHtml(q: ExamQuestion, o: ExamOption, i: number, opts: { selected?: boolean; reveal?: boolean; disabled?: boolean } = {}): string {
  const cls = [
    "btn option exam-opt",
    o.picture ? "pic" : "",
    opts.selected ? "selected" : "",
    opts.reveal && i === q.answer ? "correct" : "",
    opts.reveal && opts.selected && i !== q.answer ? "wrong" : "",
  ].join(" ");
  const body = o.picture
    ? `<span class="pic-emoji" aria-hidden="true">${o.picture}</span>`
    : o.text
      ? sentenceHtml(o.text)
      : esc(o.label ?? "");
  return `<button class="${cls}" data-q="${esc(q.id)}" data-a="${i}" ${opts.disabled ? "disabled" : ""} aria-pressed="${!!opts.selected}">
    <span class="opt-letter">${o.label ? "" : LETTERS[i]}</span>${body}</button>`;
}

/** Câu tiếng Trung, có pinyin trên chữ nếu đề in pinyin. Chỗ trống ＿ giữ nguyên. */
function sentenceHtml(s: ExamSentence, clickable = false): string {
  return `<span class="exam-zh" lang="zh-CN">${s.tokens
    .map((t, k) => {
      const inner = clickable && t.wordId ? zhWord(t.text, t.wordId) : esc(t.text);
      return S!.config.showPinyin && s.tokenPinyin[k] ? `<ruby>${inner}<rt>${esc(s.tokenPinyin[k])}</rt></ruby>` : inner;
    })
    .join("")}</span>`;
}

function transcriptHtml(q: ExamQuestion, clickable = false): string {
  const lines = (q.audio ?? []).map((a) => `<div>${a.speaker ? `<strong>${esc(a.speaker)}：</strong>` : ""}${sentenceHtml(a.line, clickable)}</div>`);
  if (q.question) lines.push(`<div><strong>问：</strong>${sentenceHtml(q.question, clickable)}</div>`);
  return `<div class="transcript">${lines.join("")}</div>`;
}

function questionBody(q: ExamQuestion, mode: "listen" | "read" | "review"): string {
  const sel = S!.answers[q.id];
  const reveal = mode === "review";
  const opts = q.options.map((o, i) => optionHtml(q, o, i, { selected: sel === i, reveal, disabled: reveal })).join("");
  const showTranscript = mode === "listen" && !ttsSupported();
  return `
    ${q.picture ? `<div class="exam-picture" aria-label="Hình">${q.picture}</div>` : ""}
    ${q.text ? `<div class="exam-text">${sentenceHtml(q.text, reveal)}</div>` : ""}
    ${q.question && q.text ? `<div class="exam-question">${sentenceHtml(q.question, reveal)}</div>` : ""}
    ${showTranscript ? transcriptHtml(q) : ""}
    <div class="exam-options ${q.options.some((o) => o.picture) ? "pics" : ""} ${q.kind === "judge-picture" ? "judge" : ""}">${opts}</div>`;
}

function startListening() {
  S!.phase = "listening";
  S!.li = 0;
  S!.deadline = 0; // phần Nghe chạy theo âm thanh, không đếm ngược
  playItem();
}

function renderListening(r: HTMLElement) {
  const qs = listeningQs();
  const q = qs[S!.li];
  const pc = partCfg(q.partId);
  r.innerHTML = `${clockBar(`Nghe · câu ${q.number}/${allQuestions(S!.exam).length}`)}
    <div class="card exam-q">
      <p class="part-label">${esc(pc.title)} — ${esc(pc.instructionsVi)}</p>
      <div class="q-num">${q.number}.</div>
      ${questionBody(q, "listen")}
      <div class="listen-status" aria-live="polite"></div>
      <div class="progress"><span class="answer-timer" style="width:0%"></span></div>
    </div>
    <p class="muted small center">Không thể nghe lại hoặc quay lại câu trước trong phần Nghe.</p>`;
}

function setListenStatus(msg: string) {
  const el = document.querySelector(".listen-status");
  if (el) el.textContent = msg;
}

const voiceFor = (speaker?: string) => (zhVoiceCount() >= 2 && speaker === "男" ? 1 : 0);

async function sayLine(text: string, speaker: string | undefined, token: number): Promise<boolean> {
  if (!ttsSupported()) return S?.token === token;
  const h = speakAsync(text, { voiceIndex: voiceFor(speaker), fallbackMs: 300 * [...text].length });
  S!.handle = h;
  try {
    await h.done;
  } catch {
    return false;
  }
  return S?.token === token;
}

const sleep = (ms: number, token: number) =>
  new Promise<boolean>((resolve) => {
    S!.timers.push(window.setTimeout(() => resolve(S?.token === token), ms));
  });

async function playItem() {
  if (!S) return;
  const token = S.token;
  const lt = sectionCfg("listening").timing as ListeningTiming;
  const qs = listeningQs();
  const q = qs[S.li];
  const first = S.li === 0 || qs[S.li - 1].partId !== q.partId;
  render();
  if (first) {
    setListenStatus(`${partCfg(q.partId).title}: ${partCfg(q.partId).instructionsVi}`);
    if (!(await sleep(2500, token))) return;
  }
  for (let play = 1; play <= lt.playsPerItem; play++) {
    setListenStatus(`🔊 Lần ${play}/${lt.playsPerItem}`);
    for (const a of q.audio ?? []) {
      if (!(await sayLine(a.line.zh, a.speaker, token))) return;
      if (!(await sleep(400, token))) return;
    }
    if (q.question) {
      if (!(await sleep(500, token))) return;
      if (!(await sayLine(q.question.zh, undefined, token))) return;
    }
    if (play < lt.playsPerItem && !(await sleep(lt.gapMs, token))) return;
  }
  // thời gian chọn đáp án
  setListenStatus(`Chọn đáp án — ${lt.answerSeconds} giây`);
  const bar = document.querySelector<HTMLElement>(".answer-timer");
  if (bar) {
    bar.style.transition = "none";
    bar.style.width = "0%";
    void bar.offsetWidth;
    bar.style.transition = `width ${lt.answerSeconds}s linear`;
    bar.style.width = "100%";
  }
  if (!(await sleep(lt.answerSeconds * 1000, token))) return;
  nextListening();
}

function nextListening() {
  if (!S) return;
  S.li++;
  if (S.li < listeningQs().length) return void playItem();
  const lt = sectionCfg("listening").timing as ListeningTiming;
  if (lt.reviewSeconds > 0) {
    S.phase = "listening-review";
    S.deadline = Date.now() + lt.reviewSeconds * 1000;
    render();
    startTicker(startReading);
  } else startReading();
}

function renderListeningReview(r: HTMLElement) {
  const qs = listeningQs();
  r.innerHTML = `${clockBar("Xem lại phần Nghe")}
    <div class="notice small">Hết phần Nghe. Bạn có thể sửa đáp án phần Nghe (không có âm thanh). Hết giờ sẽ tự sang phần Đọc.</div>
    ${qs.map((q) => `<div class="card exam-q compact"><div class="q-num">${q.number}.</div>${questionBody(q, "read")}</div>`).join("")}
    <p class="center"><button class="btn primary" data-ex="to-reading">Sang phần Đọc →</button></p>`;
}

// ---------- Phần Đọc ----------
function startReading() {
  if (!S) return;
  cleanupTimersOnly();
  const rs = sectionCfg("reading").timing;
  S.phase = "reading";
  S.deadline = Date.now() + (isListening(rs) ? 0 : rs.minutes * 60_000);
  render();
  window.scrollTo(0, 0);
  startTicker(() => submit());
}

function cleanupTimersOnly() {
  if (!S) return;
  S.timers.forEach((t) => window.clearTimeout(t));
  S.timers = [];
  window.clearInterval(S.ticker);
}

function renderReading(r: HTMLElement) {
  const sec = readingSection()!;
  const qs = sec.parts.flatMap((p) => p.questions);
  const unanswered = qs.filter((q) => S!.answers[q.id] === undefined).length;
  r.innerHTML = `${clockBar("Đọc")}
    <nav class="q-nav" aria-label="Danh sách câu">${qs
      .map((q) => `<a href="#q-${esc(q.id)}" class="${S!.answers[q.id] !== undefined ? "done" : ""}" data-jump="${esc(q.id)}">${q.number}</a>`)
      .join("")}</nav>
    ${sec.parts
      .map(
        (p) => `<section class="section">
          <h2>${esc(partCfg(p.id).title)} <span class="muted small">${esc(partCfg(p.id).instructionsVi)}</span></h2>
          ${p.questions.map((q) => `<div class="card exam-q" id="q-${esc(q.id)}"><div class="q-num">${q.number}.</div>${questionBody(q, "read")}</div>`).join("")}
        </section>`,
      )
      .join("")}
    <div class="center section">
      ${
        S!.confirmSubmit && unanswered
          ? `<div class="notice">Còn ${unanswered} câu chưa làm (tính là sai). Vẫn nộp?</div>
             <button class="btn" data-ex="cancel-submit">Làm tiếp</button> <button class="btn primary" data-ex="submit-now">Nộp bài</button>`
          : `<button class="btn primary big-btn" data-ex="submit">Nộp bài</button>`
      }
    </div>`;
}

// ---------- Nộp & kết quả ----------
function submit() {
  if (!S || S.phase === "result") return;
  cleanup();
  const result = scoreExam(S.exam, S.config, S.answers);
  const words = wrongWordIds(S.exam, result.wrongIds);
  const before = new Set(state.progress.cards.map((c) => c.wordId));
  S.addedWords = words.filter((id) => !before.has(id)).length;
  S.result = result;
  S.phase = "result";
  const exam = S.exam;
  setProgress(
    (p) => ({
      ...p,
      cards: applyWrongToSrs(p.cards, words, p.srsCardTypes, new Date()),
      examAttempts: [
        ...p.examAttempts,
        { examId: exam.id, date: localDate(new Date()), score: result.total, sectionScores: Object.fromEntries(result.sections.map((s) => [s.id, s.score])) },
      ],
    }),
    { activity: "exams", silent: true },
  );
  render();
  window.scrollTo(0, 0);
}

function renderResult(r: HTMLElement) {
  const R = S!.result!;
  const c = S!.config;
  const wrong = new Set(R.wrongIds);
  const words = wrongWordIds(S!.exam, R.wrongIds);
  const qs = allQuestions(S!.exam).filter((q) => !S!.onlyWrong || wrong.has(q.id));
  const titleOf = (id: string) => c.sections.find((s) => s.id === id)?.title ?? id;
  r.innerHTML = `
    <div class="card summary center">
      <h1>${R.passed ? "🎉 Đạt" : "Chưa đạt"}</h1>
      <div class="stat">${R.total}<span class="muted" style="font-size:1rem"> / ${R.totalMax} điểm (đạt từ ${c.passScore})</span></div>
      <div class="row center">${R.sections.map((s) => `<span class="badge ${s.score >= s.scoreMax * 0.6 ? "accent" : ""}">${esc(titleOf(s.id))}: ${s.score}/${s.scoreMax} (${s.correct}/${s.total} câu)</span>`).join("")}</div>
      ${
        words.length
          ? `<p>${words.length} từ liên quan tới câu sai đã được đưa vào <a href="#/on-tap">ôn tập</a>${S!.addedWords ? ` (${S!.addedWords} từ mới)` : ""}.</p>`
          : `<p>Không có câu sai 👏</p>`
      }
      <p class="small">${R.total / R.totalMax >= 0.8 ? "Điểm tốt — sẵn sàng thử đề mẫu chính thức:" : "Luyện thêm rồi thử đề mẫu chính thức khi đạt ≥ 80%:"}
        ${c.officialLinks.map((l) => `<a class="btn small" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ↗</a>`).join(" ")}</p>
      ${resourceHint(["exam"], "Gợi ý sau khi thi thử")}
      <div class="row center"><a class="btn" href="#/thi-thu">Về danh sách đề</a><button class="btn primary" data-ex="retry">Làm lại đề</button></div>
    </div>
    <div class="row review-head"><h2>Xem lại</h2>
      <label class="check"><input type="checkbox" data-ex="only-wrong" ${S!.onlyWrong ? "checked" : ""}/> Chỉ câu sai (${R.wrongIds.length})</label></div>
    ${qs
      .map((q) => {
        const yours = S!.answers[q.id];
        const ok = yours === q.answer;
        return `<div class="card exam-q review ${ok ? "ok" : "bad"}">
          <div class="q-num">${q.number}. ${ok ? "✅" : yours === undefined ? "⬜ bỏ trống" : "❌"} <span class="muted small">${esc(partCfg(q.partId).id)}</span></div>
          ${q.audio ? `<div class="row">${transcriptHtml(q, true)}<button class="btn icon-btn" data-ex="replay" data-qid="${esc(q.id)}" aria-label="Nghe lại câu ${q.number}">🔊</button></div>` : ""}
          ${questionBody(q, "review")}
          <p class="explain">💡 ${esc(q.explanationVi)}</p>
        </div>`;
      })
      .join("")}`;
}

// ---------- Sự kiện ----------
let installed = false;
export function installExamHandlers() {
  if (installed) return;
  installed = true;
  document.addEventListener("click", (e) => {
    if (!S || !root()) return;
    const t = e.target as HTMLElement;
    const opt = t.closest<HTMLElement>(".exam-opt[data-q]");
    if (opt && (S.phase === "listening" || S.phase === "listening-review" || S.phase === "reading")) {
      S.answers[opt.dataset.q!] = Number(opt.dataset.a);
      // chỉ cập nhật trạng thái nút, không vẽ lại (để không làm gián đoạn phần Nghe)
      opt.parentElement?.querySelectorAll(".exam-opt").forEach((b) => {
        b.classList.toggle("selected", b === opt);
        b.setAttribute("aria-pressed", String(b === opt));
      });
      document.querySelector(`.q-nav [data-jump="${CSS.escape(opt.dataset.q!)}"]`)?.classList.add("done");
      return;
    }
    const act = t.closest<HTMLElement>("[data-ex]")?.dataset.ex;
    switch (act) {
      case "start":
        return startListening();
      case "to-reading":
        return startReading();
      case "submit": {
        const sec = readingSection()!;
        const answers = S.answers;
        const left = sec.parts.flatMap((p) => p.questions).some((q) => answers[q.id] === undefined);
        if (left) {
          S.confirmSubmit = true;
          return render();
        }
        return submit();
      }
      case "submit-now":
        return submit();
      case "cancel-submit":
        S.confirmSubmit = false;
        return render();
      case "retry":
        return void mountExamRun(S.exam.id);
      case "replay": {
        const q = allQuestions(S.exam).find((x) => x.id === t.closest<HTMLElement>("[data-qid]")!.dataset.qid);
        if (!q) return;
        const token = ++S.token;
        (async () => {
          for (const a of q.audio ?? []) if (!(await sayLine(a.line.zh, a.speaker, token))) return;
          if (q.question) await sayLine(q.question.zh, undefined, token);
        })();
        return;
      }
    }
    const jump = t.closest<HTMLElement>("[data-jump]");
    if (jump) {
      e.preventDefault();
      document.getElementById(`q-${jump.dataset.jump}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
  document.addEventListener("change", (e) => {
    const cb = (e.target as HTMLElement).closest<HTMLInputElement>('[data-ex="only-wrong"]');
    if (cb && S) {
      S.onlyWrong = cb.checked;
      render();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (!S || !root() || S.phase !== "listening" || document.querySelector("dialog[open]")) return;
    const map: Record<string, number> = { "1": 0, "2": 1, "3": 2, a: 0, b: 1, c: 2 };
    const i = map[e.key.toLowerCase()];
    if (i === undefined) return;
    const btn = document.querySelectorAll<HTMLElement>(".exam-q .exam-opt")[i];
    if (btn) {
      e.preventDefault();
      btn.click();
    }
  });
  window.addEventListener("hashchange", () => {
    if (!location.hash.startsWith("#/thi-thu/")) cleanup();
  });
}
