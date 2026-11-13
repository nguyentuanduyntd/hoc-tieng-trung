// Dựng Lộ trình Pinyin (SPEC 3.17) -> public/data/pinyin-course.json
// Mỗi âm tiết (dạng số, vd "ma1") cần một chữ Hán để phát âm thanh. Chọn chữ CHỈ có một cách đọc
// (không tính thanh nhẹ khi lặp từ, vd 妈 trong 妈妈) theo complete-hsk-vocabulary (MIT) + từ vựng HSK 1;
// ưu tiên chữ HSK 1 (có thể có audio dựng sẵn), rồi chữ cấp thấp. `chars` trong file soạn ghi đè khi cần.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { numberedToMarked } from "../src/lib/pinyin.ts";
import type { PinyinCourseFile, PinyinLesson, VocabFile } from "../src/types.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
type Curated = { chars: Record<string, string>; lessons: Omit<PinyinLesson, "order">[] };
const curated: Curated = JSON.parse(readFileSync(join(root, "data/curated/pinyin-course.json"), "utf8"));
const raw: { simplified: string; level: string[]; frequency: number; forms: { transcriptions: { numeric: string } }[] }[] = JSON.parse(
  readFileSync(join(root, "data/raw/complete-hsk-vocabulary/complete.json"), "utf8"),
);
const vocab: VocabFile = JSON.parse(readFileSync(join(root, "public/data/vocab/hsk1.json"), "utf8"));
const errors: string[] = [];

const norm = (s: string) => s.toLowerCase().replace(/u:/g, "v").replace(/ü/g, "v").trim();
const readings = new Map<string, Set<string>>();
const rank = new Map<string, number>(); // nhỏ = ưu tiên
const add = (ch: string, syl: string, r: number) => {
  if (!readings.has(ch)) readings.set(ch, new Set());
  readings.get(ch)!.add(norm(syl));
  rank.set(ch, Math.min(rank.get(ch) ?? Infinity, r));
};
vocab.words.forEach((w, i) => {
  const chars = [...w.hanzi];
  const syl = w.pinyinNumbered.split(/\s+/);
  if (syl.length === chars.length) chars.forEach((c, k) => add(c, syl[k], i));
});
for (const e of raw) {
  const chars = [...e.simplified];
  const lvl = Math.min(...e.level.map((l) => Number(l.replace(/\D/g, "")) || 9));
  for (const f of e.forms) {
    const syl = f.transcriptions.numeric.split(/\s+/);
    if (syl.length === chars.length) chars.forEach((c, k) => add(c, syl[k], 1000 * lvl + Math.min(999, e.frequency)));
  }
}
const best = new Map<string, string>();
for (const [ch, set] of readings) {
  const real = [...set].filter((s) => !/5$/.test(s) && !/r$/.test(s));
  if (real.length !== 1) continue;
  const k = real[0];
  const cur = best.get(k);
  if (!cur || rank.get(ch)! < rank.get(cur)!) best.set(k, ch);
}

const sounds: Record<string, string> = {};
const need = (syl: string, where: string) => {
  const k = norm(syl);
  const ch = curated.chars[k] ?? best.get(k);
  if (!ch) errors.push(`${where}: không tìm được chữ một cách đọc cho âm tiết ${k}`);
  else sounds[k] = ch;
};

const lessons: PinyinLesson[] = curated.lessons.map((l, i) => {
  for (const g of l.groups) for (const it of g.items) for (const s of it.examples) need(s, `${l.id} ${it.py}`);
  l.drills.forEach((set, j) => {
    if (set.length < 3) errors.push(`${l.id} drill#${j + 1}: cần ≥ 3 âm tiết`);
    if (new Set(set.map((s) => numberedToMarked(s))).size !== set.length) errors.push(`${l.id} drill#${j + 1}: có âm tiết trùng`);
    for (const s of set) need(s, `${l.id} drill#${j + 1}`);
  });
  for (const [j, q] of (l.spelling ?? []).entries())
    if (q.answer < 0 || q.answer >= q.options.length || new Set(q.options).size !== q.options.length) errors.push(`${l.id} spelling#${j + 1}: đáp án/phương án sai`);
  if (!l.drills.length && !l.spelling?.length) errors.push(`${l.id}: bài không có bài tập`);
  return { ...l, order: i + 1 };
});
// một chữ không được dùng cho hai âm tiết
const used = new Map<string, string>();
for (const [k, ch] of Object.entries(sounds)) {
  if (used.has(ch) && used.get(ch) !== k) errors.push(`chữ ${ch} dùng cho cả ${used.get(ch)} và ${k}`);
  used.set(ch, k);
}

if (errors.length) {
  console.error(`✗ ${errors.length} lỗi Lộ trình Pinyin:\n  ` + errors.join("\n  "));
  process.exit(1);
}
const out: PinyinCourseFile = {
  meta: { generatedAt: new Date().toISOString().slice(0, 10), description: "Lộ trình Pinyin — nội dung tự soạn; chữ phát âm chọn từ complete-hsk-vocabulary (MIT) + từ vựng HSK 1." },
  lessons,
  sounds,
};
writeFileSync(join(root, "public/data/pinyin-course.json"), JSON.stringify(out));
console.log(`✓ ${lessons.length} bài Pinyin, ${Object.keys(sounds).length} âm tiết có chữ phát âm -> public/data/pinyin-course.json`);
