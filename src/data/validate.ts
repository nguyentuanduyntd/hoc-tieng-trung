// Kiểm tra tính hợp lệ của dữ liệu từ vựng. Dùng cả lúc build dữ liệu và trong test.

import { HSK_STANDARDS, maxLevel } from "../config/hsk.ts";
import type { Word } from "../types.ts";
import { isPosCode } from "../lib/pos.ts";
import { hasToneMarks, isHanzi, markedToNumbered, stripTones, syllableCount } from "../lib/pinyin.ts";

export interface ValidationIssue {
  wordId: string;
  field: keyof Word | "list";
  message: string;
}

/** Từ kết thúc bằng 儿 nhi hóa (一点儿 yī diǎnr) — 儿 gộp vào âm tiết trước. */
export function isErhua(hanzi: string, pinyin: string): boolean {
  if (!hanzi.endsWith("儿") || [...hanzi].length < 2) return false;
  const last = stripTones(pinyin.trim().split(/\s+/).pop() ?? "").toLowerCase();
  // "ér" là âm tiết riêng (女儿 nǚ ér); "diǎnr" là nhi hóa
  return last.endsWith("r") && last !== "er";
}

export function validateWord(w: Word): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (field: ValidationIssue["field"], message: string) => issues.push({ wordId: w.id, field, message });

  if (!w.id) add("id", "thiếu id");
  if (!w.hanzi || ![...w.hanzi].every(isHanzi)) add("hanzi", `hanzi không hợp lệ: "${w.hanzi}"`);

  if (!w.pinyin?.trim()) add("pinyin", "thiếu pinyin");
  else {
    if (/[0-9]/.test(w.pinyin)) add("pinyin", "pinyin có dấu không được chứa số");
    const expected = [...w.hanzi].length - (isErhua(w.hanzi, w.pinyin) ? 1 : 0);
    if (syllableCount(w.pinyin) !== expected)
      add("pinyin", `số âm tiết pinyin (${syllableCount(w.pinyin)}) khác số chữ (${expected})`);
    if (w.pinyinNumbered !== markedToNumbered(w.pinyin))
      add("pinyinNumbered", `"${w.pinyinNumbered}" không khớp với pinyin "${w.pinyin}" (mong đợi "${markedToNumbered(w.pinyin)}")`);
    if (!hasToneMarks(w.pinyin) && !/5/.test(w.pinyinNumbered)) add("pinyin", "pinyin thiếu dấu thanh");
  }
  if (!/^[a-zü1-5 r]+$/i.test(w.pinyinNumbered ?? "")) add("pinyinNumbered", `ký tự lạ trong "${w.pinyinNumbered}"`);

  if (w.hanViet !== undefined) {
    const n = w.hanViet.trim().split(/\s+/).filter(Boolean).length;
    if (n !== [...w.hanzi].length) add("hanViet", `số âm Hán Việt (${n}) khác số chữ Hán (${[...w.hanzi].length})`);
  }
  if (!w.meaningVi?.trim()) add("meaningVi", "thiếu nghĩa tiếng Việt");
  if (w.pos !== undefined && (!w.pos.length || w.pos.some((c) => !isPosCode(c)))) add("pos", `từ loại không hợp lệ: ${w.pos.join(",")}`);
  if (w.senses !== undefined && !w.senses.length) add("senses", "thiếu nghĩa sau khi tách");

  const checkLevel = (field: "hsk2Level" | "hsk3Level", max: number) => {
    const v = w[field];
    if (v !== undefined && (!Number.isInteger(v) || v < 1 || v > max)) add(field, `cấp ${v} ngoài khoảng 1–${max}`);
  };
  checkLevel("hsk2Level", maxLevel("2.0"));
  checkLevel("hsk3Level", maxLevel("3.0"));
  if (w.hsk2Level === undefined && w.hsk3Level === undefined) add("hsk3Level", "từ không thuộc cấp HSK nào");

  if (!Array.isArray(w.examples)) add("examples", "examples phải là mảng");
  else
    w.examples.forEach((e, i) => {
      if (!e.zh || !e.pinyin || !e.vi) add("examples", `ví dụ #${i + 1} thiếu trường`);
    });
  return issues;
}

export function validateWordList(words: Word[]): ValidationIssue[] {
  const issues = words.flatMap(validateWord);
  const seenId = new Set<string>();
  const seenHanzi = new Set<string>();
  for (const w of words) {
    if (seenId.has(w.id)) issues.push({ wordId: w.id, field: "list", message: "id bị trùng" });
    if (seenHanzi.has(w.hanzi)) issues.push({ wordId: w.id, field: "list", message: `hanzi "${w.hanzi}" bị trùng` });
    seenId.add(w.id);
    seenHanzi.add(w.hanzi);
  }
  return issues;
}

/** Ràng buộc với config: số từ thực tế mỗi cấp so với mục tiêu. */
export function levelCoverage(words: Word[]) {
  return (["3.0", "2.0"] as const).flatMap((std) =>
    HSK_STANDARDS[std].levels.map((l, i, arr) => {
      const target = l.cumulativeWords - (i > 0 ? arr[i - 1].cumulativeWords : 0);
      const actual = words.filter((w) => (std === "3.0" ? w.hsk3Level : w.hsk2Level) === l.level).length;
      return { standard: std, level: l.level, target, actual };
    }),
  );
}
