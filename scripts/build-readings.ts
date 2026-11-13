// Sinh public/data/readings/hsk1.json từ data/curated/readings-hsk1.json. Chạy sau build-vocab.ts.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildReading, type ReadingSpec } from "../src/lib/readings.ts";
import { createSegmenter } from "../src/lib/segment.ts";
import type { Reading, ReadingsFile, VocabFile } from "../src/types.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vocab: VocabFile = JSON.parse(readFileSync(resolve(root, "public/data/vocab/hsk1.json"), "utf8"));
const src: { hskLevel: number; readings: ReadingSpec[] } = JSON.parse(readFileSync(resolve(root, "data/curated/readings-hsk1.json"), "utf8"));
const OUT = resolve(root, "public/data/readings/hsk1.json");

const byId = new Map(vocab.words.map((w) => [w.id, w]));
const seg = createSegmenter(new Map(vocab.words.map((w) => [w.hanzi, w.id])));
// Một từ thuộc cấp 1 nếu là cấp 1 ở ít nhất một chuẩn (dữ liệu HSK 1 = 3.0 ∪ 2.0).
const levelOf = (w: { hsk3Level?: number; hsk2Level?: number }) => Math.min(w.hsk3Level ?? 99, w.hsk2Level ?? 99);

const errors: string[] = [];
const readings: Reading[] = [];
const ids = new Set<string>();
for (const spec of src.readings) {
  if (ids.has(spec.id)) errors.push(`${spec.id}: id bị trùng`);
  ids.add(spec.id);
  const { reading, errors: e } = buildReading(spec, src.hskLevel, seg, byId, levelOf);
  readings.push(reading);
  errors.push(...e);
}
if (readings.length < 5) errors.push(`cần ít nhất 5 bài đọc (đang có ${readings.length})`);
if (errors.length) {
  console.error(`✗ ${errors.length} lỗi bài đọc:\n  ` + errors.join("\n  "));
  process.exit(1);
}
const out: ReadingsFile = { meta: { generatedAt: new Date().toISOString().slice(0, 10), description: `Bài đọc HSK ${src.hskLevel} (dự án tự soạn)` }, readings };
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n", "utf8");
console.log(`✓ ${readings.length} bài đọc -> ${OUT}`);
for (const r of readings) console.log(`  ${r.id} ${r.titleZh ?? ""} — ${r.stats.hanzi} chữ, ${r.sentences.length} câu, ngoài cấp ${(r.stats.outOfLevelRatio * 100).toFixed(1)}%`);
