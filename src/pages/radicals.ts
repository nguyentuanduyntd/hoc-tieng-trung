// Bộ thủ (#/luyen-tap/bo-thu, /bo-thu/<bộ>, /bo-thu/luyen[/<nhóm|bộ>]) — SPEC 3.15.

import { RADICAL_PASS, buildRadicalQuiz, charsOf, isLearned, recordRadicalQuiz, topicProgress, type RadicalQuestion } from "../lib/radicals.ts";
import { XP } from "../lib/xp.ts";
import { localDate } from "../lib/srs.ts";
import { glyphSvg, type StrokeJson } from "../lib/writing.ts";
import { setProgress, state } from "../state.ts";
import type { RadicalEntry, RadicalsFile } from "../types.ts";
import { esc } from "../ui/html.ts";
import { speak } from "../ui/speech.ts";
import { loadChar, mountStrokeAnimation } from "../ui/strokes.ts";

let filePromise: Promise<RadicalsFile | null> | null = null;
function loadRadicals(): Promise<RadicalsFile | null> {
  filePromise ??= fetch(`${import.meta.env.BASE_URL}data/radicals.json`)
    .then((r) => (r.ok ? (r.json() as Promise<RadicalsFile>) : null))
    .catch(() => null);
  return filePromise;
}

const BASE = "#/luyen-tap/bo-thu";
const href = (rest = "") => `${BASE}${rest ? `/${rest.split("/").map(encodeURIComponent).join("/")}` : ""}`;
const root = () => document.getElementById("rad-root");

export const radicalsPage = () => `<div id="rad-root"><p class="muted">Đang tải bộ thủ…</p></div>`;

export async function mountRadicals(rest: string) {
  const file = await loadRadicals();
  const el = root();
  if (!el) return;
  if (!file) return void (el.innerHTML = `<div class="notice">Không tải được dữ liệu bộ thủ.</div>`);
  const [head, arg] = rest.split("/");
  if (!head) return renderHub(el, file);
  if (head === "luyen") return startQuiz(el, file, arg);
  const r = file.radicals.find((x) => x.id === head);
  if (!r) return void (el.innerHTML = `<div class="notice">Không có bộ thủ này. <a href="${href()}">Về danh sách</a></div>`);
  renderDetail(el, file, r);
}

// ---------- Tổng quan ----------
function renderHub(el: HTMLElement, file: RadicalsFile) {
  const prog = topicProgress(file, state.progress);
  const learnedAll = file.radicals.filter((r) => isLearned(state.progress, r.id)).length;
  el.innerHTML = `
    <h1>部 Bộ thủ</h1>
    <p class="lead">${file.radicals.length} bộ thủ thông dụng, chia theo chủ đề. Mỗi bộ có hình gốc và biến thể, nghĩa, Hán Việt, thứ tự nét, mẹo nhớ và chữ ví dụ. Luyện đạt từ ${Math.round(RADICAL_PASS * 100)}% là bộ đó được tính là đã thuộc.</p>
    <div class="row"><a class="btn primary" href="${href("luyen")}">🎲 Luyện ngẫu nhiên</a><span class="muted">Đã thuộc ${learnedAll}/${file.radicals.length} bộ</span></div>
    ${file.topics
      .map((t) => {
        const list = file.radicals.filter((r) => r.topic === t.id);
        const p = prog[t.id];
        const pct = p.total ? Math.round((p.learned / p.total) * 100) : 0;
        return `<section class="section rad-topic">
          <div class="row"><h2>${t.icon} ${esc(t.title)}</h2><span class="spacer"></span><a class="btn small" href="${href(`luyen/${t.id}`)}">Luyện nhóm này</a></div>
          <div class="progress" role="progressbar" aria-label="Tiến độ nhóm ${esc(t.title)}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
          <p class="small muted">${p.learned}/${p.total} bộ đã thuộc</p>
          <div class="rad-grid">${list
            .map(
              (r) => `<a class="rad-tile ${isLearned(state.progress, r.id) ? "learned" : ""}" href="${href(r.id)}">
                <span class="rad-form" lang="zh-CN">${esc(r.id)}${r.variants.length ? `<small>${r.variants.map(esc).join(" ")}</small>` : ""}</span>
                <span class="rad-name">${esc(r.hanViet)}</span><span class="rad-mean">${esc(r.meaningVi)}</span>
                ${isLearned(state.progress, r.id) ? `<span class="rad-check" aria-label="Đã thuộc">✓</span>` : ""}</a>`,
            )
            .join("")}</div>
        </section>`;
      })
      .join("")}`;
}

// ---------- Chi tiết một bộ ----------
function renderDetail(el: HTMLElement, file: RadicalsFile, r: RadicalEntry) {
  const topic = file.topics.find((t) => t.id === r.topic);
  const best = state.progress.radicals[r.id];
  const quizChars = charsOf(file, new Set([r.id])).length;
  el.innerHTML = `
    <p><a href="${href()}">← Bộ thủ</a> · ${topic ? `${topic.icon} ${esc(topic.title)}` : ""}</p>
    <div class="rad-head">
      <div class="rad-big" lang="zh-CN">${esc(r.id)}</div>
      <div>
        <h1>Bộ ${esc(r.hanViet)} <span class="muted">${esc(r.id)}</span></h1>
        <p><strong>${esc(r.meaningVi)}</strong></p>
        <p class="small">${r.forms.map((f) => `<span lang="zh-CN" class="rad-form-chip">${esc(f)}</span> ${r.strokes[f]} nét`).join(" · ")}${r.variants.length ? ` <span class="muted">(biến thể khi đứng trong chữ)</span>` : ""}</p>
        ${best ? `<p class="small">Luyện tốt nhất: <strong>${Math.round(best.best * 100)}%</strong> ${best.best >= RADICAL_PASS ? "✓ đã thuộc" : ""}</p>` : ""}
      </div>
    </div>
    <div class="card section">
      <h2>Thứ tự nét</h2>
      <div class="rad-strokes" id="rad-strokes"></div>
      <button class="btn small" id="rad-replay">▶ Xem lại</button>
    </div>
    <div class="card section"><h2>💡 Mẹo nhớ</h2><p>${esc(r.mnemonic)}</p></div>
    <section class="section">
      <h2>Chữ ví dụ</h2>
      <p class="small muted">Nét tô đỏ là bộ ${esc(r.hanViet)} trong chữ. Chữ có dấu ★ thuộc HSK 1 — bấm để mở từ điển; chữ khác mở bảng luyện viết.</p>
      <div class="rad-examples">${r.examples
        .map((e) => {
          const inner = `<span class="rad-ex-glyph" data-glyph="${esc(e.hanzi)}" lang="zh-CN">${esc(e.hanzi)}</span><span class="rad-ex-py">${esc(e.pinyin)}</span>${e.hsk1 ? `<span class="rad-ex-star" aria-label="HSK 1">★</span>` : ""}`;
          return e.wordId
            ? `<button class="rad-ex" data-word-id="${esc(e.wordId)}" data-zh="${esc(e.hanzi)}">${inner}</button>`
            : `<a class="rad-ex" href="#/luyen-tap/viet/chu/${encodeURIComponent(e.hanzi)}">${inner}</a>`;
        })
        .join("")}</div>
    </section>
    <div class="row section">
      ${quizChars ? `<a class="btn primary" href="${href(`luyen/${r.id}`)}">Luyện bộ này (${quizChars} chữ HSK 1)</a>` : `<span class="muted small">Chưa có chữ HSK 1 thuộc bộ này để luyện — xem chữ ví dụ ở trên.</span>`}
      <a class="btn" href="#/luyen-tap/viet/chu/${encodeURIComponent(r.drawable.join(""))}">🖌 Luyện viết bộ</a>
    </div>`;
  const replay = mountStrokeAnimation(el.querySelector<HTMLElement>("#rad-strokes")!, r.drawable.join(""), 110);
  el.querySelector("#rad-replay")!.addEventListener("click", replay);
  // tô nét của bộ trong chữ ví dụ HSK 1
  for (const box of el.querySelectorAll<HTMLElement>("[data-glyph]")) {
    const ch = box.dataset.glyph!;
    const rs = file.chars[ch]?.radStrokes;
    if (!rs) continue;
    void loadChar(ch).then((d) => {
      box.innerHTML = glyphSvg(d as unknown as StrokeJson, { className: "rad-glyph", highlight: rs, highlightClass: "rad-hl" });
    });
  }
  // ví dụ là từ một chữ: nút có data-word-id -> pop-up từ điển sẵn có (ui/popup.ts)
}

// ---------- Bài luyện ----------
interface Quiz {
  file: RadicalsFile;
  title: string;
  scope: string;
  qs: RadicalQuestion[];
  i: number;
  results: { q: RadicalQuestion; correct: boolean }[];
  chosen: string | null;
}
let quiz: Quiz | null = null;

function startQuiz(el: HTMLElement, file: RadicalsFile, arg?: string) {
  const topic = file.topics.find((t) => t.id === arg);
  const one = file.radicals.find((r) => r.id === arg);
  const ids = topic ? file.radicals.filter((r) => r.topic === topic.id).map((r) => r.id) : one ? [one.id] : file.radicals.map((r) => r.id);
  const title = topic ? `${topic.icon} ${topic.title}` : one ? `Bộ ${one.hanViet} ${one.id}` : "Ngẫu nhiên";
  const qs = buildRadicalQuiz(file, ids, one ? Math.min(6, Math.max(2, charsOf(file, new Set(ids)).length * 2)) : 8);
  if (!qs.length) return void (el.innerHTML = `<div class="notice">Chưa có chữ HSK 1 để luyện ở phần này. <a href="${href()}">Về danh sách</a></div>`);
  quiz = { file, title, scope: arg ?? "", qs, i: 0, results: [], chosen: null };
  renderQuestion(el);
}

const radicalLabel = (file: RadicalsFile, id: string) => {
  const r = file.radicals.find((x) => x.id === id)!;
  return `<span class="rad-opt-form" lang="zh-CN">${esc(r.forms.join(" "))}</span><span class="rad-opt-name">${esc(r.hanViet)} · ${esc(r.meaningVi)}</span>`;
};

function renderQuestion(el: HTMLElement) {
  const Q = quiz!;
  const q = Q.qs[Q.i];
  const done = Q.chosen !== null;
  const correct = done && Q.chosen === q.answer;
  const info = Q.file.chars[q.char];
  const prompt =
    q.kind === "identify"
      ? `<p class="muted">Chữ này thuộc bộ thủ nào?</p><div class="rad-q-char" id="rad-q-glyph" lang="zh-CN">${esc(q.char)}</div>`
      : `<p class="muted">Bộ <strong lang="zh-CN">${esc(q.form)}</strong> ghép với phần còn lại này thành chữ nào?</p>
         <div class="rad-compose"><div class="rad-q-box" id="rad-q-form" lang="zh-CN">${esc(q.form)}</div><span class="rad-plus">+</span><div class="rad-q-box" id="rad-q-rest"></div></div>`;
  el.innerHTML = `
    <div class="row review-head"><h1>部 Luyện bộ thủ · ${esc(Q.title)}</h1><a class="btn small" href="${href()}">Thoát</a></div>
    <div class="progress"><span style="width:${(Q.i / Q.qs.length) * 100}%"></span></div>
    <div class="card section rad-quiz">
      <div class="q-num">Câu ${Q.i + 1}/${Q.qs.length}</div>
      ${prompt}
      <div class="rad-options ${q.kind}">${q.options
        .map((o) => {
          const cls = done ? (o === q.answer ? "correct" : o === Q.chosen ? "wrong" : "") : "";
          return `<button class="btn option ${cls}" data-rad-opt="${esc(o)}" ${done ? "disabled" : ""}>${q.kind === "identify" ? radicalLabel(Q.file, o) : `<span class="rad-opt-char" lang="zh-CN">${esc(o)}</span>`}</button>`;
        })
        .join("")}</div>
      ${
        done
          ? `<div class="rad-feedback ${correct ? "ok" : "bad"}">
              <div class="rad-q-box small" id="rad-q-answer" lang="zh-CN">${esc(q.char)}</div>
              <p>${correct ? "✅ Đúng!" : "❌ Chưa đúng."} <strong lang="zh-CN">${esc(q.char)}</strong> ${esc(Q.file.radicals.find((r) => r.id === info.radical)?.examples.find((e) => e.hanzi === q.char)?.pinyin ?? "")} — bộ <strong>${esc(Q.file.radicals.find((r) => r.id === info.radical)!.hanViet)}</strong> <span lang="zh-CN">${esc(info.form)}</span> (tô đỏ).</p>
              <button class="btn primary" data-rad-next>${Q.i < Q.qs.length - 1 ? "Câu tiếp →" : "Xem kết quả"} <kbd>Enter</kbd></button>
            </div>`
          : ""
      }
    </div>`;
  // vẽ chữ / phần còn lại / đáp án có tô bộ
  void loadChar(q.char).then((d) => {
    const data = d as unknown as StrokeJson;
    const rs = info.radStrokes ?? [];
    const rest = data.strokes.map((_, i) => i).filter((i) => !rs.includes(i));
    const restBox = document.getElementById("rad-q-rest");
    if (restBox) restBox.innerHTML = glyphSvg(data, { className: "rad-glyph", only: rest });
    const ans = document.getElementById("rad-q-answer");
    if (ans) ans.innerHTML = glyphSvg(data, { className: "rad-glyph", highlight: rs, highlightClass: "rad-hl" });
  });
  if (q.kind === "compose" && Q.file.radicals.find((r) => r.id === q.radical)?.drawable.includes(q.form))
    void loadChar(q.form).then((d) => {
      const box = document.getElementById("rad-q-form");
      if (box) box.innerHTML = glyphSvg(d as unknown as StrokeJson, { className: "rad-glyph rad-hl-all" });
    });
  el.onclick = (e) => {
    const t = e.target as HTMLElement;
    const opt = t.closest<HTMLElement>("[data-rad-opt]");
    if (opt && Q.chosen === null) {
      Q.chosen = opt.dataset.radOpt!;
      Q.results.push({ q, correct: Q.chosen === q.answer });
      speak(q.char);
      return renderQuestion(el);
    }
    if (t.closest("[data-rad-next]")) next(el);
  };
  el.onkeydown = null;
  document.onkeydown = (e) => {
    if (!quiz || !root()) return void (document.onkeydown = null);
    if (e.key === "Enter" && quiz.chosen !== null) {
      e.preventDefault();
      next(el);
    } else if (/^[1-4]$/.test(e.key) && quiz.chosen === null) {
      el.querySelectorAll<HTMLElement>("[data-rad-opt]")[Number(e.key) - 1]?.click();
    }
  };
}

function next(el: HTMLElement) {
  const Q = quiz!;
  if (Q.i < Q.qs.length - 1) {
    Q.i++;
    Q.chosen = null;
    return renderQuestion(el);
  }
  finish(el);
}

function finish(el: HTMLElement) {
  const Q = quiz!;
  document.onkeydown = null;
  const right = Q.results.filter((r) => r.correct).length;
  const before = new Set(Q.file.radicals.filter((r) => isLearned(state.progress, r.id)).map((r) => r.id));
  setProgress((p) => ({ ...p, radicals: recordRadicalQuiz(p, Q.file, Q.results, localDate(new Date())) }), {
    activity: true,
    silent: true,
    xp: right * XP.quizCorrect,
  });
  const newly = Q.file.radicals.filter((r) => !before.has(r.id) && isLearned(state.progress, r.id));
  const wrong = Q.results.filter((r) => !r.correct);
  el.innerHTML = `
    <div class="card summary center">
      <h1>${right === Q.results.length ? "🎉 Tuyệt vời!" : "Xong bài luyện"}</h1>
      <div class="stat">${right}/${Q.results.length}<span class="muted" style="font-size:1rem"> câu đúng</span></div>
      ${Q.scope && Q.file.radicals.some((r) => r.id === Q.scope) ? "" : `<p class="small muted">Bài ngẫu nhiên / theo nhóm để ôn; một bộ được tính là đã thuộc khi <em>luyện riêng bộ đó</em> đạt từ ${Math.round(RADICAL_PASS * 100)}%.</p>`}
      ${newly.length ? `<p>Đã thuộc thêm: ${newly.map((r) => `<a href="${href(r.id)}" lang="zh-CN">${esc(r.id)}</a> ${esc(r.hanViet)}`).join(", ")}</p>` : ""}
      ${wrong.length ? `<p class="small">Ôn lại: ${[...new Set(wrong.map((w) => Q.file.chars[w.q.char].radical))].map((id) => `<a href="${href(id)}" lang="zh-CN">${esc(id)}</a>`).join(" ")}</p>` : ""}
      <div class="row center"><a class="btn" href="${href()}">Về danh sách bộ thủ</a><button class="btn primary" data-rad-again>Luyện tiếp</button></div>
    </div>`;
  el.onclick = (e) => {
    if ((e.target as HTMLElement).closest("[data-rad-again]")) startQuiz(el, Q.file, Q.scope || undefined);
  };
}
