// Bộ thủ (SPEC 3.15) — bài tập và tiến độ, phần thuần.
//  - "identify": cho chữ, chọn bộ thủ của nó (4 lựa chọn).
//  - "compose": cho bộ thủ + phần còn lại của chữ (vẽ từ dữ liệu nét), chọn chữ ghép thành (4 lựa chọn,
//    nhiễu là các chữ cùng bộ — buộc phải nhìn phần còn lại).

import type { RadicalsFile, UserProgress } from "../types.ts";

export type RadicalQuestion =
  | { kind: "identify"; char: string; options: string[]; answer: string }
  | { kind: "compose"; char: string; radical: string; form: string; options: string[]; answer: string };

/** Đạt từ ngưỡng này thì bộ thủ được tính là đã thuộc. */
export const RADICAL_PASS = 0.8;
export const QUIZ_LENGTH = 6;

/** RNG có hạt giống (mulberry32) để bài tập lặp lại được trong test. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(xs: T[], rnd: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pick = <T>(xs: T[], n: number, rnd: () => number) => shuffle(xs, rnd).slice(0, n);

/** Chữ HSK 1 thuộc các bộ `ids` (có thể ghép thành câu hỏi). */
export function charsOf(file: RadicalsFile, ids: Set<string>): string[] {
  return Object.keys(file.chars).filter((ch) => ids.has(file.chars[ch].radical));
}

function identify(file: RadicalsFile, ch: string, rnd: () => number): RadicalQuestion {
  const right = file.chars[ch].radical;
  const topic = file.radicals.find((r) => r.id === right)!.topic;
  // nhiễu: ưu tiên bộ cùng nhóm, rồi bộ bất kỳ; không lấy bộ là một phần khác của chữ (vd 好: 女 và 子)
  const others = file.radicals.filter((r) => r.id !== right && !r.forms.some((f) => ch.includes(f)) );
  const same = others.filter((r) => r.topic === topic);
  const pool = [...pick(same, 2, rnd), ...pick(others.filter((r) => r.topic !== topic), 3, rnd)].slice(0, 3);
  return { kind: "identify", char: ch, options: shuffle([right, ...pool.map((r) => r.id)], rnd), answer: right };
}

function compose(file: RadicalsFile, ch: string, rnd: () => number): RadicalQuestion | null {
  const c = file.chars[ch];
  if (!c.radStrokes?.length) return null;
  const sameRadical = Object.keys(file.chars).filter((x) => x !== ch && file.chars[x].radical === c.radical);
  const others = Object.keys(file.chars).filter((x) => x !== ch && file.chars[x].radical !== c.radical);
  const distract = [...pick(sameRadical, 3, rnd), ...pick(others, 3, rnd)].slice(0, 3);
  if (distract.length < 3) return null;
  return { kind: "compose", char: ch, radical: c.radical, form: c.form, options: shuffle([ch, ...distract], rnd), answer: ch };
}

/**
 * Tạo bài luyện: chữ HSK 1 thuộc các bộ `ids`, xen kẽ hai dạng. “identify”: đáp án = id bộ thủ; “compose”: đáp án = chữ.
 */
export function buildRadicalQuiz(file: RadicalsFile, ids: string[], n = QUIZ_LENGTH, seed = Date.now()): RadicalQuestion[] {
  const rnd = seeded(seed);
  const chars = shuffle(charsOf(file, new Set(ids)), rnd);
  const out: RadicalQuestion[] = [];
  for (let i = 0; out.length < n && i < chars.length * 2; i++) {
    const ch = chars[i % chars.length];
    if (!ch) break;
    const q = out.length % 2 === 1 ? (compose(file, ch, rnd) ?? identify(file, ch, rnd)) : identify(file, ch, rnd);
    if (!out.some((x) => x.kind === q.kind && x.char === q.char)) out.push(q);
  }
  return out;
}

// ---------- tiến độ ----------

export const isLearned = (p: Pick<UserProgress, "radicals">, id: string) => (p.radicals[id]?.best ?? 0) >= RADICAL_PASS;

/** % bộ đã thuộc theo nhóm chủ đề. */
export function topicProgress(file: RadicalsFile, p: Pick<UserProgress, "radicals">): Record<string, { learned: number; total: number }> {
  const out: Record<string, { learned: number; total: number }> = {};
  for (const t of file.topics) out[t.id] = { learned: 0, total: 0 };
  for (const r of file.radicals) {
    const t = (out[r.topic] ??= { learned: 0, total: 0 });
    t.total++;
    if (isLearned(p, r.id)) t.learned++;
  }
  return out;
}

/**
 * Ghi kết quả một bài luyện: mỗi bộ thủ được chấm theo các câu về nó, chỉ giữ điểm tốt nhất.
 * Bộ chỉ có 1 câu trong bài (thường gặp ở bài ngẫu nhiên / theo nhóm) KHÔNG được ghi — một câu đúng
 * chưa đủ để tính là đã thuộc; muốn tính thì luyện riêng bộ đó.
 */
export const MIN_QUESTIONS_PER_RADICAL = 2;

export function recordRadicalQuiz(
  p: Pick<UserProgress, "radicals">,
  file: RadicalsFile,
  results: { q: RadicalQuestion; correct: boolean }[],
  date: string,
): UserProgress["radicals"] {
  const per = new Map<string, { right: number; total: number }>();
  for (const { q, correct } of results) {
    const id = q.kind === "identify" ? q.answer : q.radical;
    const radicalId = file.radicals.some((r) => r.id === id) ? id : file.chars[q.char]?.radical;
    if (!radicalId) continue;
    const s = per.get(radicalId) ?? { right: 0, total: 0 };
    s.total++;
    if (correct) s.right++;
    per.set(radicalId, s);
  }
  const out = { ...p.radicals };
  for (const [id, s] of per) {
    if (s.total < MIN_QUESTIONS_PER_RADICAL) continue;
    const score = Math.round((s.right / s.total) * 100) / 100;
    if (score > (out[id]?.best ?? -1)) out[id] = { best: score, date };
  }
  return out;
}
