// Dựng & kiểm tra bài đọc (dùng lúc build) + tiện ích cho chế độ nghe / shadowing.

import type { Exercise, Reading, ReadingSentence, Word } from "../types.ts";
import { isHanzi } from "./pinyin.ts";
import { unknownHanzi, type Segmenter } from "./segment.ts";
import { sentencePinyin, tokenPinyins } from "./sentence.ts";

export interface ReadingSpec {
  id: string;
  title: string;
  titleZh?: string;
  unit?: number;
  kind: "text" | "dialogue";
  speakers?: Record<string, string>;
  sentences: { zh: string; vi: string; speaker?: string }[];
  questions: { q: string; options: string[]; answer: number }[];
}

export const READING_LIMITS = { minHanzi: 80, maxHanzi: 300, maxOutOfLevel: 0.05, minQuestions: 3, maxQuestions: 5 };

export function buildReading(
  spec: ReadingSpec,
  hskLevel: number,
  seg: Segmenter,
  byId: Map<string, Word>,
  levelOf: (w: Word) => number | undefined,
): { reading: Reading; errors: string[] } {
  const errors: string[] = [];
  const pinyinOf = (id: string) => byId.get(id)?.pinyin;
  const sentences: ReadingSentence[] = spec.sentences.map((s) => {
    const tokens = seg.segment(s.zh);
    const unk = unknownHanzi(tokens);
    if (unk.length) errors.push(`${spec.id}: "${s.zh}" có chữ ngoài từ điển: ${unk.join(", ")}`);
    if (spec.kind === "dialogue" && (!s.speaker || !spec.speakers?.[s.speaker])) errors.push(`${spec.id}: câu "${s.zh}" thiếu người nói hợp lệ`);
    return {
      zh: s.zh,
      tokens,
      tokenPinyin: tokenPinyins(tokens, pinyinOf),
      pinyin: sentencePinyin(tokens, pinyinOf),
      vi: s.vi,
      ...(s.speaker ? { speaker: s.speaker } : {}),
    };
  });
  const allTokens = sentences.flatMap((s) => s.tokens).filter((t) => t.wordId);
  const hanzi = sentences.reduce((n, s) => n + [...s.zh].filter(isHanzi).length, 0);
  const outOfLevel = allTokens.filter((t) => {
    const lv = levelOf(byId.get(t.wordId!)!);
    return lv === undefined || lv > hskLevel;
  }).length;
  const questions: Exercise[] = spec.questions.map((q, i) => ({
    id: `${spec.id}-q${i + 1}`,
    type: "comprehension",
    prompt: { question: q.q, options: q.options },
    answer: q.answer,
  }));
  const reading: Reading = {
    id: spec.id,
    hskLevel,
    title: spec.title,
    ...(spec.titleZh ? { titleZh: spec.titleZh } : {}),
    ...(spec.unit !== undefined ? { unit: spec.unit } : {}),
    kind: spec.kind,
    ...(spec.speakers ? { speakers: spec.speakers } : {}),
    sentences,
    questions,
    stats: { hanzi, words: allTokens.length, outOfLevelRatio: allTokens.length ? Math.round((outOfLevel / allTokens.length) * 1000) / 1000 : 0 },
  };
  errors.push(...validateReading(reading));
  return { reading, errors };
}

export function validateReading(r: Reading): string[] {
  const e: string[] = [];
  const L = READING_LIMITS;
  if (r.stats.hanzi < L.minHanzi || r.stats.hanzi > L.maxHanzi) e.push(`${r.id}: ${r.stats.hanzi} chữ Hán (cần ${L.minHanzi}–${L.maxHanzi})`);
  if (r.stats.outOfLevelRatio > L.maxOutOfLevel) e.push(`${r.id}: ${(r.stats.outOfLevelRatio * 100).toFixed(1)}% từ ngoài cấp (tối đa 5%)`);
  if (r.questions.length < L.minQuestions || r.questions.length > L.maxQuestions) e.push(`${r.id}: cần 3–5 câu hỏi đọc hiểu`);
  if (r.unit !== undefined && (!Number.isInteger(r.unit) || r.unit < 1)) e.push(`${r.id}: unit không hợp lệ`);
  for (const q of r.questions) {
    if (q.type !== "comprehension") continue;
    if (q.prompt.options.length < 2) e.push(`${q.id}: cần ≥ 2 phương án`);
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.prompt.options.length) e.push(`${q.id}: đáp án ngoài phạm vi`);
    if (new Set(q.prompt.options).size !== q.prompt.options.length) e.push(`${q.id}: phương án bị trùng`);
  }
  for (const s of r.sentences) {
    if (s.tokens.map((t) => t.text).join("") !== s.zh) e.push(`${r.id}: tách từ làm mất chữ ở "${s.zh}"`);
    if (s.tokenPinyin.length !== s.tokens.length) e.push(`${r.id}: tokenPinyin lệch độ dài`);
    if (!s.vi.trim()) e.push(`${r.id}: câu "${s.zh}" thiếu bản dịch`);
  }
  return e;
}

// ---------- Nghe & shadowing ----------

export const SPEEDS = [0.5, 0.75, 1, 1.25] as const;

/** Ước lượng thời lượng đọc (ms) khi không đo được: ~300 ms/âm tiết ở tốc độ 1x. */
export function estimateSpeechMs(text: string, rate: number): number {
  const syllables = [...text].filter(isHanzi).length;
  return Math.round((Math.max(1, syllables) * 300) / Math.max(0.25, rate));
}

/**
 * Thời gian tạm dừng để người học nói theo: bằng độ dài câu (đã đo) × hệ số, tối thiểu 1,2 giây.
 * Ở tốc độ chậm, câu mẫu dài hơn nên khoảng dừng cũng dài hơn tương ứng.
 */
export function shadowPauseMs(spokenMs: number, factor = 1.2, minMs = 1200): number {
  return Math.max(minMs, Math.round(spokenMs * factor));
}

/** Câu tiếp theo trong chế độ phát liên tục: lặp câu -> giữ nguyên; hết bài -> null. */
export function nextSentenceIndex(i: number, total: number, loopSentence: boolean): number | null {
  if (loopSentence) return i;
  return i + 1 < total ? i + 1 : null;
}
