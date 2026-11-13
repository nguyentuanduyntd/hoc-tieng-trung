// Lộ trình Pinyin (#/pinyin, #/pinyin/<bài>) — SPEC 3.17, học trước HSK 1.

import { PINYIN_PASS, buildPinyinQuiz, isCorrect, lessonDone, marked, nextPinyinLesson, recordPinyinLesson, type PinyinQuestion } from "../lib/pinyinCourse.ts";
import { localDate } from "../lib/srs.ts";
import { setProgress, state } from "../state.ts";
import type { PinyinCourseFile, PinyinLesson } from "../types.ts";
import { esc } from "../ui/html.ts";
import { speak, speakSlow, stopSpeaking } from "../ui/speech.ts";

let coursePromise: Promise<PinyinCourseFile | null> | null = null;
export function loadPinyinCourse(): Promise<PinyinCourseFile | null> {
  coursePromise ??= fetch(`${import.meta.env.BASE_URL}data/pinyin-course.json`)
    .then((r) => (r.ok ? (r.json() as Promise<PinyinCourseFile>) : null))
    .catch(() => null);
  return coursePromise;
}

const root = () => document.getElementById("py-root");
export const pinyinCoursePage = () => `<div id="py-root"><p class="muted">Đang tải Lộ trình Pinyin…</p></div>`;

export async function mountPinyinCourse(id: string) {
  stopSpeaking();
  const course = await loadPinyinCourse();
  const el = root();
  if (!el) return;
  if (!course) return void (el.innerHTML = `<div class="notice">Không tải được Lộ trình Pinyin.</div>`);
  if (!id) return renderList(el, course);
  const lesson = course.lessons.find((l) => l.id === id);
  if (!lesson) return void (el.innerHTML = `<div class="notice">Không có bài này. <a href="#/pinyin">Về Lộ trình Pinyin</a></div>`);
  renderLesson(el, course, lesson);
}

// ---------- Danh sách bài ----------
function renderList(el: HTMLElement, course: PinyinCourseFile) {
  const p = state.progress;
  const done = course.lessons.filter((l) => lessonDone(p, l.id)).length;
  const next = nextPinyinLesson(course, p);
  el.innerHTML = `
    <h1>🔤 Lộ trình Pinyin</h1>
    <p class="lead">Học trước HSK 1: thanh điệu, thanh mẫu, vận mẫu, biến điệu và quy tắc viết pinyin. Mỗi bài có phần giải thích (so sánh với âm tiếng Việt) và bài nghe-chọn. Đạt từ ${Math.round(PINYIN_PASS * 100)}% là xong bài.</p>
    <div class="row"><span class="badge ${done === course.lessons.length ? "accent" : ""}">${done}/${course.lessons.length} bài</span>
      ${next ? `<a class="btn primary" href="#/pinyin/${esc(next.id)}">${done ? "Học tiếp" : "Bắt đầu"}: ${esc(next.title)}</a>` : `<a class="btn primary" href="#/bai-hoc">🎉 Xong Pinyin — sang Bài học HSK 1</a>`}</div>
    <div class="progress section"><span style="width:${(done / course.lessons.length) * 100}%"></span></div>
    <ol class="py-list">${course.lessons
      .map((l) => {
        const b = p.pinyinCourse[l.id];
        return `<li><a class="card py-item ${lessonDone(p, l.id) ? "done" : ""}" href="#/pinyin/${esc(l.id)}">
          <span class="py-no">${lessonDone(p, l.id) ? "✓" : l.order}</span>
          <span><strong>${esc(l.title)}</strong>${b ? `<br><span class="small muted">tốt nhất ${Math.round(b.best * 100)}%</span>` : ""}</span></a></li>`;
      })
      .join("")}</ol>`;
}

// ---------- Một bài ----------
function sayBtn(char: string, label: string) {
  return `<button class="btn small py-say" data-py-say="${esc(char)}" aria-label="Nghe ${esc(label)}">🔊 ${esc(label)}</button>`;
}

function renderLesson(el: HTMLElement, course: PinyinCourseFile, l: PinyinLesson) {
  const next = course.lessons.find((x) => x.order === l.order + 1);
  el.innerHTML = `
    <p><a href="#/pinyin">← Lộ trình Pinyin</a> · Bài ${l.order}/${course.lessons.length}</p>
    <h1>${esc(l.title)}</h1>
    ${l.intro.map((t) => `<p>${esc(t)}</p>`).join("")}
    ${l.groups
      .map(
        (g) => `<section class="section"><h2>${esc(g.title)}</h2>
          <div class="py-items">${g.items
            .map(
              (it) => `<div class="card py-card">
                <div class="py-sym">${esc(it.py)}${it.name ? ` <span class="muted small">${esc(it.name)}</span>` : ""}</div>
                <p>${esc(it.note)}</p>
                <div class="row">${it.examples.map((s) => sayBtn(course.sounds[s], marked(s))).join("")}${(it.words ?? []).map((w) => sayBtn(w, w)).join("")}</div>
              </div>`,
            )
            .join("")}</div></section>`,
      )
      .join("")}
    <div class="card section center">
      <p>${l.drills.length ? "Nghe một âm tiết rồi chọn pinyin đúng — các phương án là những âm dễ nhầm với nhau." : "Chọn cách đọc / cách viết đúng."}</p>
      <button class="btn primary big-btn" data-py-start>Luyện ${l.drills.length ? "nghe" : "tập"}</button>
      ${l.id === "py8" ? `<a class="btn" href="#/phat-am/bien-dieu">Luyện thêm biến điệu</a>` : ""}
      ${next ? `<a class="btn" href="#/pinyin/${esc(next.id)}">Bài sau →</a>` : ""}
    </div>`;
  el.onclick = (e) => {
    const t = e.target as HTMLElement;
    const say = t.closest<HTMLElement>("[data-py-say]");
    if (say) return speak(say.dataset.pySay!);
    if (t.closest("[data-py-start]")) startQuiz(el, course, l);
  };
}

// ---------- Bài luyện ----------
interface Quiz {
  course: PinyinCourseFile;
  lesson: PinyinLesson;
  qs: PinyinQuestion[];
  i: number;
  right: number;
  chosen: string | number | null;
}
let quiz: Quiz | null = null;

function startQuiz(el: HTMLElement, course: PinyinCourseFile, lesson: PinyinLesson) {
  quiz = { course, lesson, qs: buildPinyinQuiz(course, lesson), i: 0, right: 0, chosen: null };
  renderQuestion(el, true);
}

function renderQuestion(el: HTMLElement, autoplay = false) {
  const Q = quiz!;
  const q = Q.qs[Q.i];
  const done = Q.chosen !== null;
  const opts: (string | number)[] = q.kind === "listen" ? q.options : q.options.map((_, k) => k);
  el.innerHTML = `
    <div class="row review-head"><h1>${esc(Q.lesson.title)}</h1><a class="btn small" href="#/pinyin/${esc(Q.lesson.id)}">Thoát</a></div>
    <div class="progress"><span style="width:${(Q.i / Q.qs.length) * 100}%"></span></div>
    <div class="card section py-quiz">
      <div class="q-num">Câu ${Q.i + 1}/${Q.qs.length}</div>
      ${
        q.kind === "listen"
          ? `<p class="muted">Nghe rồi chọn pinyin đúng:</p>
             <div class="row center"><button class="btn primary big-btn" data-py-play>🔊 Nghe <kbd>Space</kbd></button><button class="btn" data-py-slow>🐢 Chậm</button></div>`
          : `<p class="py-spell-q">${esc(q.q)}</p>`
      }
      <div class="py-options">${opts
        .map((o, k) => {
          const label = q.kind === "listen" ? marked(String(o)) : q.options[k];
          const cls = done ? (isCorrect(q, o) ? "correct" : o === Q.chosen ? "wrong" : "") : "";
          return `<button class="btn option ${cls}" data-py-opt="${k}" ${done ? "disabled" : ""}><span class="opt-letter">${k + 1}</span> <span class="py-opt">${esc(label)}</span></button>`;
        })
        .join("")}</div>
      ${
        done
          ? `<div class="py-feedback">
              <p>${isCorrect(q, Q.chosen!) ? "✅ Đúng!" : "❌ Chưa đúng."} ${
                q.kind === "listen"
                  ? `Âm vừa nghe: <strong>${esc(marked(q.answer))}</strong> <span lang="zh-CN">${esc(q.char)}</span> <button class="btn small" data-py-play>🔊</button>`
                  : esc(q.explain)
              }</p>
              <button class="btn primary" data-py-next>${Q.i < Q.qs.length - 1 ? "Câu tiếp →" : "Xem kết quả"} <kbd>Enter</kbd></button>
            </div>`
          : ""
      }
    </div>`;
  const play = (slow = false) => q.kind === "listen" && (slow ? speakSlow(q.char) : speak(q.char));
  if (autoplay || (!done && q.kind === "listen")) play();
  const choose = (k: number) => {
    if (Q.chosen !== null) return;
    Q.chosen = opts[k];
    if (Q.chosen === undefined) return void (Q.chosen = null);
    if (isCorrect(q, Q.chosen)) Q.right++;
    renderQuestion(el);
  };
  el.onclick = (e) => {
    const t = e.target as HTMLElement;
    const o = t.closest<HTMLElement>("[data-py-opt]");
    if (o) return choose(Number(o.dataset.pyOpt));
    if (t.closest("[data-py-play]")) return void play();
    if (t.closest("[data-py-slow]")) return void play(true);
    if (t.closest("[data-py-next]")) next(el);
  };
  document.onkeydown = (e) => {
    if (!quiz || !root()) return void (document.onkeydown = null);
    if (document.querySelector("dialog[open]")) return;
    if (e.key === " " && q.kind === "listen") {
      e.preventDefault();
      play();
    } else if (e.key === "Enter" && Q.chosen !== null) {
      e.preventDefault();
      next(el);
    } else if (/^[1-9]$/.test(e.key) && Q.chosen === null && Number(e.key) <= opts.length) choose(Number(e.key) - 1);
  };
}

function next(el: HTMLElement) {
  const Q = quiz!;
  if (Q.i < Q.qs.length - 1) {
    Q.i++;
    Q.chosen = null;
    return renderQuestion(el, true);
  }
  document.onkeydown = null;
  const score = Math.round((Q.right / Q.qs.length) * 100) / 100;
  setProgress((p) => ({ ...p, pinyinCourse: recordPinyinLesson(p, Q.lesson.id, score, localDate(new Date())) }), { activity: true, silent: true });
  const pass = score >= PINYIN_PASS;
  const nextLesson = Q.course.lessons.find((x) => x.order === Q.lesson.order + 1);
  el.innerHTML = `
    <div class="card summary center">
      <h1>${pass ? "🎉 Xong bài!" : "Chưa đạt"}</h1>
      <div class="stat">${Q.right}/${Q.qs.length}<span class="muted" style="font-size:1rem"> câu đúng (${Math.round(score * 100)}%)</span></div>
      <p>${pass ? "Bài này đã được đánh dấu xong." : `Cần ${Math.round(PINYIN_PASS * 100)}% — xem lại phần giải thích rồi luyện lại nhé.`}</p>
      <div class="row center">
        <a class="btn" href="#/pinyin/${esc(Q.lesson.id)}">Xem lại bài</a>
        <button class="btn ${pass ? "" : "primary"}" data-py-again>Luyện lại</button>
        ${pass ? (nextLesson ? `<a class="btn primary" href="#/pinyin/${esc(nextLesson.id)}">Bài sau: ${esc(nextLesson.title)}</a>` : `<a class="btn primary" href="#/bai-hoc">Sang Bài học HSK 1 →</a>`) : ""}
      </div>
    </div>`;
  el.onclick = (e) => {
    if ((e.target as HTMLElement).closest("[data-py-again]")) startQuiz(el, Q.course, Q.lesson);
  };
}
