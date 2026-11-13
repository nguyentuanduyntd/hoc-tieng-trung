// Dựng dữ liệu bộ thủ (SPEC 3.15) -> public/data/radicals.json
// Nguồn:
//  - data/curated/radicals.json: danh mục bộ thủ, nghĩa, Hán Việt, mẹo nhớ (dự án tự soạn)
//  - data/raw/complete-hsk-vocabulary (MIT): bộ thủ + pinyin của chữ đơn theo cấp HSK
//  - data/curated/char-radicals-hsk1.tsv: bộ thủ các chữ HSK 1 không có mục chữ đơn trong nguồn trên
//  - hanzi-writer-data (Make Me a Hanzi, Arphic PL): nét chữ + radStrokes (nét nào thuộc bộ thủ)

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RadicalsFile, RadicalEntry, RadicalExample, VocabFile } from "../src/types.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const dataDir = dirname(require.resolve("hanzi-writer-data/一.json"));
const STROKE_OUT = join(root, "public/data/strokes");
const MAX_EXAMPLES = 8;

interface Curated {
  topics: RadicalsFile["topics"];
  radicals: (Omit<RadicalEntry, "examples" | "variants"> & { moreExamples?: [string, string][] })[];
}
interface RawEntry {
  simplified: string;
  radical: string;
  level: string[];
  frequency: number;
  forms: { transcriptions: { pinyin: string } }[];
}

const curated: Curated = JSON.parse(readFileSync(join(root, "data/curated/radicals.json"), "utf8"));
const raw: RawEntry[] = JSON.parse(readFileSync(join(root, "data/raw/complete-hsk-vocabulary/complete.json"), "utf8"));
const vocab: VocabFile = JSON.parse(readFileSync(join(root, "public/data/vocab/hsk1.json"), "utf8"));
const errors: string[] = [];

// ---------- bộ thủ của từng chữ ----------
const levelOf = (e: RawEntry) => Math.min(...e.level.filter((l) => l.startsWith("new-")).map((l) => Number(l.slice(4))).concat(99));
const singles = raw.filter((e) => [...e.simplified].length === 1);
const charRadical = new Map<string, string>(singles.map((e) => [e.simplified, e.radical]));
for (const line of readFileSync(join(root, "data/curated/char-radicals-hsk1.tsv"), "utf8").split(/\r?\n/)) {
  if (!line.trim() || line.startsWith("#")) continue;
  const [ch, rad] = line.split("\t");
  if (charRadical.has(ch) && charRadical.get(ch) !== rad) errors.push(`${ch}: char-radicals-hsk1.tsv (${rad}) khác dữ liệu gốc (${charRadical.get(ch)})`);
  charRadical.set(ch, rad);
}

// ---------- chữ HSK 1 (theo thứ tự xuất hiện trong danh sách từ) ----------
const hsk1Chars: string[] = [];
for (const w of vocab.words) for (const ch of w.hanzi) if (!hsk1Chars.includes(ch)) hsk1Chars.push(ch);
for (const ch of hsk1Chars) if (!charRadical.has(ch)) errors.push(`chữ HSK 1 ${ch} chưa có bộ thủ`);
const singleWord = new Map(vocab.words.filter((w) => [...w.hanzi].length === 1).map((w) => [w.hanzi, w]));
/** Âm tiết của `ch` bên trong một từ nhiều chữ (pinyin cách theo âm tiết, số âm tiết = số chữ). */
function syllableIn(ch: string, words: { hanzi: string; pinyin: string }[]): string | undefined {
  for (const w of words) {
    const chars = [...w.hanzi];
    const syls = w.pinyin.trim().split(/\s+/);
    const i = chars.indexOf(ch);
    if (i >= 0 && syls.length === chars.length) return syls[i];
  }
  return undefined;
}
const rawWords = raw.map((e) => ({ hanzi: e.simplified, pinyin: e.forms[0]?.transcriptions.pinyin ?? "" }));
/** Pinyin của một chữ (chữ thường): từ một chữ HSK 1 → mục chữ đơn → âm tiết trong từ HSK 1 → âm tiết trong từ của nguồn. */
const pinyinOf = (ch: string): string | undefined => {
  const p =
    singleWord.get(ch)?.pinyin ??
    singles.find((e) => e.simplified === ch)?.forms[0]?.transcriptions.pinyin ??
    syllableIn(ch, vocab.words) ??
    syllableIn(ch, rawWords);
  return p?.toLowerCase();
};

// ---------- danh mục ----------
const formOwner = new Map<string, string>();
for (const r of curated.radicals) {
  if (!curated.topics.some((t) => t.id === r.topic)) errors.push(`${r.id}: nhóm "${r.topic}" không tồn tại`);
  for (const f of r.forms) {
    if (formOwner.has(f)) errors.push(`dạng ${f} thuộc cả ${formOwner.get(f)} và ${r.id}`);
    formOwner.set(f, r.id);
    if (!r.strokes[f]) errors.push(`${r.id}: thiếu số nét của dạng ${f}`);
  }
}

const radicals: RadicalEntry[] = curated.radicals.map(({ moreExamples, ...r }) => {
  const forms = new Set(r.forms);
  // ví dụ bổ sung (tự chọn) cho bộ có ít chữ trong nguồn: không được mâu thuẫn bộ thủ của nguồn
  const extraPinyin = new Map(moreExamples ?? []);
  for (const [ch] of moreExamples ?? []) {
    const known = charRadical.get(ch);
    if (known && !forms.has(known)) errors.push(`${r.id}: ví dụ bổ sung ${ch} nhưng nguồn xếp vào bộ ${known}`);
    if (!existsSync(join(dataDir, `${ch}.json`))) errors.push(`${r.id}: ví dụ bổ sung ${ch} không có dữ liệu nét`);
  }
  const hsk1 = hsk1Chars.filter((ch) => forms.has(charRadical.get(ch) ?? ""));
  const others = singles
    .filter((e) => forms.has(e.radical) && !hsk1.includes(e.simplified) && existsSync(join(dataDir, `${e.simplified}.json`)))
    .sort((a, b) => levelOf(a) - levelOf(b) || a.frequency - b.frequency)
    .map((e) => e.simplified);
  const extra = [...extraPinyin.keys()].filter((ch) => !hsk1.includes(ch) && !others.includes(ch));
  const examples: RadicalExample[] = [...hsk1, ...others, ...extra].slice(0, Math.max(MAX_EXAMPLES, Math.min(hsk1.length, 12))).map((ch) => {
    const w = singleWord.get(ch);
    return {
      hanzi: ch,
      pinyin: pinyinOf(ch) ?? extraPinyin.get(ch) ?? "",
      hsk1: hsk1.includes(ch),
      ...(w ? { wordId: w.id } : {}),
    };
  });
  if (!examples.length) errors.push(`${r.id}: không có chữ ví dụ`);
  const drawable = r.forms.filter((f) => existsSync(join(dataDir, `${f}.json`)));
  if (!drawable.includes(r.id)) errors.push(`${r.id}: dạng gốc không có dữ liệu nét`);
  return { ...r, variants: r.forms.filter((f) => f !== r.id), drawable, examples };
});

// ---------- dữ liệu cho bài tập: chữ HSK 1 thuộc danh mục + nét của bộ ----------
const chars: RadicalsFile["chars"] = {};
for (const ch of hsk1Chars) {
  const form = charRadical.get(ch)!;
  const id = formOwner.get(form);
  if (!id) continue;
  const p = join(dataDir, `${ch}.json`);
  const rs = existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")).radStrokes as number[] | undefined) : undefined;
  chars[ch] = { radical: id, form, ...(rs?.length ? { radStrokes: rs } : {}) };
}

// ---------- chép dữ liệu nét cho hình bộ thủ + chữ ví dụ ----------
mkdirSync(STROKE_OUT, { recursive: true });
let copied = 0;
const need = new Set<string>([...curated.radicals.flatMap((r) => r.forms), ...radicals.flatMap((r) => r.examples.map((e) => e.hanzi))]);
for (const ch of need) {
  const src = join(dataDir, `${ch}.json`);
  const dst = join(STROKE_OUT, `${ch}.json`);
  if (!existsSync(src)) continue;
  if (!existsSync(dst)) {
    const d = JSON.parse(readFileSync(src, "utf8"));
    writeFileSync(dst, JSON.stringify({ strokes: d.strokes, medians: d.medians }));
    copied++;
  }
}
if (!existsSync(join(STROKE_OUT, "ARPHICPL.TXT"))) copyFileSync(join(dataDir, "ARPHICPL.TXT"), join(STROKE_OUT, "ARPHICPL.TXT"));

if (errors.length) {
  console.error(`✗ ${errors.length} lỗi dữ liệu bộ thủ:\n  ` + errors.join("\n  "));
  process.exit(1);
}

const out: RadicalsFile = {
  meta: {
    generatedAt: new Date().toISOString().slice(0, 10),
    description: "Bộ thủ thông dụng: danh mục tự soạn; bộ thủ của chữ từ complete-hsk-vocabulary (MIT) + bổ sung; nét chữ Make Me a Hanzi (Arphic PL).",
  },
  topics: curated.topics,
  radicals,
  chars,
};
mkdirSync(join(root, "public/data"), { recursive: true });
writeFileSync(join(root, "public/data/radicals.json"), JSON.stringify(out));
const covered = Object.keys(chars).length;
console.log(`✓ ${radicals.length} bộ thủ, ${curated.topics.length} nhóm -> public/data/radicals.json`);
console.log(`  chữ HSK 1 thuộc danh mục: ${covered}/${hsk1Chars.length}; +${copied} file nét mới`);
