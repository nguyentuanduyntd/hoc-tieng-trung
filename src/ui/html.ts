// Tiện ích dựng HTML an toàn + hiển thị chữ Hán bấm được.

import { state } from "../state.ts";
import type { Token } from "../lib/segment.ts";

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Một từ bấm được — mở pop-up từ điển (xem ui/popup.ts). */
export function zhWord(text: string, wordId?: string, cls = ""): string {
  const id = wordId ?? state.wordsByHanzi.get(text)?.id;
  if (!id) return `<span class="${cls}" lang="zh-CN">${esc(text)}</span>`;
  return `<span class="zh-word ${cls}" lang="zh-CN" data-word-id="${esc(id)}" role="button" tabindex="0">${esc(text)}</span>`;
}

/** Câu đã tách từ -> HTML; dấu câu không bấm được. */
export function zhTokens(tokens: Token[]): string {
  return tokens
    .map((t) => (/\p{Script=Han}/u.test(t.text) ? zhWord(t.text, t.wordId) : `<span lang="zh-CN">${esc(t.text)}</span>`))
    .join("");
}

/** Văn bản chưa tách từ (dự phòng): tách bằng từ điển lúc chạy. */
export function zhText(text: string): string {
  return state.segmenter ? zhTokens(state.segmenter.segment(text)) : `<span lang="zh-CN">${esc(text)}</span>`;
}
