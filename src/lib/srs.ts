// Lặp lại ngắt quãng theo FSRS-4.5 (Free Spaced Repetition Scheduler, mã nguồn mở).
// Công thức: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
// Module thuần (không đụng DOM/storage) để dễ test.

import type { SrsCard } from "../types.ts";

export type Rating = 1 | 2 | 3 | 4; // Quên / Khó / Được / Dễ
export const RATING_LABELS: Record<Rating, string> = { 1: "Quên", 2: "Khó", 3: "Được", 4: "Dễ" };
export type CardType = SrsCard["cardType"];
export const CARD_TYPE_LABELS: Record<CardType, string> = {
  "zh-vi": "Hán tự → nghĩa",
  "vi-zh": "Nghĩa → Hán tự",
  "audio-zh": "Nghe → Hán tự",
  write: "Viết tay",
};

/** Tham số mặc định của FSRS-4.5. */
export const DEFAULT_W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246,
  1.587, 0.2272, 2.8755,
] as const;

const DECAY = -0.5;
const FACTOR = 19 / 81; // để R(S, S) = 0.9
const DAY_MS = 86_400_000;

export interface SrsParams {
  w: readonly number[];
  /** Tỷ lệ nhớ mục tiêu khi đến hạn. */
  requestRetention: number;
  maximumInterval: number;
  /** Thẻ bấm "Quên" được hỏi lại sau bao nhiêu phút (trong phiên). */
  relearnMinutes: number;
}

export const DEFAULT_PARAMS: SrsParams = {
  w: DEFAULT_W,
  requestRetention: 0.9,
  maximumInterval: 365 * 3,
  relearnMinutes: 1,
};

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Xác suất còn nhớ sau `t` ngày với độ ổn định `s`. */
export function retrievability(t: number, s: number): number {
  return Math.pow(1 + (FACTOR * t) / s, DECAY);
}

/** Khoảng cách (ngày) để xác suất nhớ giảm xuống `requestRetention`. */
export function nextInterval(s: number, p: SrsParams = DEFAULT_PARAMS): number {
  const raw = (s / FACTOR) * (Math.pow(p.requestRetention, 1 / DECAY) - 1);
  return clamp(Math.round(raw), 1, p.maximumInterval);
}

const initStability = (g: Rating, w: readonly number[]) => Math.max(w[g - 1], 0.1);
const initDifficulty = (g: Rating, w: readonly number[]) => clamp(w[4] - (g - 3) * w[5], 1, 10);

function nextDifficulty(d: number, g: Rating, w: readonly number[]): number {
  const d1 = d - w[6] * (g - 3);
  return clamp(w[7] * initDifficulty(3, w) + (1 - w[7]) * d1, 1, 10);
}

function recallStability(d: number, s: number, r: number, g: Rating, w: readonly number[]): number {
  const hard = g === 2 ? w[15] : 1;
  const easy = g === 4 ? w[16] : 1;
  return s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) * hard * easy);
}

function forgetStability(d: number, s: number, r: number, w: readonly number[]): number {
  return Math.min(s, w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r)));
}

export function newCard(wordId: string, cardType: CardType, now: Date): SrsCard {
  return {
    id: `${wordId}::${cardType}`,
    wordId,
    cardType,
    due: now.toISOString(),
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
  };
}

export const isNew = (c: SrsCard) => c.reps === 0;

/** Chấm một thẻ, trả về thẻ mới (không sửa thẻ cũ). */
export function review(card: SrsCard, rating: Rating, now: Date, p: SrsParams = DEFAULT_PARAMS): SrsCard {
  const w = p.w;
  let s: number;
  let d: number;
  if (isNew(card)) {
    s = initStability(rating, w);
    d = initDifficulty(rating, w);
  } else {
    const elapsed = card.lastReview ? Math.max(0, Math.floor((now.getTime() - Date.parse(card.lastReview)) / DAY_MS)) : 0;
    const r = retrievability(elapsed, card.stability);
    d = nextDifficulty(card.difficulty, rating, w);
    s = rating === 1 ? forgetStability(card.difficulty, card.stability, r, w) : recallStability(card.difficulty, card.stability, r, rating, w);
  }
  s = clamp(s, 0.1, 36500);

  let due: Date;
  if (rating === 1) {
    due = new Date(now.getTime() + p.relearnMinutes * 60_000);
  } else {
    const ivl = nextInterval(s, p);
    due = new Date(now.getTime() + ivl * DAY_MS);
  }
  return {
    ...card,
    stability: round(s),
    difficulty: round(d),
    reps: card.reps + 1,
    lapses: card.lapses + (rating === 1 && !isNew(card) ? 1 : 0),
    lastReview: now.toISOString(),
    due: due.toISOString(),
  };
}

const round = (x: number) => Math.round(x * 10000) / 10000;

/** Xem trước khoảng cách cho 4 nút chấm, để hiện trên nút. */
export function previewIntervals(card: SrsCard, now: Date, p: SrsParams = DEFAULT_PARAMS): Record<Rating, string> {
  const out = {} as Record<Rating, string>;
  for (const g of [1, 2, 3, 4] as Rating[]) out[g] = formatInterval(Date.parse(review(card, g, now, p).due) - now.getTime());
  return out;
}

export function formatInterval(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${Math.max(1, min)} phút`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} giờ`;
  const days = Math.round(ms / DAY_MS);
  if (days < 30) return `${days} ngày`;
  if (days < 365) return `${Math.round(days / 30)} tháng`;
  return `${(days / 365).toFixed(1)} năm`;
}

// ---------- Hàng ôn mỗi ngày ----------

/** Ngày địa phương dạng YYYY-MM-DD. */
export function localDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Số thẻ mới đã học lần đầu trong hôm nay. */
export function newIntroducedToday(cards: SrsCard[], now: Date): number {
  const today = localDate(now);
  return cards.filter((c) => c.reps > 0 && c.firstReview && localDate(new Date(c.firstReview)) === today).length;
}

export interface Queue {
  /** Thẻ đã học, đến hạn (gồm cả thẻ vừa "Quên" trong phiên). */
  due: SrsCard[];
  /** Thẻ mới được phép học hôm nay. */
  fresh: SrsCard[];
}

export function buildQueue(cards: SrsCard[], now: Date, newPerDay: number): Queue {
  const t = now.getTime();
  const due = cards.filter((c) => !isNew(c) && Date.parse(c.due) <= t).sort((a, b) => Date.parse(a.due) - Date.parse(b.due));
  const remaining = Math.max(0, newPerDay - newIntroducedToday(cards, now));
  // Giống Anki: thẻ mới "anh em" (cùng từ, khác loại) để sang ngày khác nếu hôm nay từ đó đã được ôn.
  const today = localDate(now);
  const touchedToday = new Set(cards.filter((c) => c.lastReview && localDate(new Date(c.lastReview)) === today).map((c) => c.wordId));
  const fresh = cards
    .filter((c) => isNew(c) && !touchedToday.has(c.wordId))
    .sort((a, b) => Date.parse(a.due) - Date.parse(b.due))
    .slice(0, remaining);
  return { due, fresh };
}

/** Thẻ tiếp theo cần hỏi: ưu tiên thẻ đến hạn, rồi tới thẻ mới. */
export function nextCard(q: Queue): SrsCard | undefined {
  return q.due[0] ?? q.fresh[0];
}

/** Thẻ sẽ đến hạn trong phút tới (để chờ trong phiên thay vì kết thúc). */
export function nextDueSoon(cards: SrsCard[], now: Date, withinMs = 10 * 60_000): SrsCard | undefined {
  const t = now.getTime();
  return cards
    .filter((c) => !isNew(c) && Date.parse(c.due) > t && Date.parse(c.due) - t <= withinMs)
    .sort((a, b) => Date.parse(a.due) - Date.parse(b.due))[0];
}

/** Áp dụng chấm điểm vào danh sách thẻ (trả về mảng mới). */
export function applyReview(cards: SrsCard[], cardId: string, rating: Rating, now: Date, p: SrsParams = DEFAULT_PARAMS): SrsCard[] {
  return cards.map((c) => {
    if (c.id !== cardId) return c;
    const next = review(c, rating, now, p);
    return isNew(c) ? { ...next, firstReview: now.toISOString() } : next;
  });
}

/** Thêm thẻ cho một từ (bỏ qua loại thẻ đã có). */
export function addWordCards(cards: SrsCard[], wordId: string, types: CardType[], now: Date): SrsCard[] {
  const have = new Set(cards.map((c) => c.id));
  const added = types.map((t) => newCard(wordId, t, now)).filter((c) => !have.has(c.id));
  return added.length ? [...cards, ...added] : cards;
}

/** Đặt lại một từ về trạng thái "đến hạn ngay" (vd khi làm sai đề thi). */
export function markWordForReview(cards: SrsCard[], wordId: string, now: Date): SrsCard[] {
  return cards.map((c) => (c.wordId === wordId && !isNew(c) && Date.parse(c.due) > now.getTime() ? { ...c, due: now.toISOString() } : c));
}

// ---------- Trạng thái thuộc từ (tô màu trong bài đọc) ----------

export type WordStatus = "known" | "learning" | "new";

/** Ngưỡng độ ổn định (ngày) để coi là "đã thuộc". */
export const KNOWN_STABILITY = 21;

/** Map wordId -> trạng thái: đã thuộc (mọi thẻ đã ôn có S ≥ 21 ngày), đang học (có thẻ), mới (chưa có thẻ). */
export function wordStatuses(cards: SrsCard[]): Map<string, WordStatus> {
  const byWord = new Map<string, SrsCard[]>();
  for (const c of cards) byWord.set(c.wordId, [...(byWord.get(c.wordId) ?? []), c]);
  const out = new Map<string, WordStatus>();
  for (const [id, cs] of byWord) {
    const reviewed = cs.filter((c) => c.reps > 0);
    out.set(id, reviewed.length > 0 && reviewed.every((c) => c.stability >= KNOWN_STABILITY) ? "known" : "learning");
  }
  return out;
}
