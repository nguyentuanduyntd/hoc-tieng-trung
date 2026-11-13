// Chép chính tả (SPEC 3.13): so khớp câu người học gõ (pinyin hoặc chữ Hán) với câu đích,
// tô từng âm tiết / chữ: đúng · sai thanh · đồng âm · sai · thiếu, và liệt kê phần gõ thừa.

import type { ReadingSentence, UserProgress } from "../types.ts";
import { isHanzi, parseMarkedSyllable, toneless } from "./pinyin.ts";

export type Mark = "ok" | "homophone" | "tone" | "wrong" | "missing";

export interface Cell {
  /** Âm tiết (pinyin có dấu) hoặc chữ Hán của câu đích. */
  target: string;
  mark: Mark;
  /** Phần người học gõ ở vị trí này (khi khác đích). */
  got?: string;
}

export interface DictationResult {
  cells: Cell[];
  /** Phần gõ thừa (không ứng với vị trí nào của câu đích). */
  extra: string[];
  /** 0..1 — đúng = 1, sai thanh / đồng âm = 0.5 / 1, trừ 0.5 cho mỗi phần thừa. */
  accuracy: number;
}

/** Ngưỡng coi một câu là “xong”. */
export const PASS = 0.8;

// ---------- Căn hàng (Levenshtein + truy vết) ----------

type Op<T, U> = { kind: "match" | "sub"; a: T; b: U } | { kind: "del"; a: T } | { kind: "ins"; b: U };

/** Căn hai dãy: ghép được (chi phí 0), thay (2 = bằng thiếu + thừa, nên ưu tiên giữ nhiều chỗ khớp nhất; hòa thì chọn thay). */
export function align<T, U>(a: T[], b: U[], same: (x: T, y: U) => boolean): Op<T, U>[] {
  const n = a.length;
  const m = b.length;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      d[i][j] = Math.min(d[i - 1][j - 1] + (same(a[i - 1], b[j - 1]) ? 0 : 2), d[i - 1][j] + 1, d[i][j - 1] + 1);
  const ops: Op<T, U>[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (same(a[i - 1], b[j - 1]) ? 0 : 2)) {
      ops.push({ kind: same(a[i - 1], b[j - 1]) ? "match" : "sub", a: a[i - 1], b: b[j - 1] });
      i--;
      j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      ops.push({ kind: "del", a: a[i - 1] });
      i--;
    } else {
      ops.push({ kind: "ins", b: b[j - 1] });
      j--;
    }
  }
  return ops.reverse();
}

const WEIGHT: Record<Mark, number> = { ok: 1, homophone: 1, tone: 0.5, wrong: 0, missing: 0 };

function finish(cells: Cell[], extra: string[]): DictationResult {
  const n = cells.length || 1;
  const score = cells.reduce((s, c) => s + WEIGHT[c.mark], 0) - extra.length * 0.5;
  return { cells, extra, accuracy: Math.round(Math.max(0, score / n) * 100) / 100 };
}

// ---------- Chữ Hán ----------

/**
 * Chấm khi gõ chữ Hán. `sameSound(a, b)` (tùy chọn): hai chữ đồng âm (vd 他/她/它) — nghe không
 * phân biệt được nên tính đúng, đánh dấu “đồng âm”.
 */
export function checkHanzi(targetZh: string, input: string, sameSound?: (a: string, b: string) => boolean): DictationResult {
  const t = [...targetZh].filter(isHanzi);
  const g = [...input.normalize("NFC")].filter(isHanzi);
  const near = (x: string, y: string) => x === y || (sameSound?.(x, y) ?? false);
  const cells: Cell[] = [];
  const extra: string[] = [];
  for (const op of align(t, g, near)) {
    if (op.kind === "match") cells.push(op.a === op.b ? { target: op.a, mark: "ok" } : { target: op.a, mark: "homophone", got: op.b });
    else if (op.kind === "sub") cells.push({ target: op.a, mark: "wrong", got: op.b });
    else if (op.kind === "del") cells.push({ target: op.a, mark: "missing" });
    else extra.push(op.b);
  }
  return finish(cells, extra);
}

// ---------- Pinyin ----------

export interface TargetSyllable {
  marked: string;
  /** Chữ cái không dấu, ü -> v. */
  letters: string;
  tone: number;
  /** 一 / 不: biến điệu theo ngữ cảnh — chấp nhận mọi thanh. */
  anyTone: boolean;
}

/** Các âm tiết của câu (dùng pinyin từng token, đã áp biến điệu 一/不). */
export function targetSyllables(s: Pick<ReadingSentence, "tokens" | "tokenPinyin">): TargetSyllable[] {
  const out: TargetSyllable[] = [];
  s.tokens.forEach((tok, k) => {
    const py = s.tokenPinyin[k];
    if (!py) return;
    const chars = [...tok.text].filter(isHanzi);
    py.trim()
      .split(/\s+/)
      .forEach((syl, i) => {
        const [, tone] = parseMarkedSyllable(syl);
        const letters = toneless(syl);
        out.push({ marked: syl, letters, tone, anyTone: (chars[i] === "一" && letters === "yi") || (chars[i] === "不" && letters === "bu") });
      });
  });
  return out;
}

export interface TypedSyllable {
  letters: string;
  /** Thanh người học gõ (số hoặc dấu); undefined = không gõ thanh. */
  tone?: number;
  raw: string;
}

const MARKS: Record<string, [string, number]> = {};
for (const [base, marks] of [["a", "āáǎà"], ["e", "ēéěè"], ["i", "īíǐì"], ["o", "ōóǒò"], ["u", "ūúǔù"], ["v", "ǖǘǚǜ"]] as const)
  [...marks].forEach((m, i) => (MARKS[m] = [base, i + 1]));

/**
 * Tách chuỗi pinyin người học gõ thành âm tiết. Dấu cách, dấu câu, số thanh là ranh giới chắc chắn;
 * đoạn viết liền (vd "woshixuesheng") được tách theo các âm tiết có trong câu đích, phần không khớp giữ
 * thành một mảnh riêng (sẽ bị chấm sai).
 */
export function splitTyped(input: string, dict: string[]): TypedSyllable[] {
  const words = [...new Set(dict)].sort((a, b) => b.length - a.length);
  const out: TypedSyllable[] = [];
  const text = input.normalize("NFC").toLowerCase().replace(/u:/g, "v").replace(/ü/g, "v");
  for (const chunk of text.split(/[^a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ1-5]+/).filter(Boolean)) {
    // tách tiếp theo số thanh: "ni3hao3" -> ["ni3", "hao3"]
    for (const part of chunk.match(/[^1-5]+[1-5]?|[1-5]/g) ?? []) {
      const digit = /[1-5]$/.test(part) ? Number(part.slice(-1)) : undefined;
      const body = digit ? part.slice(0, -1) : part;
      if (!body) continue;
      // nhi hóa gõ "dian3r": mảnh "r" dính vào âm tiết trước
      if (body === "r" && out.length) {
        out[out.length - 1].letters += "r";
        out[out.length - 1].raw += "r";
        continue;
      }
      let plain = "";
      const markAt: (number | undefined)[] = [];
      for (const ch of body) {
        const m = MARKS[ch];
        plain += m ? m[0] : ch;
        markAt.push(m?.[1]);
      }
      const pieces = segment(plain, words);
      pieces.forEach(([a, b], idx) => {
        const marked = markAt.slice(a, b).find((x) => x !== undefined);
        const tone = marked ?? (idx === pieces.length - 1 ? digit : undefined);
        out.push({ letters: plain.slice(a, b), tone, raw: body.slice(a, b) + (idx === pieces.length - 1 && digit ? String(digit) : "") });
      });
    }
  }
  return out;
}

/** Tách `s` thành các khoảng [a, b): ưu tiên phủ nhiều chữ cái bằng từ trong `dict`, ít mảnh nhất. */
function segment(s: string, dict: string[]): [number, number][] {
  const n = s.length;
  // best[i] = [số chữ cái khớp từ điển, -số mảnh] cho tiền tố s[0..i)
  const best: [number, number][] = Array.from({ length: n + 1 }, () => [-1, 0]);
  const prev: { from: number; word: boolean }[] = new Array(n + 1);
  best[0] = [0, 0];
  const better = (x: [number, number], y: [number, number]) => x[0] > y[0] || (x[0] === y[0] && x[1] > y[1]);
  for (let i = 0; i < n; i++) {
    if (best[i][0] < 0) continue;
    for (const w of dict) {
      if (w && s.startsWith(w, i)) {
        const cand: [number, number] = [best[i][0] + w.length, best[i][1] - 1];
        if (better(cand, best[i + w.length])) {
          best[i + w.length] = cand;
          prev[i + w.length] = { from: i, word: true };
        }
      }
    }
    // một chữ cái “rác”: chỉ tính thêm mảnh nếu chữ trước không phải rác
    const junkNewPiece = !(prev[i] && !prev[i].word);
    const cand: [number, number] = [best[i][0], best[i][1] - (junkNewPiece ? 1 : 0)];
    if (better(cand, best[i + 1])) {
      best[i + 1] = cand;
      prev[i + 1] = { from: i, word: false };
    }
  }
  const raw: { a: number; b: number; word: boolean }[] = [];
  for (let i = n; i > 0; i = prev[i].from) raw.push({ a: prev[i].from, b: i, word: prev[i].word });
  raw.reverse();
  // gộp các chữ cái rác liền nhau
  const out: [number, number][] = [];
  let junkStart = -1;
  raw.forEach((p, k) => {
    if (!p.word) {
      if (junkStart < 0) junkStart = p.a;
      if (k === raw.length - 1 || raw[k + 1].word) {
        out.push([junkStart, p.b]);
        junkStart = -1;
      }
    } else out.push([p.a, p.b]);
  });
  return out;
}

/** Chấm khi gõ pinyin. Không gõ thanh = chỉ chấm âm; có gõ thanh thì thanh sai bị đánh dấu “sai thanh”. */
export function checkPinyin(s: Pick<ReadingSentence, "tokens" | "tokenPinyin">, input: string): DictationResult {
  const t = targetSyllables(s);
  const g = splitTyped(input, t.map((x) => x.letters));
  const cells: Cell[] = [];
  const extra: string[] = [];
  for (const op of align(t, g, (x, y) => x.letters === y.letters)) {
    if (op.kind === "match") {
      const toneOk = op.b.tone === undefined || op.a.anyTone || op.b.tone === op.a.tone || (op.a.tone === 5 && op.b.tone === 5);
      cells.push(toneOk ? { target: op.a.marked, mark: "ok" } : { target: op.a.marked, mark: "tone", got: op.b.raw });
    } else if (op.kind === "sub") cells.push({ target: op.a.marked, mark: "wrong", got: op.b.raw });
    else if (op.kind === "del") cells.push({ target: op.a.marked, mark: "missing" });
    else extra.push(op.b.raw);
  }
  return finish(cells, extra);
}

// ---------- Trạng thái bài ----------

export type DictationStatus = "done" | "learning" | "new";

/** Xong = mọi câu đạt ≥ PASS; Đang học = đã làm ít nhất một câu; Chưa học. */
export function dictationStatus(best: Record<string, number> | undefined, sentenceCount: number): DictationStatus {
  if (!best || !Object.keys(best).length) return "new";
  for (let i = 0; i < sentenceCount; i++) if ((best[i] ?? 0) < PASS) return "learning";
  return "done";
}

/** Ghi điểm tốt nhất của một câu. */
export function recordSentence(p: Pick<UserProgress, "dictation">, readingId: string, index: number, accuracy: number): UserProgress["dictation"] {
  const cur = p.dictation[readingId] ?? {};
  if ((cur[index] ?? -1) >= accuracy) return p.dictation;
  return { ...p.dictation, [readingId]: { ...cur, [index]: accuracy } };
}
