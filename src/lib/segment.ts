// Tách từ tiếng Trung theo từ điển (forward maximum matching).
// Dùng lúc build để tách sẵn câu ví dụ / bài đọc; lúc chạy chỉ dùng làm phương án dự phòng.

import { isHanzi } from "./pinyin.ts";

export interface Token {
  text: string;
  wordId?: string;
}

export interface Segmenter {
  segment(text: string): Token[];
}

/** `dict`: hanzi -> wordId. */
export function createSegmenter(dict: Map<string, string>): Segmenter {
  let maxLen = 1;
  for (const k of dict.keys()) maxLen = Math.max(maxLen, [...k].length);
  return {
    segment(text: string): Token[] {
      const chars = [...text];
      const out: Token[] = [];
      let i = 0;
      while (i < chars.length) {
        if (!isHanzi(chars[i])) {
          // gom các ký tự không phải chữ Hán liên tiếp (dấu câu, số, chữ Latin) thành 1 token
          let j = i;
          while (j < chars.length && !isHanzi(chars[j])) j++;
          out.push({ text: chars.slice(i, j).join("") });
          i = j;
          continue;
        }
        let matched = false;
        for (let len = Math.min(maxLen, chars.length - i); len >= 1; len--) {
          const piece = chars.slice(i, i + len).join("");
          const id = dict.get(piece);
          if (id) {
            out.push({ text: piece, wordId: id });
            i += len;
            matched = true;
            break;
          }
        }
        if (!matched) {
          out.push({ text: chars[i] });
          i++;
        }
      }
      return out;
    },
  };
}

/** Các chữ Hán không thuộc từ nào trong từ điển. */
export function unknownHanzi(tokens: Token[]): string[] {
  return tokens.filter((t) => !t.wordId && [...t.text].some(isHanzi)).map((t) => t.text);
}
