// Luyện phát âm & thanh điệu (#/phat-am/<tab>): thanh đơn, cặp thanh, quy tắc biến điệu, nói theo câu.

import { shuffle } from "../lib/grading.ts";
import { applyTone, toneless } from "../lib/pinyin.ts";
import { TONE_MARKS, TONE_NAMES, applySandhi, singleTonePool, syllables, tonePairLabel, tonePairOptions, tonePairPool, tonesOf } from "../lib/tones.ts";
import { state } from "../state.ts";
import type { SentenceRef, Word } from "../types.ts";
import { esc, zhWord } from "../ui/html.ts";
import { speak, ttsSupported } from "../ui/speech.ts";
import { mountSpeakWidget } from "../ui/speakWidget.ts";

const TABS = [
  ["thanh", "Thanh đơn"],
  ["cap", "Cặp thanh"],
  ["bien-dieu", "Biến điệu"],
  ["noi", "Nói theo câu"],
] as const;
type Tab = (typeof TABS)[number][0];

const score = { right: 0, total: 0 };

export function pronunciationPage(param: string): string {
  const tab: Tab = (TABS.find(([k]) => k === param)?.[0] ?? "thanh") as Tab;
  return `
  <h1>Luyện phát âm & thanh điệu</h1>
  <p class="lead">Giai đoạn đầu, thanh điệu là ưu tiên số 1. Nghe thật nhiều, nhại lại, rồi mới học nhanh từ mới.</p>
  ${ttsSupported() ? "" : `<div class="notice">Trình duyệt này không có giọng đọc tiếng Trung (Web Speech API), nên các bài nghe sẽ không phát âm được. Hãy thử Chrome hoặc Edge.</div>`}
  <nav class="tabs" aria-label="Chọn bài luyện">${TABS.map(([k, label]) => `<a href="#/phat-am/${k}" class="${k === tab ? "active" : ""}" ${k === tab ? 'aria-current="page"' : ""}>${label}</a>`).join("")}</nav>
  <div id="pron-root" data-tab="${tab}"></div>`;
}

export function mountPronunciation() {
  const el = document.getElementById("pron-root");
  if (!el) return;
  if (!state.vocab) {
    el.innerHTML = `<p class="muted">Đang tải dữ liệu…</p>`;
    return;
  }
  const tab = el.dataset.tab as Tab;
  score.right = 0;
  score.total = 0;
  if (tab === "thanh") singleDrill(el);
  else if (tab === "cap") pairDrill(el);
  else if (tab === "bien-dieu") sandhiPage(el);
  else speakPractice(el);
}

const scoreLine = () => (score.total ? `<span class="badge">Đúng ${score.right}/${score.total}</span>` : "");

// ---------- Thanh đơn ----------
function singleDrill(el: HTMLElement) {
  const pool = singleTonePool(state.vocab!.words);
  const ask = () => {
    const w = pool[Math.floor(Math.random() * pool.length)];
    const answer = tonesOf(w.pinyin)[0];
    const base = toneless(w.pinyin);
    el.innerHTML = `
      <div class="card tone-guide">
        ${[1, 2, 3, 4].map((t) => `<button class="btn tone-chip" data-say="${esc(["妈", "麻", "马", "骂"][t - 1])}"><strong>${applyTone("ma", t)}</strong> <span class="muted small">${esc(TONE_NAMES[t])}</span></button>`).join("")}
      </div>
      <div class="card exercise center">
        <div class="row center">${scoreLine()}</div>
        <p class="q-title">Nghe và chọn thanh</p>
        <button class="btn primary big-btn" data-say="${esc(w.hanzi)}">🔊 Nghe <kbd>Space</kbd></button>
        <div class="options tone-options">${[1, 2, 3, 4].map((t, i) => `<button class="btn option" data-tone="${t}"><kbd>${i + 1}</kbd> <strong>${esc(applyTone(base, t))}</strong> ${TONE_MARKS[t]}</button>`).join("")}</div>
        <div class="feedback-slot" aria-live="polite"></div>
      </div>`;
    speak(w.hanzi);
    const answerHandler = (t: number) => {
      score.total++;
      if (t === answer) score.right++;
      el.querySelectorAll<HTMLButtonElement>("[data-tone]").forEach((b) => {
        b.disabled = true;
        if (Number(b.dataset.tone) === answer) b.classList.add("correct");
        else if (Number(b.dataset.tone) === t) b.classList.add("wrong");
      });
      el.querySelector(".feedback-slot")!.innerHTML = `<div class="feedback ${t === answer ? "ok" : "bad"}">
        ${t === answer ? "✅ Đúng!" : "❌ Chưa đúng."} ${zhWord(w.hanzi, w.id)} <strong>${esc(w.pinyin)}</strong> — ${esc(w.meaningVi)}</div>
        <button class="btn primary" data-next-q>Câu tiếp <kbd>Enter</kbd></button>`;
    };
    bindDrill(el, (v) => answerHandler(Number(v)), "[data-tone]", ask);
  };
  ask();
}

// ---------- Cặp thanh ----------
function pairDrill(el: HTMLElement) {
  const pool = tonePairPool(state.vocab!.words);
  const ask = () => {
    const w = pool[Math.floor(Math.random() * pool.length)];
    const correct = tonesOf(w.pinyin);
    const opts = tonePairOptions(correct, Math.random);
    const sandhi = applySandhi(correct, [...w.hanzi]);
    el.innerHTML = `
      <div class="card exercise center">
        <div class="row center">${scoreLine()}</div>
        <p class="q-title">Nghe từ hai âm tiết và chọn cặp thanh</p>
        <p class="muted">${esc(syllables(w.pinyin).map((s) => toneless(s)).join(" "))}</p>
        <button class="btn primary big-btn" data-say="${esc(w.hanzi)}">🔊 Nghe <kbd>Space</kbd></button>
        <div class="options">${opts.map((o, i) => `<button class="btn option" data-pair="${o.join("-")}"><kbd>${i + 1}</kbd> ${tonePairLabel(o)}</button>`).join("")}</div>
        <div class="feedback-slot" aria-live="polite"></div>
      </div>
      <p class="muted small">Gợi ý: luyện kỹ các cặp khó như 2–3, 3–3 (đọc thành 2–3), 3–4 và thanh nhẹ ở âm sau.</p>`;
    speak(w.hanzi);
    bindDrill(
      el,
      (v) => {
        const ok = v === correct.join("-");
        score.total++;
        if (ok) score.right++;
        el.querySelectorAll<HTMLButtonElement>("[data-pair]").forEach((b) => {
          b.disabled = true;
          if (b.dataset.pair === correct.join("-")) b.classList.add("correct");
          else if (b.dataset.pair === v) b.classList.add("wrong");
        });
        el.querySelector(".feedback-slot")!.innerHTML = `<div class="feedback ${ok ? "ok" : "bad"}">
          ${ok ? "✅ Đúng!" : "❌ Chưa đúng."} ${zhWord(w.hanzi, w.id)} <strong>${esc(w.pinyin)}</strong> (${tonePairLabel(correct)}) — ${esc(w.meaningVi)}
          ${sandhi.notes.length ? `<div class="small">🔄 Đọc thực tế: ${tonePairLabel(sandhi.spoken)} — ${esc(sandhi.notes.join(" "))}</div>` : ""}</div>
          <button class="btn primary" data-next-q>Câu tiếp <kbd>Enter</kbd></button>`;
      },
      "[data-pair]",
      ask,
    );
  };
  ask();
}

/** Gắn sự kiện cho một câu luyện; bỏ sự kiện cũ bằng cách thay listener theo phần tử. */
function bindDrill(el: HTMLElement, onAnswer: (v: string) => void, optSel: string, next: () => void) {
  const handler = (e: Event) => {
    const t = e.target as HTMLElement;
    const say = t.closest<HTMLElement>("[data-say]");
    if (say) return speak(say.dataset.say!);
    const opt = t.closest<HTMLButtonElement>(optSel);
    if (opt && !opt.disabled) return onAnswer(opt.dataset.tone ?? opt.dataset.pair!);
    if (t.closest("[data-next-q]")) {
      cleanup();
      next();
    }
  };
  const key = (e: KeyboardEvent) => {
    if (!document.body.contains(el) || document.querySelector("dialog[open]")) return cleanup();
    if (e.key === " ") {
      e.preventDefault();
      el.querySelector<HTMLElement>(".big-btn")?.click();
    } else if (/^[1-4]$/.test(e.key)) {
      const b = el.querySelectorAll<HTMLButtonElement>(optSel)[Number(e.key) - 1];
      if (b && !b.disabled) b.click();
    } else if (e.key === "Enter" && el.querySelector("[data-next-q]")) {
      e.preventDefault();
      cleanup();
      next();
    }
  };
  const cleanup = () => {
    el.removeEventListener("click", handler);
    document.removeEventListener("keydown", key);
  };
  el.addEventListener("click", handler);
  document.addEventListener("keydown", key);
}

// ---------- Biến điệu ----------
function exampleRow(hanzi: string, note = ""): string {
  const tokens = state.segmenter!.segment(hanzi);
  const ws = tokens.map((t) => (t.wordId ? state.wordsById.get(t.wordId) : undefined)).filter((w): w is Word => !!w);
  const chars = ws.flatMap((w) => [...w.hanzi]);
  const sylls = ws.flatMap((w) => syllables(w.pinyin));
  const written = sylls.join(" ");
  const sandhi = applySandhi(tonesOf(written), chars);
  const spoken = sylls.map((s, i) => applyTone(toneless(s), sandhi.spoken[i])).join(" ");
  return `<tr>
    <td class="zh-cell">${tokens.map((t) => zhWord(t.text, t.wordId)).join("")}</td>
    <td>${esc(written)}</td>
    <td><strong>${esc(spoken)}</strong></td>
    <td><button class="btn icon-btn" data-say="${esc(hanzi)}" aria-label="Nghe ${esc(hanzi)}">🔊</button></td>
    <td class="muted small">${esc(note)}</td></tr>`;
}

function sandhiPage(el: HTMLElement) {
  const table = (rows: string) => `<div class="table-wrap"><table class="sandhi">
    <thead><tr><th>Từ</th><th>Pinyin (viết)</th><th>Đọc thực tế</th><th></th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  el.innerHTML = `
    <div class="card section">
      <h2>1. Hai thanh 3 liền nhau: 3 + 3 → 2 + 3</h2>
      <p>Khi hai âm tiết thanh 3 đi liền nhau, âm tiết đầu đọc thành thanh 2. Pinyin <strong>vẫn viết thanh 3</strong>.</p>
      ${table(exampleRow("你好") + exampleRow("很好") + exampleRow("可以") + exampleRow("我有"))}
    </div>
    <div class="card section">
      <h2>2. Biến điệu của 不 (bù)</h2>
      <p>不 vốn là thanh 4. Đứng trước một âm tiết <strong>thanh 4</strong> thì đọc thành <strong>bú</strong> (thanh 2). Trước thanh 1, 2, 3 giữ nguyên bù.</p>
      ${table(exampleRow("不是", "trước thanh 4") + exampleRow("不去", "trước thanh 4") + exampleRow("不要", "trước thanh 4") + exampleRow("不吃", "trước thanh 1 — giữ bù") + exampleRow("不来", "trước thanh 2 — giữ bù") + exampleRow("不好", "trước thanh 3 — giữ bù"))}
    </div>
    <div class="card section">
      <h2>3. Biến điệu của 一 (yī)</h2>
      <p>一 đọc <strong>yī</strong> khi đứng một mình, khi đếm số hoặc chỉ thứ tự (第一, 十一). Trước <strong>thanh 4</strong> đọc <strong>yí</strong>; trước <strong>thanh 1, 2, 3</strong> đọc <strong>yì</strong>.</p>
      ${table(exampleRow("一个", "trước thanh 4") + exampleRow("一下", "trước thanh 4") + exampleRow("一天", "trước thanh 1") + exampleRow("一年", "trước thanh 2") + exampleRow("一本", "trước thanh 3"))}
      <p class="muted small">Từ điển và pinyin trong bài vẫn ghi thanh gốc của từ; riêng câu ví dụ đã được ghi theo cách đọc thực tế của 一 / 不 khi chúng đứng riêng.</p>
    </div>
    <div class="card section">
      <h2>4. Thanh nhẹ</h2>
      <p>Một số âm tiết đọc nhẹ và ngắn, không có dấu: trợ từ (吗, 呢, 吧, 了, 的), âm lặp lại (爸爸, 妈妈, 谢谢) và một số từ cố định (东西, 朋友).</p>
      ${table(exampleRow("爸爸") + exampleRow("谢谢") + exampleRow("朋友") + exampleRow("东西"))}
    </div>`;
  el.addEventListener("click", (e) => {
    const say = (e.target as HTMLElement).closest<HTMLElement>("[data-say]");
    if (say) speak(say.dataset.say!);
  });
}

// ---------- Nói theo câu ----------
function speakPractice(el: HTMLElement) {
  const sentences: SentenceRef[] = [];
  const seen = new Set<string>();
  for (const w of state.vocab!.words)
    for (const e of w.examples)
      if (e.tokens && !seen.has(e.zh)) {
        seen.add(e.zh);
        sentences.push({ zh: e.zh, pinyin: e.pinyin, vi: e.vi, tokens: e.tokens });
      }
  const list = shuffle(sentences).sort((a, b) => a.zh.length - b.zh.length);
  let i = 0;
  let good = 0;
  let done = 0;
  const ask = () => {
    const s = list[i % list.length];
    el.innerHTML = `<div class="card exercise">
      <div class="row center">${done ? `<span class="badge">Đạt ${good}/${done}</span>` : ""}</div>
      <p class="q-title">Nghe mẫu, rồi nói theo</p>
      <div class="speak-box"></div>
      <div class="row center"><button class="btn" data-next-s>Câu khác →</button></div></div>`;
    mountSpeakWidget(el.querySelector<HTMLElement>(".speak-box")!, s, (r) => {
      if (r.score !== null) {
        done++;
        if (r.score >= 0.8) good++;
      }
      i++;
      ask();
    });
    el.querySelector("[data-next-s]")!.addEventListener("click", () => {
      i++;
      ask();
    });
  };
  ask();
}
