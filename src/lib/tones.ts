// Thanh điệu: tách thanh từ pinyin, quy tắc biến điệu (3-3, 不, 一).

import { parseMarkedSyllable, stripTones } from "./pinyin.ts";

export const TONE_NAMES: Record<number, string> = {
  1: "Thanh 1 (ngang, cao)",
  2: "Thanh 2 (lên)",
  3: "Thanh 3 (xuống rồi lên)",
  4: "Thanh 4 (xuống mạnh)",
  5: "Thanh nhẹ",
};

/** Ký hiệu đường nét thanh để hiển thị nhanh. */
export const TONE_MARKS: Record<number, string> = { 1: "ˉ", 2: "ˊ", 3: "ˇ", 4: "ˋ", 5: "·" };

export function syllables(pinyin: string): string[] {
  return pinyin.trim().split(/\s+/).filter(Boolean);
}

/** Thanh của từng âm tiết: "nǐ hǎo" -> [3, 3]. */
export function tonesOf(pinyin: string): number[] {
  return syllables(pinyin).map((s) => parseMarkedSyllable(s)[1]);
}

export function tonelessSyllable(syllable: string): string {
  return stripTones(syllable).toLowerCase();
}

export interface SandhiResult {
  /** Thanh khi đọc thực tế. */
  spoken: number[];
  /** Giải thích từng thay đổi (tiếng Việt). */
  notes: string[];
}

/**
 * Áp dụng biến điệu cho một chuỗi âm tiết:
 *  - 3 + 3 -> 2 + 3 (chuỗi nhiều thanh 3: các âm trước âm cuối đổi thành 2 — quy tắc đơn giản hóa)
 *  - 不 (bù) + thanh 4 -> bú
 *  - 一 (yī) + thanh 4 -> yí; + thanh 1/2/3 -> yì (không áp dụng khi đếm số / cuối từ)
 * `chars` là các chữ Hán tương ứng (để nhận ra 不 / 一).
 */
export function applySandhi(tones: number[], chars: string[] = []): SandhiResult {
  const spoken = [...tones];
  const notes: string[] = [];
  for (let i = 0; i < spoken.length - 1; i++) {
    const next = tones[i + 1];
    if (chars[i] === "不" && tones[i] === 4 && next === 4) {
      spoken[i] = 2;
      notes.push("不 đứng trước thanh 4 đọc thành bú (thanh 2).");
    } else if (chars[i] === "一" && tones[i] === 1 && next !== 5) {
      if (next === 4) {
        spoken[i] = 2;
        notes.push("一 đứng trước thanh 4 đọc thành yí (thanh 2).");
      } else {
        spoken[i] = 4;
        notes.push("一 đứng trước thanh 1, 2, 3 đọc thành yì (thanh 4).");
      }
    }
  }
  // 3-3: duyệt từ phải sang trái theo cụm thanh 3 liên tiếp
  let i = 0;
  while (i < spoken.length) {
    if (spoken[i] !== 3) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < spoken.length && spoken[j + 1] === 3) j++;
    if (j > i) {
      for (let k = i; k < j; k++) spoken[k] = 2;
      notes.push("Hai thanh 3 đi liền nhau: thanh 3 phía trước đọc thành thanh 2.");
    }
    i = j + 1;
  }
  return { spoken, notes: [...new Set(notes)] };
}

export const tonePairLabel = (t: number[]) => t.map((x) => (x === 5 ? "nhẹ" : String(x))).join("–");

// ---------- Bài luyện thanh ----------

interface HasPinyin {
  hanzi: string;
  pinyin: string;
}

/** Từ một chữ có thanh 1–4 (luyện thanh đơn). */
export function singleTonePool<T extends HasPinyin>(words: T[]): T[] {
  return words.filter((w) => [...w.hanzi].length === 1 && syllables(w.pinyin).length === 1 && [1, 2, 3, 4].includes(tonesOf(w.pinyin)[0]));
}

/** Từ hai chữ, hai âm tiết (luyện cặp thanh). */
export function tonePairPool<T extends HasPinyin>(words: T[]): T[] {
  return words.filter((w) => [...w.hanzi].length === 2 && syllables(w.pinyin).length === 2);
}

/** 4 phương án cặp thanh (gồm đáp án), không trùng nhau. */
export function tonePairOptions(correct: number[], rand: () => number): number[][] {
  const key = (t: number[]) => t.join("-");
  const seen = new Set([key(correct)]);
  const out = [correct];
  let guard = 0;
  while (out.length < 4 && guard++ < 200) {
    // thay đổi một hoặc cả hai âm tiết để tạo nhiễu gần giống
    const c = [...correct];
    const i = Math.floor(rand() * 2);
    c[i] = 1 + Math.floor(rand() * (correct[i] === 5 || rand() < 0.3 ? 5 : 4));
    if (rand() < 0.3) c[1 - i] = 1 + Math.floor(rand() * 4);
    if (!seen.has(key(c))) {
      seen.add(key(c));
      out.push(c);
    }
  }
  // trộn
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
