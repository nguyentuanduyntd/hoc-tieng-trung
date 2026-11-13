// Chấm bài tập và chấm phát âm (so khớp câu nhận dạng với câu đích).

import type { Exercise } from "../types.ts";
import { isHanzi } from "./pinyin.ts";

export type Response =
  | { type: "choose-meaning" | "listen-choose-hanzi" | "fill-blank" | "write-stroke"; value: string }
  | { type: "choose-tone" | "comprehension"; value: number }
  | { type: "order-words"; value: string[] }
  /** match-pairs: số lần ghép sai; đúng khi = 0 */
  | { type: "match-pairs"; mistakes: number }
  /** speak: điểm 0..1 (nhận dạng) hoặc tự chấm */
  | { type: "speak"; score: number };

export const SPEAK_PASS = 0.8;

export function checkAnswer(ex: Exercise, r: Response): boolean {
  if (ex.type !== r.type) return false;
  switch (r.type) {
    case "choose-meaning":
    case "listen-choose-hanzi":
    case "fill-blank":
    case "write-stroke":
      return r.value === ex.answer;
    case "choose-tone":
    case "comprehension":
      return r.value === ex.answer;
    case "order-words": {
      const a = ex.answer as string[];
      return r.value.length === a.length && r.value.join("") === a.join("");
    }
    case "match-pairs":
      return r.mistakes === 0;
    case "speak":
      return r.score >= SPEAK_PASS;
  }
}

// ---------- Chấm phát âm ----------

export interface SpeechScore {
  /** Tỷ lệ chữ đích được nhận ra (0..1). */
  score: number;
  /** Đánh dấu từng chữ Hán của câu đích: true = nhận ra đúng. */
  chars: { ch: string; ok: boolean }[];
}

const hanziOnly = (s: string) => [...s].filter(isHanzi);

/**
 * So khớp chuỗi nhận dạng với câu đích theo dãy con chung dài nhất (LCS) trên chữ Hán.
 * `sameSound(a, b)` (tùy chọn) cho phép coi hai chữ đồng âm là đúng (vd 他/她/它) — bộ nhận dạng
 * không phân biệt được chữ đồng âm, nên không nên trừ điểm người nói.
 */
export function scoreSpeech(target: string, transcript: string, sameSound?: (a: string, b: string) => boolean): SpeechScore {
  const t = hanziOnly(target);
  const h = hanziOnly(transcript);
  const eq = (a: string, b: string) => a === b || (sameSound?.(a, b) ?? false);
  const dp: number[][] = Array.from({ length: t.length + 1 }, () => new Array(h.length + 1).fill(0));
  for (let i = t.length - 1; i >= 0; i--)
    for (let j = h.length - 1; j >= 0; j--)
      dp[i][j] = eq(t[i], h[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ok = new Array(t.length).fill(false);
  let i = 0;
  let j = 0;
  while (i < t.length && j < h.length) {
    if (eq(t[i], h[j])) {
      ok[i] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  // phạt nhẹ khi nói thừa nhiều chữ
  const extra = Math.max(0, h.length - t.length);
  const matched = ok.filter(Boolean).length;
  const score = t.length ? Math.max(0, (matched - extra * 0.5) / t.length) : 0;
  return { score: Math.round(score * 100) / 100, chars: t.map((ch, k) => ({ ch, ok: ok[k] })) };
}

/** Trộn mảng cho tới khi khác thứ tự gốc (nếu có thể). */
export function shuffleDifferent<T>(arr: T[], rand: () => number = Math.random): T[] {
  if (arr.length < 2 || new Set(arr).size < 2) return [...arr];
  for (let attempt = 0; attempt < 20; attempt++) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (a.some((x, i) => x !== arr[i])) return a;
  }
  return [...arr].reverse();
}

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
