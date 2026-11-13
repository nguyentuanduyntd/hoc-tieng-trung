// Trạng thái dùng chung của app: tiến độ người học + dữ liệu từ vựng.

import { validateWordList } from "./data/validate.ts";
import { loadProgress, markActive, saveProgress } from "./lib/progress.ts";
import { createSegmenter, type Segmenter } from "./lib/segment.ts";
import { localDate } from "./lib/srs.ts";
import { logActivity, type ActivityKind } from "./lib/dashboard.ts";
import { toneless } from "./lib/pinyin.ts";
import type { LessonsFile, UserProgress, VocabFile, Word } from "./types.ts";

type Listener = () => void;

export const state = {
  progress: loadProgress(),
  vocab: null as VocabFile | null,
  wordsById: new Map<string, Word>(),
  wordsByHanzi: new Map<string, Word>(),
  segmenter: null as Segmenter | null,
  lessons: null as LessonsFile | null,
  loadError: "",
  /** false nếu trình duyệt không cho lưu (chế độ riêng tư...). */
  persisted: true,
};

const listeners = new Set<Listener>();
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Cập nhật tiến độ. `activity`: ghi nhận một ngày có học (streak) và, nếu là loại hoạt động,
 * cộng vào nhật ký học hôm nay.
 */
export function setProgress(
  update: (p: UserProgress) => UserProgress,
  opts: { activity?: boolean | ActivityKind; silent?: boolean } = {},
) {
  let next = update(state.progress);
  const today = localDate(new Date());
  if (opts.activity) next = markActive(next, today);
  if (typeof opts.activity === "string") next = logActivity(next, opts.activity, today);
  state.progress = next;
  state.persisted = saveProgress(next);
  if (!opts.silent) listeners.forEach((fn) => fn());
}

let lessonsPromise: Promise<LessonsFile | null> | null = null;
/** Tải lộ trình bài học (một lần). */
export function loadLessons(): Promise<LessonsFile | null> {
  lessonsPromise ??= fetch(`${import.meta.env.BASE_URL}data/lessons/hsk1.json`)
    .then((r) => (r.ok ? (r.json() as Promise<LessonsFile>) : null))
    .then((f) => {
      state.lessons = f;
      return f;
    })
    .catch(() => null);
  return lessonsPromise;
}

/** Hai chữ có cùng âm (bỏ thanh) theo từ điển — dùng khi chấm nhận dạng giọng nói. */
export function sameSound(a: string, b: string): boolean {
  const pa = state.wordsByHanzi.get(a)?.pinyin;
  const pb = state.wordsByHanzi.get(b)?.pinyin;
  return !!pa && !!pb && toneless(pa) === toneless(pb);
}

export async function loadVocab(): Promise<void> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/vocab/hsk1.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const vocab = (await res.json()) as VocabFile;
    state.vocab = vocab;
    state.wordsById = new Map(vocab.words.map((w) => [w.id, w]));
    state.wordsByHanzi = new Map(vocab.words.map((w) => [w.hanzi, w]));
    state.segmenter = createSegmenter(new Map(vocab.words.map((w) => [w.hanzi, w.id])));
    const issues = validateWordList(vocab.words);
    if (issues.length) {
      state.loadError = `Dữ liệu từ vựng có ${issues.length} lỗi — chạy "npm run data" để xem chi tiết.`;
      console.warn(issues);
    }
  } catch (err) {
    state.loadError = `Không tải được dữ liệu từ vựng (${(err as Error).message}).`;
  }
  listeners.forEach((fn) => fn());
}
