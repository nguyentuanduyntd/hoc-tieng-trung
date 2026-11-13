// Cấu hình chuẩn HSK. Mọi con số về cấp/số từ/kỳ thi phải lấy từ đây —
// không hard-code trong component (SPEC mục 2).
//
// ⚠️ Các số liệu dưới đây lấy từ nguồn tổng hợp bên thứ ba và SPEC; cần đối chiếu
// với trang chính thức https://www.chinesetest.cn trước khi chốt (xem `verified`).

import type { HskStandard, Word } from "../types.ts";

export interface HskLevelInfo {
  /** Số cấp dùng trong dữ liệu (HSK 3.0: 7 đại diện cho HSK 7–9). */
  level: number;
  label: string;
  band?: "Sơ cấp" | "Trung cấp" | "Cao cấp";
  /** Tổng số từ tích lũy cần nắm đến hết cấp này. */
  cumulativeWords: number;
}

export interface HskStandardInfo {
  id: HskStandard;
  label: string;
  levels: HskLevelInfo[];
  /** Có yêu cầu viết tay chữ Hán từ các cấp đầu không. */
  handwritingFromStart: boolean;
  /** Cấp bắt đầu có thi nói (null = thi nói là kỳ thi riêng). */
  speakingFromLevel: number | null;
  notes: string[];
  /** false = chưa đối chiếu với chinesetest.cn. */
  verified: boolean;
}

export const HSK_STANDARDS: Record<HskStandard, HskStandardInfo> = {
  "3.0": {
    id: "3.0",
    label: "HSK 3.0",
    levels: [
      { level: 1, label: "HSK 1", band: "Sơ cấp", cumulativeWords: 300 },
      { level: 2, label: "HSK 2", band: "Sơ cấp", cumulativeWords: 500 },
      { level: 3, label: "HSK 3", band: "Sơ cấp", cumulativeWords: 1000 },
      { level: 4, label: "HSK 4", band: "Trung cấp", cumulativeWords: 2000 },
      { level: 5, label: "HSK 5", band: "Trung cấp", cumulativeWords: 3600 },
      { level: 6, label: "HSK 6", band: "Trung cấp", cumulativeWords: 5400 },
      { level: 7, label: "HSK 7–9", band: "Cao cấp", cumulativeWords: 11000 },
    ],
    handwritingFromStart: true,
    speakingFromLevel: 3,
    notes: [
      "Kỳ thi HSK 3.0 chính thức đầu tiên (HSK 1–6) dự kiến ngày 13/12/2026.",
      "Yêu cầu viết tay chữ Hán ngay từ các cấp đầu; có thi nói từ HSK 3.",
    ],
    verified: false,
  },
  "2.0": {
    id: "2.0",
    label: "HSK 2.0",
    levels: [
      { level: 1, label: "HSK 1", cumulativeWords: 150 },
      { level: 2, label: "HSK 2", cumulativeWords: 300 },
      { level: 3, label: "HSK 3", cumulativeWords: 600 },
      { level: 4, label: "HSK 4", cumulativeWords: 1200 },
      { level: 5, label: "HSK 5", cumulativeWords: 2500 },
      { level: 6, label: "HSK 6", cumulativeWords: 5000 },
    ],
    handwritingFromStart: false,
    speakingFromLevel: null,
    notes: ["Kỳ thi HSK 2.0 cuối cùng trên toàn cầu: 07/11/2026."],
    verified: false,
  },
};

export const DEFAULT_HSK_STANDARD: HskStandard = "3.0";

export function isHskStandard(v: unknown): v is HskStandard {
  return v === "2.0" || v === "3.0";
}

export function getStandard(std: HskStandard): HskStandardInfo {
  return HSK_STANDARDS[std];
}

export function getLevelInfo(std: HskStandard, level: number): HskLevelInfo | undefined {
  return HSK_STANDARDS[std].levels.find((l) => l.level === level);
}

/** Số từ mới riêng của một cấp (= tích lũy cấp này − tích lũy cấp trước). */
export function getNewWordsTarget(std: HskStandard, level: number): number | undefined {
  const levels = HSK_STANDARDS[std].levels;
  const i = levels.findIndex((l) => l.level === level);
  if (i < 0) return undefined;
  return levels[i].cumulativeWords - (i > 0 ? levels[i - 1].cumulativeWords : 0);
}

export function maxLevel(std: HskStandard): number {
  const levels = HSK_STANDARDS[std].levels;
  return levels[levels.length - 1].level;
}

/** Cấp của một từ theo chuẩn đang chọn. */
export function wordLevel(word: Word, std: HskStandard): number | undefined {
  return std === "3.0" ? word.hsk3Level : word.hsk2Level;
}

/** Danh sách từ thuộc đúng cấp `level` theo chuẩn `std`. */
export function wordsAtLevel(words: Word[], std: HskStandard, level: number): Word[] {
  return words.filter((w) => wordLevel(w, std) === level);
}
