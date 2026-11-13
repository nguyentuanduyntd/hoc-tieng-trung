// Tìm từ: nhận Hán tự, pinyin có dấu, pinyin số (ni3hao3), pinyin không dấu, hoặc tiếng Việt / Hán Việt.

import type { Word } from "../types.ts";
import { hasToneMarks, isHanzi, markedToNumbered, numberedKey, toneless } from "./pinyin.ts";

/** Bỏ dấu tiếng Việt để so khớp gần đúng ("xin chao" khớp "xin chào"). */
export function foldVi(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
}

export type QueryKind = "hanzi" | "numbered" | "marked" | "text";

export function classifyQuery(q: string): QueryKind {
  const s = q.trim();
  if ([...s].some(isHanzi)) return "hanzi";
  if (/[a-zü:]+[1-5]/i.test(s) && /^[a-zü:1-5\s']+$/i.test(s)) return "numbered";
  if (hasToneMarks(s) && /^[a-zv]+$/.test(toneless(s))) return "marked";
  return "text";
}

/** Trả về danh sách từ khớp, xếp theo độ khớp (khớp chính xác trước). */
export function searchWords(words: Word[], query: string, limit = 50): Word[] {
  const q = query.trim();
  if (!q) return [];
  const kind = classifyQuery(q);
  const scored: { w: Word; s: number }[] = [];
  for (const w of words) {
    let s = 0;
    if (kind === "hanzi") {
      if (w.hanzi === q) s = 100;
      else if (w.hanzi.startsWith(q)) s = 60;
      else if (w.hanzi.includes(q)) s = 40;
    }
    if (kind === "numbered" || kind === "marked") {
      const key = numberedKey(kind === "numbered" ? q : markedToNumbered(q));
      const wk = numberedKey(w.pinyinNumbered);
      if (wk === key) s = 100;
      else if (wk.startsWith(key)) s = 50;
    }
    // Chuỗi có dấu có thể là tiếng Việt ("xin chào") nên vẫn so khớp văn bản.
    if (kind === "text" || kind === "marked") {
      const tq = toneless(q);
      const fq = foldVi(q);
      if (kind === "text") {
        const wt = toneless(w.pinyin);
        if (wt === tq) s = 90;
        else if (tq.length >= 2 && wt.startsWith(tq)) s = 45;
      }
      const meaningParts = foldVi(w.meaningVi).split(/[;,()]/).map((x) => x.trim());
      if (meaningParts.includes(fq)) s = Math.max(s, 85);
      else if (fq.length >= 2 && foldVi(w.meaningVi).includes(fq)) s = Math.max(s, 35);
      if (w.hanViet && foldVi(w.hanViet) === fq) s = Math.max(s, 80);
      if (q === w.meaningVi.trim().toLowerCase()) s = Math.max(s, 95);
    }
    if (s > 0) scored.push({ w, s });
  }
  return scored
    .sort((a, b) => b.s - a.s || a.w.hanzi.length - b.w.hanzi.length)
    .slice(0, limit)
    .map((x) => x.w);
}
