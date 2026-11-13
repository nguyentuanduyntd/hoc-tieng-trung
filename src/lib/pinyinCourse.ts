// Lộ trình Pinyin (SPEC 3.17) — tạo bài luyện và tiến độ, phần thuần.

import type { PinyinCourseFile, PinyinLesson, UserProgress } from "../types.ts";
import { numberedToMarked } from "./pinyin.ts";
import { seeded } from "./radicals.ts";

export type PinyinQuestion =
  /** Nghe chữ `char` (đọc âm tiết `answer`), chọn pinyin đúng trong `options` (dạng số). */
  | { kind: "listen"; char: string; options: string[]; answer: string }
  /** Chọn cách viết / cách đọc đúng. */
  | { kind: "spell"; q: string; options: string[]; answer: number; explain: string };

export const PINYIN_PASS = 0.8;
export const PINYIN_QUIZ_LENGTH = 8;

const shuffle = <T>(xs: T[], rnd: () => number): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Hiển thị pinyin có dấu từ dạng số. */
export const marked = (numbered: string) => numberedToMarked(numbered.replace(/v/g, "ü"));

/**
 * Bài luyện của một bài: nghe-chọn từ các nhóm âm dễ nhầm (mỗi nhóm dùng tối đa 2 lần, không lặp âm đích),
 * cộng câu chọn cách viết; trộn ngẫu nhiên. Phương án nghe-chọn giữ nguyên nhóm (đều là âm dễ nhầm).
 */
export function buildPinyinQuiz(course: PinyinCourseFile, lesson: PinyinLesson, n = PINYIN_QUIZ_LENGTH, seed = Date.now()): PinyinQuestion[] {
  const rnd = seeded(seed);
  const listen: PinyinQuestion[] = [];
  const used = new Set<string>();
  for (let round = 0; round < 2; round++)
    for (const set of shuffle(lesson.drills, rnd)) {
      const target = shuffle(set, rnd).find((s) => !used.has(s) && course.sounds[s]);
      if (!target) continue;
      used.add(target);
      listen.push({ kind: "listen", char: course.sounds[target], options: shuffle(set, rnd), answer: target });
    }
  const spell: PinyinQuestion[] = (lesson.spelling ?? []).map((s) => ({ kind: "spell", ...s }));
  const listenShare = spell.length ? Math.ceil(n / 2) : n;
  const picked = [...shuffle(listen, rnd).slice(0, listenShare), ...shuffle(spell, rnd)].slice(0, n);
  return shuffle(picked, rnd);
}

export const isCorrect = (q: PinyinQuestion, choice: string | number) => (q.kind === "listen" ? choice === q.answer : choice === q.answer);

// ---------- tiến độ ----------

export const lessonDone = (p: Pick<UserProgress, "pinyinCourse">, id: string) => (p.pinyinCourse[id]?.best ?? 0) >= PINYIN_PASS;

export function recordPinyinLesson(p: Pick<UserProgress, "pinyinCourse">, id: string, score: number, date: string): UserProgress["pinyinCourse"] {
  if ((p.pinyinCourse[id]?.best ?? -1) >= score) return p.pinyinCourse;
  return { ...p.pinyinCourse, [id]: { best: score, date } };
}

/** Bài nên học tiếp: bài đầu tiên chưa xong (undefined = đã xong cả lộ trình). */
export function nextPinyinLesson(course: PinyinCourseFile, p: Pick<UserProgress, "pinyinCourse">): PinyinLesson | undefined {
  return course.lessons.find((l) => !lessonDone(p, l.id));
}
