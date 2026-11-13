// Sinh pinyin cho câu đã tách từ, có áp dụng biến điệu của 一 và 不 (đứng riêng thành từ).
// Từ trong từ điển giữ thanh gốc (vd 不客气 bù kè qi) — đúng quy ước của từ điển.

import type { Token } from "./segment.ts";
import { parseMarkedSyllable } from "./pinyin.ts";

const PUNCT: Record<string, string> = { "，": ",", "。": ".", "？": "?", "！": "!", "：": ":", "、": ",", "；": ";", "“": "“", "”": "”" };
const NUMERALS = new Set(["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "百", "千", "零", "两", "第"]);
/** 一 đứng trước các số này là đang đếm (一二三, 一十) -> giữ yī; trước 百/千 vẫn biến điệu (yìbǎi). */
const COUNTING_NEXT = new Set(["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "零", "两"]);

function firstTone(pinyin: string | undefined): number | undefined {
  if (!pinyin) return undefined;
  return parseMarkedSyllable(pinyin.trim().split(/\s+/)[0])[1];
}

/** Biến điệu cho token 一 / 不 đứng riêng, dựa vào token kế bên. */
export function sandhi(text: string, prev: Token | undefined, nextPinyin: string | undefined, next: Token | undefined): string | undefined {
  const t = firstTone(nextPinyin);
  if (text === "不") {
    return t === 4 ? "bú" : undefined;
  }
  if (text === "一") {
    // đếm số, số thứ tự, cuối câu: giữ yī
    if (!nextPinyin || (prev && NUMERALS.has(prev.text)) || (next && COUNTING_NEXT.has(next.text))) return undefined;
    if (t === 4 || t === 5) return "yí";
    if (t === 1 || t === 2 || t === 3) return "yì";
  }
  return undefined;
}

/** Pinyin cho từng token (dùng cho <ruby>); dấu câu -> "". Đã áp dụng biến điệu 一/不. */
export function tokenPinyins(tokens: Token[], pinyinOf: (wordId: string) => string | undefined): string[] {
  return tokens.map((tok, i) => {
    if (!tok.wordId) return "";
    const next = tokens[i + 1];
    const base = pinyinOf(tok.wordId) ?? tok.text;
    return sandhi(tok.text, tokens[i - 1], next?.wordId ? pinyinOf(next.wordId) : undefined, next) ?? base;
  });
}

/** `pinyinOf(wordId)` trả về pinyin có dấu của từ. */
export function sentencePinyin(tokens: Token[], pinyinOf: (wordId: string) => string | undefined): string {
  let out = "";
  const pys = tokenPinyins(tokens, pinyinOf);
  tokens.forEach((tok, i) => {
    if (!tok.wordId) {
      const p = [...tok.text].map((c) => PUNCT[c] ?? c).join("");
      out += p.trim() ? p : "";
      return;
    }
    out += (out && !/\s$/.test(out) ? " " : "") + pys[i];
  });
  out = out
    .replace(/\s+([,.?!:;”])/g, "$1")
    .replace(/([,.?!:;])(?=[^\s”])/g, "$1 ")
    .replace(/“\s+/g, "“")
    .replace(/(\S)“/g, "$1 “")
    .trim();
  // viết hoa đầu câu (kể cả sau . ! ? và đầu lời dẫn “…”)
  return out.replace(/(^|[.!?]\s+|“)(\p{L})/gu, (_, pre: string, ch: string) => pre + ch.toUpperCase());
}
