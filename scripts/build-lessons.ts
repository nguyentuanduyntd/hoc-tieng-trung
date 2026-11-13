// Sinh public/data/lessons/hsk1.json từ data/curated/lessons-hsk1.json + từ điển đã build.
// Chạy sau build-vocab.ts (npm run data chạy cả hai). Dừng nếu dữ liệu bài học có lỗi.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateLessonExercises, generateSkipTest, seededRandom, type LessonSpec } from "../src/lib/exercises.ts";
import { validateLessons } from "../src/lib/lessons.ts";
import { createSegmenter, unknownHanzi } from "../src/lib/segment.ts";
import { sentencePinyin } from "../src/lib/sentence.ts";
import type { Lesson, LessonsFile, SentenceRef, Unit, VocabFile, Word } from "../src/types.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VOCAB = resolve(root, "public/data/vocab/hsk1.json");
const SRC = resolve(root, "data/curated/lessons-hsk1.json");
const OUT = resolve(root, "public/data/lessons/hsk1.json");
const STROKES = resolve(root, "public/data/strokes");

interface UnitSpec {
  unit: number;
  title: string;
  lessons: LessonSpec[];
}
const src: { hskLevel: number; units: UnitSpec[] } = JSON.parse(readFileSync(SRC, "utf8"));
const vocab: VocabFile = JSON.parse(readFileSync(VOCAB, "utf8"));
const wordByHanzi = new Map(vocab.words.map((w) => [w.hanzi, w]));
const byId = new Map(vocab.words.map((w) => [w.id, w]));
const segmenter = createSegmenter(new Map(vocab.words.map((w) => [w.hanzi, w.id])));
const errors: string[] = [];

function makeSentence(zh: string, vi: string): SentenceRef {
  const tokens = segmenter.segment(zh);
  const unknown = unknownHanzi(tokens);
  if (unknown.length) errors.push(`Câu "${zh}": chữ ngoài từ điển HSK 1: ${unknown.join(", ")}`);
  return { zh, vi, tokens, pinyin: sentencePinyin(tokens, (id) => byId.get(id)?.pinyin) };
}

function strokeCount(ch: string): number | undefined {
  const f = resolve(STROKES, `${ch}.json`);
  if (!existsSync(f)) return undefined;
  return (JSON.parse(readFileSync(f, "utf8")) as { strokes: unknown[] }).strokes.length;
}

const lessons: Lesson[] = [];
const units: Unit[] = [];
const fallbackPool = vocab.words.filter((w) => w.hsk3Level === src.hskLevel || w.hsk2Level === src.hskLevel);

for (const u of src.units) {
  const cumulative: Word[] = [];
  u.lessons.forEach((spec, i) => {
    try {
      const words = spec.words.map((h) => {
        const w = wordByHanzi.get(h);
        if (!w) throw new Error(`${spec.id}: từ "${h}" không có trong từ điển`);
        return w;
      });
      cumulative.push(...words);
      const exercises = generateLessonExercises(spec, {
        wordByHanzi,
        pool: [...cumulative],
        fallbackPool,
        rand: seededRandom(spec.id),
        makeSentence,
        strokeCount,
      });
      lessons.push({
        id: spec.id,
        hskLevel: src.hskLevel,
        unit: u.unit,
        order: i + 1,
        title: spec.title,
        newWordIds: words.map((w) => w.id),
        grammar: spec.grammar && {
          pattern: spec.grammar.pattern,
          explanationVi: spec.grammar.explanationVi,
          examples: spec.grammar.examples.map((e) => makeSentence(e.zh, e.vi)),
        },
        exercises,
      });
    } catch (e) {
      errors.push((e as Error).message);
    }
  });
  try {
    const unitId = `hsk${src.hskLevel}-u${u.unit}`;
    units.push({
      hskLevel: src.hskLevel,
      unit: u.unit,
      title: u.title,
      lessonIds: u.lessons.map((l) => l.id),
      skipTest: generateSkipTest(unitId, u.lessons, {
        wordByHanzi,
        pool: cumulative,
        fallbackPool,
        rand: seededRandom(unitId),
        makeSentence,
      }),
      passRatio: 0.8,
    });
  } catch (e) {
    errors.push((e as Error).message);
  }
}

const out: LessonsFile = {
  meta: { generatedAt: new Date().toISOString().slice(0, 10), description: `Lộ trình HSK ${src.hskLevel} (dự án tự soạn)` },
  units,
  lessons,
};
errors.push(...validateLessons(out, new Set(byId.keys())));

if (errors.length) {
  console.error(`✗ ${errors.length} lỗi bài học:\n  ` + errors.join("\n  "));
  process.exit(1);
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n", "utf8");
const types = new Map<string, number>();
for (const l of lessons) for (const e of l.exercises) types.set(e.type, (types.get(e.type) ?? 0) + 1);
console.log(`✓ ${units.length} unit, ${lessons.length} bài, ${lessons.reduce((n, l) => n + l.exercises.length, 0)} bài tập -> ${OUT}`);
console.log(`  dạng bài: ${[...types].map(([t, n]) => `${t}×${n}`).join(", ")}`);
