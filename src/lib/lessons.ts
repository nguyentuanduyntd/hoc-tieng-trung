// Logic lộ trình: mở khóa tuần tự, thi vượt, kiểm tra dữ liệu bài học.

import type { Exercise, LessonsFile, Unit } from "../types.ts";

/** Thứ tự tuyến tính của mọi bài (unit 1 bài 1, unit 1 bài 2, …). */
export function lessonOrder(file: LessonsFile): string[] {
  return [...file.units].sort((a, b) => a.unit - b.unit).flatMap((u) => u.lessonIds);
}

/** Bài được mở nếu là bài đầu tiên, bài trước đã xong, hoặc chính nó đã xong. */
export function isUnlocked(file: LessonsFile, lessonId: string, completed: string[]): boolean {
  const order = lessonOrder(file);
  const i = order.indexOf(lessonId);
  if (i < 0) return false;
  return i === 0 || completed.includes(lessonId) || completed.includes(order[i - 1]);
}

/** Bài tiếp theo nên học (bài đầu tiên chưa xong). */
export function nextLesson(file: LessonsFile, completed: string[]): string | undefined {
  return lessonOrder(file).find((id) => !completed.includes(id));
}

export function unitProgress(unit: Unit, completed: string[]) {
  const done = unit.lessonIds.filter((id) => completed.includes(id)).length;
  return { done, total: unit.lessonIds.length };
}

/** Thi vượt đạt -> đánh dấu xong mọi bài của unit (giữ nguyên thứ tự, không trùng). */
export function completeUnit(unit: Unit, completed: string[]): string[] {
  return [...completed, ...unit.lessonIds.filter((id) => !completed.includes(id))];
}

export function passed(correct: number, total: number, ratio: number): boolean {
  return total > 0 && correct / total >= ratio - 1e-9;
}

// ---------- Kiểm tra dữ liệu bài học ----------

function exerciseWordIds(e: Exercise): string[] {
  switch (e.type) {
    case "choose-meaning":
    case "listen-choose-hanzi":
      return [e.prompt.wordId, ...e.prompt.options, e.answer];
    case "fill-blank":
      return [...e.prompt.options, e.answer];
    case "match-pairs":
      return e.prompt.wordIds;
    case "choose-tone":
    case "write-stroke":
      return [e.prompt.wordId];
    default:
      return [];
  }
}

export function validateLessons(file: LessonsFile, wordIds: Set<string>): string[] {
  const errs: string[] = [];
  const seenLesson = new Set<string>();
  const wordOwner = new Map<string, string>();
  for (const l of file.lessons) {
    if (seenLesson.has(l.id)) errs.push(`${l.id}: id bài bị trùng`);
    seenLesson.add(l.id);
    if (l.newWordIds.length < 5 || l.newWordIds.length > 8) errs.push(`${l.id}: cần 5–8 từ mới (đang có ${l.newWordIds.length})`);
    for (const w of l.newWordIds) {
      if (wordOwner.has(w)) errs.push(`${l.id}: từ ${w} đã được dạy ở ${wordOwner.get(w)}`);
      wordOwner.set(w, l.id);
    }
    if (l.grammar && l.grammar.examples.length !== 3) errs.push(`${l.id}: ngữ pháp cần đúng 3 ví dụ`);
    const types = new Set(l.exercises.map((e) => e.type));
    for (const t of ["choose-meaning", "listen-choose-hanzi", "match-pairs", "order-words", "fill-blank", "choose-tone", "write-stroke", "speak"])
      if (!types.has(t as Exercise["type"])) errs.push(`${l.id}: thiếu dạng bài ${t}`);
    errs.push(...l.exercises.flatMap((e) => validateExercise(e, wordIds)));
  }
  for (const u of file.units) {
    for (const id of u.lessonIds) if (!seenLesson.has(id)) errs.push(`unit ${u.unit}: bài ${id} không tồn tại`);
    if (u.skipTest.length < 8) errs.push(`unit ${u.unit}: bài thi vượt quá ngắn`);
    errs.push(...u.skipTest.flatMap((e) => validateExercise(e, wordIds)));
  }
  return errs;
}

export function validateExercise(e: Exercise, wordIds: Set<string>): string[] {
  const errs: string[] = [];
  for (const id of exerciseWordIds(e)) if (!wordIds.has(id)) errs.push(`${e.id}: wordId lạ ${id}`);
  if ((e.type === "choose-meaning" || e.type === "listen-choose-hanzi" || e.type === "fill-blank")) {
    const opts = e.prompt.options;
    if (opts.length !== 4) errs.push(`${e.id}: cần 4 phương án (có ${opts.length})`);
    if (new Set(opts).size !== opts.length) errs.push(`${e.id}: phương án bị trùng`);
    if (!opts.includes(e.answer)) errs.push(`${e.id}: đáp án không nằm trong phương án`);
  }
  if (e.type === "order-words" && e.prompt.tiles.slice().sort().join() !== e.answer.slice().sort().join())
    errs.push(`${e.id}: các mảnh ghép không khớp đáp án`);
  if (e.type === "fill-blank" && e.prompt.sentence.tokens[e.prompt.blankIndex]?.wordId !== e.answer)
    errs.push(`${e.id}: vị trí che không khớp đáp án`);
  if (e.type === "choose-tone" && !(e.answer >= 1 && e.answer <= 4)) errs.push(`${e.id}: thanh phải là 1–4`);
  if (e.type === "match-pairs" && (e.prompt.wordIds.length < 3 || e.prompt.wordIds.length > 6)) errs.push(`${e.id}: ghép cặp cần 3–6 từ`);
  return errs;
}
