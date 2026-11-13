// Game gõ pinyin “Mưa từ vựng” (SPEC 3.12) — phần logic thuần, không đụng DOM, để test được.
// Thẻ rơi từ trên xuống (y: 0 → 1). Gõ đúng pinyin của một thẻ đang rơi thì thẻ nổ.
// Chấp nhận pinyin không dấu; gõ kèm thanh đúng (số hoặc dấu) thì nhân đôi điểm.

import type { SrsCard, UserProgress, Word } from "../types.ts";
import { syllableCount, toneless } from "./pinyin.ts";

export type GameMode = "text" | "audio";

// ---------- Chấm pinyin ----------

const TONE_OF: Record<string, number> = {};
for (const marks of ["āáǎà", "ēéěè", "īíǐì", "ōóǒò", "ūúǔù", "ǖǘǚǜ"])
  [...marks].forEach((m, i) => {
    TONE_OF[m] = i + 1;
    TONE_OF[m.toUpperCase()] = i + 1;
  });

/** Dãy thanh (bỏ thanh nhẹ) của chuỗi pinyin số hoặc có dấu: "ni3 hao3" -> "33", "bà ba" -> "4". */
function toneDigits(s: string): string {
  let out = "";
  for (const ch of s.normalize("NFC")) {
    if (/[1-4]/.test(ch)) out += ch;
    else if (TONE_OF[ch]) out += TONE_OF[ch];
  }
  return out;
}

/** Chữ cái không dấu, không cách: "Nǚ ér" | "nv3 er2" | "nu:3er2" -> "nver". */
function letters(s: string): string {
  return toneless(s.normalize("NFC").replace(/u:/gi, "ü").replace(/[0-9]/g, ""));
}

export interface PinyinJudgement {
  ok: boolean;
  /** Người chơi có gõ thanh và tất cả thanh đều đúng. */
  toneBonus: boolean;
}

/**
 * So pinyin người chơi gõ với pinyin số của từ (`Word.pinyinNumbered`).
 * Đúng khi khớp chữ cái (bỏ dấu, bỏ cách, ü = v = u:). Thưởng thanh khi có gõ thanh và dãy thanh
 * (không tính thanh nhẹ — gõ “5” hay bỏ trống đều được) trùng hoàn toàn.
 */
export function judgePinyin(targetNumbered: string, input: string): PinyinJudgement {
  const inp = input.trim();
  if (!inp) return { ok: false, toneBonus: false };
  const ok = letters(inp) === letters(targetNumbered);
  const typed = toneDigits(inp);
  return { ok, toneBonus: ok && typed.length > 0 && typed === toneDigits(targetNumbered) };
}

/** Nội dung hiện trên thẻ ở chế độ chữ: tối đa 2 nghĩa đầu. */
export const cardPrompt = (w: Word) => (w.senses?.length ? w.senses.slice(0, 2).join("; ") : w.meaningVi);

/**
 * Các từ được chấp nhận cho một thẻ: chính từ đó, và ở chế độ chữ thêm các từ trong nhóm có cùng
 * nội dung thẻ (vd “trước” = 前 / 前面) — người chơi không thể biết thẻ muốn từ nào.
 * Chế độ nghe: mọi từ đồng âm đều trùng pinyin nên tự đúng.
 */
export function acceptedWords(s: Pick<GameState, "mode" | "pool">, w: Word): Word[] {
  if (s.mode !== "text") return [w];
  const p = cardPrompt(w);
  return [w, ...s.pool.filter((x) => x.id !== w.id && cardPrompt(x) === p)];
}

// ---------- Trạng thái game ----------

export interface FallingCard {
  key: number;
  word: Word;
  boss: boolean;
  /** 0 = đỉnh, 1 = chạm đáy. */
  y: number;
  /** Tốc độ rơi, đơn vị “chiều cao khung” mỗi ms. */
  speed: number;
  /** Vị trí ngang 0..1 (chế độ chữ). */
  x: number;
}

export interface GameState {
  mode: GameMode;
  pool: Word[];
  cards: FallingCard[];
  score: number;
  lives: number;
  hits: number;
  toneHits: number;
  spawned: number;
  /** ms tới lần sinh thẻ tiếp theo. */
  spawnIn: number;
  /** Số lần sai trong ván (rơi chạm đáy hoặc gõ sai) theo wordId. */
  misses: Record<string, number>;
  recent: string[];
  over: boolean;
  nextKey: number;
}

export type GameEvent =
  | { type: "spawn"; card: FallingCard }
  | { type: "drop"; card: FallingCard }
  | { type: "hit"; card: FallingCard; points: number; toneBonus: boolean }
  | { type: "wrong"; card?: FallingCard }
  | { type: "over" };

export const LIVES = 3;
export const BOSS_EVERY = 5;
export const BASE_POINTS = 10;
export const BOSS_MULTIPLIER = 3;

/** Thời gian rơi hết khung (ms) — nhanh dần theo số từ đã bắn. */
export const fallMs = (hits: number) => Math.max(4500, 11000 * 0.95 ** hits);
/** Khoảng cách giữa hai lần sinh thẻ (ms). */
export const spawnGapMs = (hits: number) => Math.max(1300, 3400 * 0.95 ** hits);
/** Số thẻ tối đa cùng lúc: chế độ nghe luôn 1; chế độ chữ tăng dần tới 3. */
export const maxOnScreen = (mode: GameMode, hits: number) => (mode === "audio" ? 1 : Math.min(3, 1 + Math.floor(hits / 8)));

export function newGame(pool: Word[], mode: GameMode): GameState {
  return { mode, pool, cards: [], score: 0, lives: LIVES, hits: 0, toneHits: 0, spawned: 0, spawnIn: 600, misses: {}, recent: [], over: false, nextKey: 1 };
}

/** Từ boss: từ có nhiều âm tiết nhất trong nhóm (≥ 2). */
export function bossPool(pool: Word[]): Word[] {
  const multi = pool.filter((w) => syllableCount(w.pinyin) >= 2);
  if (!multi.length) return [];
  const longest = Math.max(...multi.map((w) => syllableCount(w.pinyin)));
  const long = multi.filter((w) => syllableCount(w.pinyin) >= Math.min(3, longest));
  return long.length >= 3 ? long : multi;
}

function pickWord(s: GameState, boss: boolean, rnd: () => number): Word {
  const onScreen = new Set(s.cards.map((c) => c.word.id));
  const base = boss ? bossPool(s.pool) : s.pool;
  const from = base.length ? base : s.pool;
  const fresh = from.filter((w) => !onScreen.has(w.id) && !s.recent.includes(w.id));
  const cands = fresh.length ? fresh : from.filter((w) => !onScreen.has(w.id));
  const list = cands.length ? cands : from;
  return list[Math.floor(rnd() * list.length)];
}

function spawn(s: GameState, rnd: () => number): FallingCard {
  const boss = s.spawned % BOSS_EVERY === BOSS_EVERY - 1 && bossPool(s.pool).length > 0;
  const word = pickWord(s, boss, rnd);
  const card: FallingCard = {
    key: s.nextKey++,
    word,
    boss,
    y: 0,
    speed: 1 / (fallMs(s.hits) * (boss ? 1.4 : 1)),
    x: s.mode === "audio" ? 0.5 : 0.15 + rnd() * 0.7,
  };
  s.cards.push(card);
  s.spawned++;
  s.recent = [...s.recent, word.id].slice(-Math.min(6, Math.max(0, s.pool.length - 2)));
  return card;
}

const miss = (s: GameState, id: string) => (s.misses[id] = (s.misses[id] ?? 0) + 1);

/** Tiến thời gian `dt` ms (thay đổi `s`), trả về sự kiện phát sinh. */
export function step(s: GameState, dt: number, rnd: () => number = Math.random): GameEvent[] {
  if (s.over) return [];
  const ev: GameEvent[] = [];
  for (const c of s.cards) c.y += c.speed * dt;
  for (const c of s.cards.filter((x) => x.y >= 1)) {
    s.cards = s.cards.filter((x) => x !== c);
    s.lives--;
    miss(s, c.word.id);
    ev.push({ type: "drop", card: c });
  }
  if (s.lives <= 0) {
    s.over = true;
    s.cards = [];
    ev.push({ type: "over" });
    return ev;
  }
  s.spawnIn -= dt;
  if (s.cards.length === 0 && s.spawnIn > 400) s.spawnIn = 400; // khung trống thì không bắt chờ lâu
  if (s.spawnIn <= 0 && s.cards.length < maxOnScreen(s.mode, s.hits)) {
    ev.push({ type: "spawn", card: spawn(s, rnd) });
    s.spawnIn = spawnGapMs(s.hits);
  }
  return ev;
}

/** Thẻ gần đáy nhất. */
const lowest = (cards: FallingCard[]) => cards.reduce<FallingCard | undefined>((a, c) => (!a || c.y > a.y ? c : a), undefined);

/** Người chơi nhấn Enter với chuỗi `input`. */
export function submit(s: GameState, input: string): GameEvent {
  if (s.over || !input.trim()) return { type: "wrong" };
  const matches = s.cards
    .map((c) => {
      const js = acceptedWords(s, c.word).map((w) => judgePinyin(w.pinyinNumbered, input));
      return { c, j: js.find((j) => j.toneBonus) ?? js.find((j) => j.ok) ?? js[0] };
    })
    .filter((m) => m.j.ok)
    .sort((a, b) => b.c.y - a.c.y);
  const m = matches[0];
  if (!m) {
    const target = lowest(s.cards);
    if (target) miss(s, target.word.id);
    return { type: "wrong", card: target };
  }
  s.cards = s.cards.filter((c) => c !== m.c);
  const points = BASE_POINTS * (m.c.boss ? BOSS_MULTIPLIER : 1) * (m.j.toneBonus ? 2 : 1);
  s.score += points;
  s.hits++;
  if (m.j.toneBonus) s.toneHits++;
  return { type: "hit", card: m.c, points, toneBonus: m.j.toneBonus };
}

/** Từ gõ sai trong ván, nhiều lần sai trước. */
export function missedWords(s: GameState): { word: Word; count: number }[] {
  const byId = new Map(s.pool.map((w) => [w.id, w]));
  return Object.entries(s.misses)
    .map(([id, count]) => ({ word: byId.get(id)!, count }))
    .filter((x) => x.word)
    .sort((a, b) => b.count - a.count);
}

// ---------- Lưu kết quả ----------

/** Từ “yếu”: từng gõ sai trong game (chưa đủ 2 lần để vào ôn tập) hoặc có thẻ ôn tập từng quên. */
export function weakWordIds(p: Pick<UserProgress, "wordMisses" | "cards">): Set<string> {
  const ids = new Set(Object.keys(p.wordMisses).filter((id) => p.wordMisses[id] > 0));
  for (const c of p.cards as SrsCard[]) if (c.lapses > 0) ids.add(c.wordId);
  return ids;
}

export const MISSES_TO_SRS = 2;

export interface GameOutcome {
  /** Bộ đếm sai mới (đã xóa các từ vừa đưa vào ôn tập). */
  wordMisses: Record<string, number>;
  /** Từ đạt ngưỡng sai -> đưa vào ôn tập. */
  toSrs: string[];
  /** Kỷ lục mới (nếu phá kỷ lục). */
  record?: { score: number; date: string };
}

/** Gộp số lần sai của ván vào bộ đếm tích lũy; từ sai ≥ 2 lần thì chuyển sang ôn tập. */
export function settleGame(
  prev: Pick<UserProgress, "wordMisses" | "gameRecords">,
  mode: GameMode,
  score: number,
  sessionMisses: Record<string, number>,
  date: string,
): GameOutcome {
  const wordMisses = { ...prev.wordMisses };
  const toSrs: string[] = [];
  for (const [id, n] of Object.entries(sessionMisses)) {
    const total = (wordMisses[id] ?? 0) + n;
    if (total >= MISSES_TO_SRS) {
      toSrs.push(id);
      delete wordMisses[id];
    } else wordMisses[id] = total;
  }
  const key = recordKey(mode);
  const best = prev.gameRecords[key]?.score ?? 0;
  return { wordMisses, toSrs, record: score > best ? { score, date } : undefined };
}

export const recordKey = (mode: GameMode) => `pinyin-${mode}`;
