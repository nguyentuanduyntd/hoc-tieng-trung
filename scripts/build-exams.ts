// Sinh public/data/exams/hsk1.json từ data/curated/exams/*.json, kiểm tra theo src/config/exams.ts.

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getExamConfig } from "../src/config/exams.ts";
import { allQuestions, buildExam, type ExamSpec } from "../src/lib/exam.ts";
import { createSegmenter } from "../src/lib/segment.ts";
import type { Exam, ExamsFile, VocabFile } from "../src/types.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vocab: VocabFile = JSON.parse(readFileSync(resolve(root, "public/data/vocab/hsk1.json"), "utf8"));
const SRC_DIR = resolve(root, "data/curated/exams");
const OUT = resolve(root, "public/data/exams/hsk1.json");

const byId = new Map(vocab.words.map((w) => [w.id, w]));
const byHanzi = new Map(vocab.words.map((w) => [w.hanzi, w]));
const seg = createSegmenter(new Map(vocab.words.map((w) => [w.hanzi, w.id])));

const errors: string[] = [];
const exams: Exam[] = [];
for (const f of readdirSync(SRC_DIR).filter((x) => x.endsWith(".json")).sort()) {
  const spec: ExamSpec = JSON.parse(readFileSync(resolve(SRC_DIR, f), "utf8"));
  const config = getExamConfig(spec.standard, spec.level);
  if (!config) {
    errors.push(`${f}: không có cấu trúc đề cho HSK ${spec.standard} cấp ${spec.level}`);
    continue;
  }
  const { exam, errors: e } = buildExam(spec, config, seg, byId, byHanzi);
  exams.push(exam);
  errors.push(...e);
}
if (!exams.length) errors.push("chưa có đề nào");
if (errors.length) {
  console.error(`✗ ${errors.length} lỗi đề thi:\n  ` + errors.join("\n  "));
  process.exit(1);
}
const out: ExamsFile = { meta: { generatedAt: new Date().toISOString().slice(0, 10), description: "Đề thi thử (dự án tự soạn)" }, exams };
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n", "utf8");
console.log(`✓ ${exams.length} đề thi -> ${OUT}`);
for (const x of exams) console.log(`  ${x.id} (HSK ${x.standard} cấp ${x.level}): ${allQuestions(x).length} câu`);
