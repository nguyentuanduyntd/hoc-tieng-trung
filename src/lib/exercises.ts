// Sinh bài tập cho bài học từ đặc tả (từ mới, câu luyện tập). Hàm thuần, có seed để kết quả ổn định
// — được gọi lúc build (scripts/build-lessons.ts) và có unit test.

import type { Exercise, SentenceRef, Word } from "../types.ts";
import { shuffle, shuffleDifferent } from "./grading.ts";
import { toneless } from "./pinyin.ts";
import { tonesOf } from "./tones.ts";

export interface SentenceSpec {
  zh: string;
  vi: string;
  /** Từ bị che trong bài điền từ. */
  blank?: string;
  /** Từ không được dùng làm phương án nhiễu (vì cũng đúng ngữ pháp). */
  notOptions?: string[];
}

export interface LessonSpec {
  id: string;
  title: string;
  words: string[];
  grammar?: { pattern: string; explanationVi: string; examples: { zh: string; vi: string }[] };
  sentences: SentenceSpec[];
  speak: string[];
}

export interface GenContext {
  wordByHanzi: Map<string, Word>;
  /** Từ dùng làm phương án nhiễu (từ đã học trong unit). */
  pool: Word[];
  /** Dự phòng khi pool không đủ phương án (các từ HSK 1 khác). */
  fallbackPool?: Word[];
  rand: () => number;
  makeSentence: (zh: string, vi: string) => SentenceRef;
  strokeCount?: (ch: string) => number | undefined;
}

/** Nhóm từ thay thế được cho nhau — không dùng làm nhiễu của nhau trong bài điền từ. */
const INTERCHANGEABLE = [new Set(["我", "你", "您", "他", "她", "它", "我们", "你们", "他们", "她们"])];

export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function need(ctx: GenContext, hanzi: string): Word {
  const w = ctx.wordByHanzi.get(hanzi);
  if (!w) throw new Error(`Từ "${hanzi}" không có trong từ điển`);
  return w;
}

/** Chọn `n` phương án nhiễu khác đáp án, không trùng nghĩa / đồng âm / thay thế được. */
export function pickDistractors(
  answer: Word,
  candidates: Word[],
  n: number,
  rand: () => number,
  exclude: string[] = [],
  fallback: Word[] = [],
): Word[] {
  const group = INTERCHANGEABLE.find((g) => g.has(answer.hanzi));
  const ok = (w: Word) =>
    w.id !== answer.id &&
    w.meaningVi !== answer.meaningVi &&
    toneless(w.pinyin) !== toneless(answer.pinyin) &&
    !exclude.includes(w.hanzi) &&
    !(group && group.has(w.hanzi));
  const seen = new Set<string>();
  const out: Word[] = [];
  for (const w of [...shuffle(candidates.filter(ok), rand), ...shuffle(fallback.filter(ok), rand)]) {
    if (seen.has(w.id)) continue;
    seen.add(w.id);
    out.push(w);
    if (out.length === n) break;
  }
  return out;
}

const optionsWith = (answer: Word, distractors: Word[], rand: () => number) => shuffle([answer, ...distractors], rand).map((w) => w.id);

export function chooseMeaning(id: string, w: Word, ctx: GenContext): Exercise {
  return { id, type: "choose-meaning", prompt: { wordId: w.id, options: optionsWith(w, pickDistractors(w, ctx.pool, 3, ctx.rand, [], ctx.fallbackPool), ctx.rand) }, answer: w.id };
}

export function listenChoose(id: string, w: Word, ctx: GenContext): Exercise {
  return {
    id,
    type: "listen-choose-hanzi",
    prompt: { wordId: w.id, options: optionsWith(w, pickDistractors(w, ctx.pool, 3, ctx.rand, [], ctx.fallbackPool), ctx.rand) },
    answer: w.id,
  };
}

export function chooseTone(id: string, w: Word): Exercise {
  const t = tonesOf(w.pinyin)[0];
  return { id, type: "choose-tone", prompt: { wordId: w.id, syllable: w.pinyin, toneless: toneless(w.pinyin) }, answer: t };
}

/** Câu có ít nhất 3 từ (không tính dấu câu) mới dùng cho bài sắp xếp. */
export function orderable(s: SentenceRef): boolean {
  return s.tokens.filter((t) => t.wordId).length >= 3;
}

export function orderWords(id: string, s: SentenceRef, rand: () => number): Exercise {
  const words = s.tokens.filter((t) => t.wordId).map((t) => t.text);
  return { id, type: "order-words", prompt: { sentence: s, tiles: shuffleDifferent(words, rand) }, answer: words };
}

export function fillBlank(id: string, spec: SentenceSpec, s: SentenceRef, ctx: GenContext): Exercise {
  const blankIndex = s.tokens.findIndex((t) => t.text === spec.blank);
  if (blankIndex < 0) throw new Error(`Câu "${spec.zh}": không tìm thấy từ cần che "${spec.blank}" sau khi tách từ`);
  const answer = need(ctx, spec.blank!);
  // không dùng từ đã có sẵn trong câu làm phương án nhiễu
  const inSentence = s.tokens.map((t) => t.text);
  const d = pickDistractors(answer, ctx.pool, 3, ctx.rand, [...(spec.notOptions ?? []), ...inSentence], ctx.fallbackPool);
  return { id, type: "fill-blank", prompt: { sentence: s, blankIndex, options: optionsWith(answer, d, ctx.rand) }, answer: answer.id };
}

export function generateLessonExercises(spec: LessonSpec, ctx: GenContext): Exercise[] {
  const words = spec.words.map((h) => need(ctx, h));
  const sentences = spec.sentences.map((s) => ({ spec: s, ref: ctx.makeSentence(s.zh, s.vi) }));
  const rand = ctx.rand;
  let n = 0;
  const nextId = () => `${spec.id}-e${++n}`;

  const order = shuffle(words, rand);
  const meaningWords = order.slice(0, Math.min(4, order.length));
  const listenWords = order.slice(4).concat(order.slice(0, 4)).slice(0, 2);
  const toneWords = shuffle(
    words.filter((w) => [...w.hanzi].length === 1 && [1, 2, 3, 4].includes(tonesOf(w.pinyin)[0])),
    rand,
  ).slice(0, 2);
  const blanks = sentences.filter((s) => s.spec.blank);
  const orderables = sentences.filter((s) => orderable(s.ref));
  const fillPick = blanks.slice(0, 2);
  const orderPick = shuffle(orderables.filter((s) => !fillPick.includes(s)), rand).slice(0, 2);
  if (orderPick.length < 2) orderPick.push(...orderables.filter((s) => !orderPick.includes(s)).slice(0, 2 - orderPick.length));

  const chars = [...new Set(words.flatMap((w) => [...w.hanzi]))];
  const writeChar = [...chars].sort((a, b) => (ctx.strokeCount?.(a) ?? 99) - (ctx.strokeCount?.(b) ?? 99))[0];
  const writeWord = ctx.wordByHanzi.get(writeChar) ?? words.find((w) => w.hanzi.includes(writeChar))!;

  const seq: (Exercise | undefined)[] = [
    meaningWords[0] && chooseMeaning(nextId(), meaningWords[0], ctx),
    listenWords[0] && listenChoose(nextId(), listenWords[0], ctx),
    meaningWords[1] && chooseMeaning(nextId(), meaningWords[1], ctx),
    toneWords[0] && chooseTone(nextId(), toneWords[0]),
    { id: nextId(), type: "match-pairs", prompt: { wordIds: shuffle(words, rand).slice(0, 5).map((w) => w.id) }, answer: [] },
    meaningWords[2] && chooseMeaning(nextId(), meaningWords[2], ctx),
    fillPick[0] && fillBlank(nextId(), fillPick[0].spec, fillPick[0].ref, ctx),
    orderPick[0] && orderWords(nextId(), orderPick[0].ref, rand),
    listenWords[1] && listenChoose(nextId(), listenWords[1], ctx),
    toneWords[1] && chooseTone(nextId(), toneWords[1]),
    writeChar ? { id: nextId(), type: "write-stroke", prompt: { wordId: writeWord.id, char: writeChar }, answer: writeChar } : undefined,
    meaningWords[3] && chooseMeaning(nextId(), meaningWords[3], ctx),
    fillPick[1] && fillBlank(nextId(), fillPick[1].spec, fillPick[1].ref, ctx),
    orderPick[1] && orderWords(nextId(), orderPick[1].ref, rand),
    spec.speak[0] ? speakEx(nextId(), spec, ctx) : undefined,
  ];
  // match-pairs: đáp án = danh sách từ
  const out = seq.filter((e): e is Exercise => !!e);
  for (const e of out) if (e.type === "match-pairs") e.answer = e.prompt.wordIds;
  return out;
}

function speakEx(id: string, spec: LessonSpec, ctx: GenContext): Exercise {
  const zh = spec.speak[0];
  const fromSentences = spec.sentences.find((s) => s.zh === zh);
  const grammarEx = spec.grammar?.examples.find((e) => e.zh === zh);
  const vi = fromSentences?.vi ?? grammarEx?.vi ?? "";
  return { id, type: "speak", prompt: { sentence: ctx.makeSentence(zh, vi) }, answer: zh };
}

/** Bài thi vượt cho cả unit. */
export function generateSkipTest(unitId: string, specs: LessonSpec[], ctx: GenContext): Exercise[] {
  const rand = ctx.rand;
  const words = specs.flatMap((s) => s.words.map((h) => need(ctx, h)));
  let n = 0;
  const id = () => `${unitId}-skip-e${++n}`;
  const picked = shuffle(words, rand);
  const out: Exercise[] = [];
  picked.slice(0, 5).forEach((w) => out.push(chooseMeaning(id(), w, ctx)));
  picked.slice(5, 7).forEach((w) => out.push(listenChoose(id(), w, ctx)));
  const sentenceSpecs = shuffle(specs.flatMap((s) => s.sentences), rand);
  sentenceSpecs.filter((s) => s.blank).slice(0, 3).forEach((s) => out.push(fillBlank(id(), s, ctx.makeSentence(s.zh, s.vi), ctx)));
  const ord = sentenceSpecs.map((s) => ctx.makeSentence(s.zh, s.vi)).filter(orderable);
  ord.slice(0, 2).forEach((s) => out.push(orderWords(id(), s, rand)));
  return shuffle(out, rand);
}
