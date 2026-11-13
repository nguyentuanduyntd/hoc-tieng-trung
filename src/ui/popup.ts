// Pop-up từ điển kiểu Pleco: bấm / chạm (hoặc Enter) vào bất kỳ từ tiếng Trung nào có [data-word-id].

import { getLevelInfo } from "../config/hsk.ts";
import { addWordCards } from "../lib/srs.ts";
import { setProgress, state } from "../state.ts";
import type { Word } from "../types.ts";
import { posLabel } from "../lib/pos.ts";
import { esc, zhTokens, zhWord } from "./html.ts";
import { speak } from "./speech.ts";
import { mountStrokeAnimation } from "./strokes.ts";

let dialog: HTMLDialogElement | null = null;
let lastFocus: HTMLElement | null = null;

function ensureDialog(): HTMLDialogElement {
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.className = "dict-popup";
  dialog.setAttribute("aria-label", "Từ điển");
  document.body.appendChild(dialog);
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog!.close(); // bấm ra ngoài
  });
  dialog.addEventListener("close", () => lastFocus?.focus?.());
  return dialog;
}

export const inSrs = (wordId: string) => state.progress.cards.some((c) => c.wordId === wordId);

function levelBadges(w: Word): string {
  const b: string[] = [];
  const cur = state.progress.hskStandard === "3.0" ? w.hsk3Level : w.hsk2Level;
  if (cur) b.push(`<span class="badge accent">${esc(getLevelInfo(state.progress.hskStandard, cur)?.label ?? "")}</span>`);
  if (w.hsk3Level) b.push(`<span class="badge">3.0: cấp ${w.hsk3Level}</span>`);
  if (w.hsk2Level) b.push(`<span class="badge">2.0: cấp ${w.hsk2Level}</span>`);
  return b.join("");
}

/** Âm Hán Việt của từng chữ (khi từ có nhiều chữ). */
function charBreakdown(w: Word): string {
  const chars = [...w.hanzi];
  if (chars.length < 2) return "";
  const hv = (w.hanViet ?? "").split(/\s+/);
  return `<div class="char-breakdown">${chars
    .map((ch, i) => {
      const single = state.wordsByHanzi.get(ch);
      return `<div class="char-chip">${zhWord(ch, single?.id, "big")}<span class="hv">${esc(hv[i] ?? "")}</span>${
        single ? `<span class="muted small">${esc(single.meaningVi)}</span>` : ""
      }</div>`;
    })
    .join("")}</div>`;
}

export function openWordPopup(wordId: string, from?: HTMLElement | null) {
  const w = state.wordsById.get(wordId);
  if (!w) return;
  const d = ensureDialog();
  if (!d.open) lastFocus = from ?? (document.activeElement as HTMLElement | null);
  const added = inSrs(w.id);
  d.innerHTML = `
    <div class="dict-head">
      <div>
        <div class="dict-hanzi" lang="zh-CN">${esc(w.hanzi)}</div>
        <div class="dict-pinyin">${esc(w.pinyin)} <span class="muted small">${esc(w.pinyinNumbered)}</span></div>
      </div>
      <button class="btn icon-btn" data-close aria-label="Đóng">✕</button>
    </div>
    <div class="dict-hv">${esc(w.hanViet ?? "")}</div>
    ${w.pos?.length ? `<div class="pos-row">${w.pos.map((c) => `<span class="pos-tag">${esc(posLabel(c))}</span>`).join("")}</div>` : ""}
    ${
      (w.senses?.length ?? 0) > 1
        ? `<ol class="dict-senses">${w.senses!.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>`
        : `<div class="dict-meaning">${esc(w.meaningVi)}</div>`
    }
    ${w.meaningEn ? `<div class="muted small">EN: ${esc(w.meaningEn)}</div>` : ""}
    <div class="row" style="margin:10px 0">${levelBadges(w)}${w.reviewStatus === "draft" ? `<span class="badge warn" title="Hán Việt & nghĩa Việt chưa được duyệt">nháp</span>` : ""}</div>
    ${charBreakdown(w)}
    <div class="stroke-area" aria-label="Thứ tự nét"></div>
    ${
      w.examples.length
        ? `<div class="dict-examples">${w.examples
            .map(
              (e) => `<div class="example">
              <div class="ex-zh">${e.tokens ? zhTokens(e.tokens) : esc(e.zh)}
                <button class="btn icon-btn small" data-speak="${esc(e.zh)}" aria-label="Phát câu ví dụ">🔊</button></div>
              <div class="ex-py">${esc(e.pinyin)}</div>
              <div class="ex-vi">${esc(e.vi)}</div>
            </div>`,
            )
            .join("")}</div>`
        : ""
    }
    <div class="row dict-actions">
      <button class="btn" data-speak="${esc(w.hanzi)}">🔊 Phát âm</button>
      <button class="btn" data-replay>✍️ Xem lại nét</button>
      <button class="btn ${added ? "" : "primary"}" data-add-srs="${esc(w.id)}" ${added ? "disabled" : ""}>
        ${added ? "✓ Đã có trong ôn tập" : "+ Thêm vào ôn tập"}</button>
    </div>`;
  const replay = mountStrokeAnimation(d.querySelector<HTMLElement>(".stroke-area")!, w.hanzi, [...w.hanzi].length > 2 ? 84 : 110);
  d.querySelector("[data-replay]")!.addEventListener("click", replay);
  d.querySelector("[data-close]")!.addEventListener("click", () => d.close());
  if (!d.open) d.showModal();
  d.querySelector<HTMLElement>("[data-close]")!.focus();
}

export function addToSrs(wordId: string) {
  setProgress((p) => ({ ...p, cards: addWordCards(p.cards, wordId, p.srsCardTypes, new Date()) }));
}

/** Gắn sự kiện dùng chung một lần cho toàn trang. */
export function installPopupHandlers() {
  const activate = (target: HTMLElement) => {
    const add = target.closest<HTMLElement>("[data-add-srs]");
    if (add) {
      addToSrs(add.dataset.addSrs!);
      if (dialog?.open) openWordPopup(add.dataset.addSrs!); // cập nhật nút
      return true;
    }
    const sp = target.closest<HTMLElement>("[data-speak]");
    if (sp) {
      speak(sp.dataset.speak!);
      return true;
    }
    const word = target.closest<HTMLElement>("[data-word-id]");
    if (word && !word.closest("[data-no-popup]")) {
      openWordPopup(word.dataset.wordId!, word);
      return true;
    }
    return false;
  };
  document.addEventListener("click", (e) => {
    if (activate(e.target as HTMLElement)) e.preventDefault();
  });
  document.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement;
    if ((e.key === "Enter" || e.key === " ") && t.matches?.(".zh-word[data-word-id]")) {
      e.preventDefault();
      e.stopPropagation();
      activate(t);
    }
  });
}
