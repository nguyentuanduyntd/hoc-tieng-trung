// Sinh public/data/vocab/hsk1.json từ:
//   - data/raw/complete-hsk-vocabulary/complete.json (MIT) — danh sách cấp HSK, pinyin, nghĩa tiếng Anh
//   - data/curated/hsk1.tsv — âm Hán Việt + nghĩa tiếng Việt do dự án soạn
// Chạy: npm run data   (Node >= 22.18 chạy trực tiếp file .ts)

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { markedToNumbered, numberedToMarked } from "../src/lib/pinyin.ts";
import { createSegmenter, unknownHanzi } from "../src/lib/segment.ts";
import { sentencePinyin } from "../src/lib/sentence.ts";
import { validateWordList, levelCoverage } from "../src/data/validate.ts";
import type { VocabFile, Word } from "../src/types.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = resolve(root, "data/raw/complete-hsk-vocabulary/complete.json");
const CURATED = resolve(root, "data/curated/hsk1.tsv");
const EXAMPLES = resolve(root, "data/curated/examples-hsk1.tsv");
const OUT = resolve(root, "public/data/vocab/hsk1.json");

interface RawForm {
  traditional: string;
  transcriptions: { pinyin: string; numeric: string };
  meanings: string[];
}
interface RawEntry {
  simplified: string;
  level: string[];
  forms: RawForm[];
}

/** Pinyin số của dữ liệu gốc, gộp nhi hóa: "yi1 dian3 r5" -> "yi1 dian3r". */
function rawNumbered(f: RawForm): string {
  return f.transcriptions.numeric.trim().replace(/ r5\b/g, "r");
}

function levelOf(entry: RawEntry, prefix: "newest" | "old"): number | undefined {
  const tag = entry.level.find((l) => l.startsWith(prefix + "-"));
  return tag ? Number(tag.split("-")[1]) : undefined;
}

const raw: RawEntry[] = JSON.parse(readFileSync(RAW, "utf8"));
const bySimplified = new Map(raw.map((e) => [e.simplified, e]));

const errors: string[] = [];
const words: Word[] = [];
const curatedHanzi = new Set<string>();

for (const [lineNo, line] of readFileSync(CURATED, "utf8").split(/\r?\n/).entries()) {
  if (!line.trim() || line.startsWith("#")) continue;
  const [hanzi, override, hanViet, meaningVi] = line.split("\t").map((s) => s?.trim());
  const where = `hsk1.tsv:${lineNo + 1} (${hanzi})`;
  curatedHanzi.add(hanzi);
  const entry = bySimplified.get(hanzi);
  if (!entry) {
    errors.push(`${where}: không có trong dữ liệu gốc`);
    continue;
  }
  // Gom các cách đọc khác nhau (bỏ qua khác biệt hoa/thường như "Bǎi"/"bǎi").
  const readings = new Map<string, RawForm>();
  // Khóa = pinyin số chữ thường; ưu tiên dạng chữ thường (danh từ chung) trước dạng viết hoa (họ, địa danh).
  const isProper = (f: RawForm) => /^[A-Z]/.test(f.transcriptions.numeric);
  const sorted = [...entry.forms].sort((a, b) => Number(isProper(a)) - Number(isProper(b)));
  for (const f of sorted) {
    const key = rawNumbered(f).toLowerCase();
    if (!readings.has(key)) readings.set(key, f);
  }
  let pinyin: string;
  let form: RawForm | undefined;
  if (override) {
    pinyin = override;
    form = readings.get(markedToNumbered(override).toLowerCase());
    if (!form) errors.push(`${where}: cách đọc "${override}" không có trong dữ liệu gốc (${[...readings.keys()].join(", ")})`);
  } else if (readings.size === 1) {
    form = [...readings.values()][0];
    // Sinh lại pinyin có dấu từ dạng số để chuẩn hóa cách tách âm tiết (gốc có chỗ viết "jiārén").
    pinyin = numberedToMarked(rawNumbered(form));
  } else {
    errors.push(`${where}: nhiều cách đọc (${[...readings.keys()].join(", ")}) — cần điền cột pinyin`);
    continue;
  }
  // Đối chiếu pinyin số do ta tự sinh với dữ liệu gốc.
  const numbered = markedToNumbered(pinyin);
  if (form && rawNumbered(form).toLowerCase() !== numbered.toLowerCase()) {
    errors.push(`${where}: pinyin số "${numbered}" ≠ gốc "${rawNumbered(form)}"`);
  }
  if (!hanViet || !meaningVi) errors.push(`${where}: thiếu Hán Việt hoặc nghĩa Việt`);

  words.push({
    id: `${hanzi}_${numbered.replace(/\s+/g, "")}`,
    hanzi,
    pinyin,
    pinyinNumbered: numbered,
    hanViet,
    meaningVi,
    meaningEn: form ? form.meanings.slice(0, 3).join("; ") : undefined,
    hsk2Level: levelOf(entry, "old"),
    hsk3Level: levelOf(entry, "newest"),
    examples: [],
    reviewStatus: "draft",
  });
}

// Đảm bảo phủ đủ: mọi từ HSK1 (3.0 bản mới nhất hoặc 2.0) trong dữ liệu gốc đều đã được soạn.
for (const e of raw) {
  if ((e.level.includes("newest-1") || e.level.includes("old-1")) && !curatedHanzi.has(e.simplified)) {
    errors.push(`thiếu từ HSK1 "${e.simplified}" trong hsk1.tsv`);
  }
}

// ---------- Câu ví dụ: tách từ sẵn, sinh pinyin, gắn vào từ ----------
const MAX_EXAMPLES_PER_WORD = 2;
const segmenter = createSegmenter(new Map(words.map((w) => [w.hanzi, w.id])));
const byId = new Map(words.map((w) => [w.id, w]));
let exampleCount = 0;
for (const [lineNo, line] of readFileSync(EXAMPLES, "utf8").split(/\r?\n/).entries()) {
  if (!line.trim() || line.startsWith("#")) continue;
  const [zh, vi] = line.split("\t").map((s) => s?.trim());
  const where = `examples-hsk1.tsv:${lineNo + 1}`;
  if (!zh || !vi) {
    errors.push(`${where}: thiếu cột`);
    continue;
  }
  const tokens = segmenter.segment(zh);
  const unknown = unknownHanzi(tokens);
  if (unknown.length) {
    errors.push(`${where}: chữ ngoài từ điển HSK1: ${unknown.join(", ")}`);
    continue;
  }
  const pinyin = sentencePinyin(tokens, (id) => byId.get(id)?.pinyin);
  exampleCount++;
  for (const id of new Set(tokens.map((t) => t.wordId).filter((x): x is string => !!x))) {
    const w = byId.get(id)!;
    if (w.examples.length < MAX_EXAMPLES_PER_WORD) w.examples.push({ zh, pinyin, vi, tokens });
  }
}

for (const i of validateWordList(words)) errors.push(`${i.wordId} [${i.field}]: ${i.message}`);

if (errors.length) {
  console.error(`✗ ${errors.length} lỗi dữ liệu:\n  ` + errors.join("\n  "));
  process.exit(1);
}

const out: VocabFile = {
  meta: {
    generatedAt: new Date().toISOString().slice(0, 10),
    description: "Từ vựng HSK 1 (HSK 3.0 bản mới nhất ∪ HSK 2.0 cấp 1)",
    sources: [
      "complete-hsk-vocabulary (MIT) — danh sách cấp, pinyin, nghĩa tiếng Anh (CC-CEDICT)",
      "Âm Hán Việt & nghĩa tiếng Việt: dự án tự soạn (bản nháp, cần duyệt)",
    ],
    count: words.length,
  },
  words,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n", "utf8");

// ---------- Dữ liệu thứ tự nét (Hanzi Writer / Make Me a Hanzi, Arphic PL) cho mọi chữ trong từ điển ----------
const STROKE_SRC = resolve(root, "node_modules/hanzi-writer-data");
const STROKE_OUT = resolve(root, "public/data/strokes");
mkdirSync(STROKE_OUT, { recursive: true });
const chars = new Set(words.flatMap((w) => [...w.hanzi]));
const missingStrokes: string[] = [];
for (const ch of chars) {
  const src = resolve(STROKE_SRC, `${ch}.json`);
  if (existsSync(src)) copyFileSync(src, resolve(STROKE_OUT, `${ch}.json`));
  else missingStrokes.push(ch);
}
copyFileSync(resolve(STROKE_SRC, "ARPHICPL.TXT"), resolve(STROKE_OUT, "ARPHICPL.TXT"));

console.log(`✓ ${words.length} từ, ${exampleCount} câu ví dụ -> ${OUT}`);
console.log(`✓ ${chars.size - missingStrokes.length}/${chars.size} chữ có dữ liệu nét` + (missingStrokes.length ? ` (thiếu: ${missingStrokes.join("")})` : ""));
console.log(`  ${words.filter((w) => w.examples.length).length}/${words.length} từ có câu ví dụ`);
for (const c of levelCoverage(words).filter((c) => c.level === 1)) {
  console.log(`  HSK ${c.standard} cấp 1: ${c.actual} từ (mục tiêu config: ${c.target})`);
}
