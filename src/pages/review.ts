// Trang Ôn tập (SRS). Phím: Space = lật thẻ / phát lại âm, 1–4 = Quên/Khó/Được/Dễ.

import {
  CARD_TYPE_LABELS,
  RATING_LABELS,
  applyReview,
  buildQueue,
  formatInterval,
  nextCard,
  nextDueSoon,
  previewIntervals,
  type Rating,
} from "../lib/srs.ts";
import { setProgress, state } from "../state.ts";
import type { SrsCard, Word } from "../types.ts";
import { esc, zhTokens, zhWord } from "../ui/html.ts";
import { resourceHint } from "../ui/resourceHint.ts";
import { speak, ttsSupported } from "../ui/speech.ts";
import { mountWritingQuiz } from "../ui/strokes.ts";

interface Session {
  cardId: string | null;
  flipped: boolean;
  reviewed: number;
  /** Gợi ý chấm điểm cho thẻ viết tay theo số lỗi. */
  suggested?: Rating;
}

const session: Session = { cardId: null, flipped: false, reviewed: 0 };
let waitTimer: number | undefined;

export function reviewCounts(now = new Date()) {
  const q = buildQueue(state.progress.cards, now, state.progress.newCardsPerDay);
  return { due: q.due.length, fresh: q.fresh.length };
}

export function reviewPage(): string {
  return `<div id="review-root" class="review"></div>`;
}

function front(card: SrsCard, w: Word): string {
  switch (card.cardType) {
    case "zh-vi":
      return `<div class="rv-hanzi" lang="zh-CN">${esc(w.hanzi)}</div><p class="muted">Nghĩa là gì?</p>`;
    case "vi-zh":
      return `<div class="rv-prompt">${esc(w.meaningVi)}</div><p class="muted">Chữ Hán là gì? (tự nhớ ra rồi lật thẻ)</p>`;
    case "audio-zh":
      return `<button class="btn primary rv-audio" data-speak="${esc(w.hanzi)}" aria-label="Nghe lại">🔊 Nghe</button>
        <p class="muted">Bạn nghe thấy từ gì?${ttsSupported() ? "" : " (Trình duyệt không hỗ trợ phát âm — hãy lật thẻ.)"}</p>`;
    case "write":
      return `<div class="rv-prompt">${esc(w.meaningVi)}</div>
        <div class="muted">${esc(w.pinyin)} · ${esc(w.hanViet ?? "")}</div>
        <div class="quiz-area" aria-label="Khung viết chữ"></div>
        <p class="muted small">Viết từng nét vào khung. Sai 2 lần sẽ hiện gợi ý.</p>`;
  }
}

function back(w: Word): string {
  const ex = w.examples[0];
  return `<div class="rv-answer">
    <div class="rv-hanzi">${zhWord(w.hanzi, w.id)}</div>
    <div class="rv-pinyin">${esc(w.pinyin)} <button class="btn icon-btn" data-speak="${esc(w.hanzi)}" aria-label="Phát âm">🔊</button></div>
    <div class="hv">${esc(w.hanViet ?? "")}</div>
    <div class="rv-meaning">${esc(w.meaningVi)}</div>
    ${
      ex
        ? `<div class="example"><div class="ex-zh">${ex.tokens ? zhTokens(ex.tokens) : esc(ex.zh)}</div>
           <div class="ex-py">${esc(ex.pinyin)}</div><div class="ex-vi">${esc(ex.vi)}</div></div>`
        : ""
    }
  </div>`;
}

function render() {
  const root = document.getElementById("review-root");
  if (!root) return;
  window.clearTimeout(waitTimer);
  const now = new Date();
  const q = buildQueue(state.progress.cards, now, state.progress.newCardsPerDay);

  if (!state.vocab) {
    root.innerHTML = `<p class="muted">Đang tải dữ liệu…</p>`;
    return;
  }
  // giữ thẻ đang hiện nếu còn trong hàng (khi re-render), nếu không lấy thẻ kế tiếp
  let card = session.cardId ? [...q.due, ...q.fresh].find((c) => c.id === session.cardId) : undefined;
  if (!card) {
    card = nextCard(q);
    session.cardId = card?.id ?? null;
    session.flipped = false;
    session.suggested = undefined;
  }

  const header = `<div class="rv-head">
      <h1>Ôn tập</h1>
      <div class="row"><span class="badge accent">Đến hạn: ${q.due.length}</span><span class="badge">Mới: ${q.fresh.length}</span>
      ${session.reviewed ? `<span class="badge">Đã ôn: ${session.reviewed}</span>` : ""}</div>
    </div>`;

  if (!card) {
    const soon = nextDueSoon(state.progress.cards, now);
    const total = state.progress.cards.length;
    if (soon) {
      const ms = Date.parse(soon.due) - now.getTime();
      waitTimer = window.setTimeout(render, Math.max(500, ms + 100));
    }
    root.innerHTML = `${header}<div class="card rv-card rv-done">
      ${
        total === 0
          ? `<h2>Chưa có thẻ nào</h2><p>Mở <a href="#/tu-vung">Từ vựng</a>, bấm vào một từ rồi chọn <strong>+ Thêm vào ôn tập</strong>, hoặc thêm cả danh sách HSK 1.</p>`
          : soon
            ? `<h2>Chờ chút…</h2><p>Thẻ bạn vừa quên sẽ quay lại sau ${formatInterval(Date.parse(soon.due) - now.getTime())}.</p>`
            : `<h2>Xong việc hôm nay 🎉</h2><p>Không còn thẻ đến hạn. Quay lại vào ngày mai nhé.</p>${resourceHint(["srs"], "Muốn ôn cả khi không mở web?")}`
      }
    </div>`;
    return;
  }

  const w = state.wordsById.get(card.wordId);
  if (!w) {
    root.innerHTML = `${header}<p class="notice">Thẻ trỏ tới từ không còn trong dữ liệu (${esc(card.wordId)}).</p>`;
    return;
  }
  const intervals = previewIntervals(card, now);
  const isNewCard = card.reps === 0;
  root.innerHTML = `${header}
    <div class="card rv-card" data-no-popup="${session.flipped ? "" : "1"}">
      <div class="row rv-meta"><span class="badge">${esc(CARD_TYPE_LABELS[card.cardType])}</span>${isNewCard ? `<span class="badge accent">Thẻ mới</span>` : ""}</div>
      <div class="rv-front">${front(card, w)}</div>
      ${session.flipped ? back(w) : ""}
    </div>
    <div class="rv-actions">
      ${
        session.flipped
          ? ([1, 2, 3, 4] as Rating[])
              .map(
                (r) => `<button class="btn rate rate-${r} ${session.suggested === r ? "suggested" : ""}" data-rate="${r}">
                  <span class="rate-label"><kbd>${r}</kbd> ${RATING_LABELS[r]}</span><span class="rate-ivl">${intervals[r]}</span></button>`,
              )
              .join("")
          : card.cardType === "write"
            ? `<button class="btn flip" data-flip>Không nhớ — hiện đáp án</button>`
            : `<button class="btn primary flip" data-flip>Lật thẻ <kbd>Space</kbd></button>`
      }
    </div>`;
  // phần tử không có data-no-popup="1" -> cho phép pop-up
  const cardEl = root.querySelector<HTMLElement>(".rv-card")!;
  if (session.flipped) cardEl.removeAttribute("data-no-popup");

  if (!session.flipped && card.cardType === "audio-zh") speak(w.hanzi);
  if (!session.flipped && card.cardType === "write") {
    mountWritingQuiz(root.querySelector<HTMLElement>(".quiz-area")!, w.hanzi, (mistakes) => {
      session.suggested = mistakes === 0 ? 3 : mistakes <= 3 ? 2 : 1;
      flip();
    });
  }
  if (session.flipped && card.cardType !== "audio-zh") speak(w.hanzi);
}

function flip() {
  if (!session.cardId || session.flipped) return;
  session.flipped = true;
  render();
}

function rate(r: Rating) {
  if (!session.cardId || !session.flipped) return;
  const id = session.cardId;
  session.cardId = null;
  session.reviewed++;
  setProgress((p) => ({ ...p, cards: applyReview(p.cards, id, r, new Date()) }), { activity: "reviews", silent: true });
  render();
  document.dispatchEvent(new CustomEvent("srs-changed"));
}

let installed = false;
export function mountReviewPage() {
  render();
  if (installed) return;
  installed = true;
  document.addEventListener("click", (e) => {
    if (!document.getElementById("review-root")) return;
    const t = e.target as HTMLElement;
    if (t.closest("[data-flip]")) flip();
    const r = t.closest<HTMLElement>("[data-rate]");
    if (r) rate(Number(r.dataset.rate) as Rating);
  });
  document.addEventListener("keydown", (e) => {
    if (!document.getElementById("review-root") || document.querySelector("dialog[open]")) return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    const card = session.cardId ? state.progress.cards.find((c) => c.id === session.cardId) : undefined;
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      if (!session.flipped) {
        if (card?.cardType === "write") return; // phải viết xong
        flip();
      } else if (card) {
        speak(state.wordsById.get(card.wordId)?.hanzi ?? "");
      }
    } else if (/^[1-4]$/.test(e.key) && session.flipped) {
      e.preventDefault();
      rate(Number(e.key) as Rating);
    }
  });
}
