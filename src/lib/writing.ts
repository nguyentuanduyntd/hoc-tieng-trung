// Luyện viết Mễ tự cách (SPEC 3.16) + phiếu in luyện viết (3.14) — phần thuần, không DOM.

import type { Lesson, Word } from "../types.ts";
import { isHanzi } from "./pinyin.ts";

export interface StrokeJson {
  strokes: string[];
  medians: [number, number][][];
}

type Pt = { x: number; y: number };

// ---------- Chẩn đoán nét sai ----------

function lengthOf(pts: Pt[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return d;
}

/** Lấy mẫu đều `n` điểm theo chiều dài đường. */
export function resample(pts: Pt[], n = 12): Pt[] {
  if (pts.length === 0) return [];
  if (pts.length === 1) return Array.from({ length: n }, () => ({ ...pts[0] }));
  const total = lengthOf(pts) || 1;
  const out: Pt[] = [{ ...pts[0] }];
  let seg = 1;
  let acc = 0;
  for (let k = 1; k < n - 1; k++) {
    const target = (total * k) / (n - 1);
    while (seg < pts.length - 1 && acc + Math.hypot(pts[seg].x - pts[seg - 1].x, pts[seg].y - pts[seg - 1].y) < target) {
      acc += Math.hypot(pts[seg].x - pts[seg - 1].x, pts[seg].y - pts[seg - 1].y);
      seg++;
    }
    const a = pts[seg - 1];
    const b = pts[seg];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const t = Math.min(1, Math.max(0, (target - acc) / len));
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  out.push({ ...pts[pts.length - 1] });
  return out;
}

/** Khoảng cách trung bình giữa hai đường (cùng chiều). */
export function pathDistance(a: Pt[], b: Pt[]): number {
  const ra = resample(a);
  const rb = resample(b);
  return ra.reduce((s, p, i) => s + Math.hypot(p.x - rb[i].x, p.y - rb[i].y), 0) / ra.length;
}

export type MistakeKind = "backwards" | "order" | "shape";

/** Ngưỡng (đơn vị lưới 1024) để coi nét vừa vẽ “giống” một nét của chữ. */
export const MATCH_DISTANCE = 140;

/**
 * Phân loại nét sai: `backwards` = đúng nét nhưng ngược hướng; `order` = vẽ trúng một nét khác
 * (chưa tới lượt) của chữ; `shape` = không giống nét nào.
 * `drawn`: các điểm người học vẽ, cùng hệ tọa độ với `medians` (Hanzi Writer trả về như vậy).
 */
export function classifyMistake(
  drawn: Pt[],
  medians: [number, number][][],
  strokeNum: number,
  isBackwards = false,
): { kind: MistakeKind; matched?: number } {
  if (isBackwards) return { kind: "backwards", matched: strokeNum };
  if (drawn.length < 2) return { kind: "shape" };
  const med = medians.map((m) => m.map(([x, y]) => ({ x, y })));
  let best = -1;
  let bestD = Infinity;
  med.forEach((m, i) => {
    const d = pathDistance(drawn, m);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  if (best >= 0 && bestD <= MATCH_DISTANCE && best !== strokeNum) return { kind: "order", matched: best };
  const rev = pathDistance([...drawn].reverse(), med[strokeNum] ?? []);
  if (med[strokeNum] && rev <= MATCH_DISTANCE && rev < pathDistance(drawn, med[strokeNum])) return { kind: "backwards", matched: strokeNum };
  return { kind: "shape" };
}

export function mistakeMessage(m: { kind: MistakeKind; matched?: number }, strokeNum: number): string {
  if (m.kind === "backwards") return `Nét ${strokeNum + 1}: đúng nét nhưng ngược hướng — viết lại theo chiều mũi tên gợi ý.`;
  if (m.kind === "order" && m.matched !== undefined)
    return m.matched > strokeNum
      ? `Sai thứ tự: đó là nét ${m.matched + 1}, cần viết nét ${strokeNum + 1} trước.`
      : `Nét ${m.matched + 1} đã viết rồi — giờ đến nét ${strokeNum + 1}.`;
  return `Nét ${strokeNum + 1} chưa đúng hình dạng hoặc vị trí — thử lại.`;
}

// ---------- Chọn chữ ----------

/** Các chữ Hán khác nhau trong danh sách từ, giữ thứ tự xuất hiện. */
export function uniqueChars(words: Pick<Word, "hanzi">[]): string[] {
  const seen = new Set<string>();
  for (const w of words) for (const ch of w.hanzi) if (isHanzi(ch)) seen.add(ch);
  return [...seen];
}

/** Chữ của một bài học (theo từ mới). */
export function lessonChars(lesson: Pick<Lesson, "newWordIds">, byId: Map<string, Word>): string[] {
  return uniqueChars(lesson.newWordIds.map((id) => byId.get(id)).filter((w): w is Word => !!w));
}

/** Thông tin hiển thị cho một chữ: ưu tiên từ một chữ; nếu không có thì lấy từ đầu tiên chứa chữ. */
export function charInfo(ch: string, words: Word[]): { pinyin?: string; hanViet?: string; meaning?: string; examples: Word[] } {
  const single = words.find((w) => w.hanzi === ch);
  const examples = words.filter((w) => w.hanzi !== ch && w.hanzi.includes(ch)).slice(0, 4);
  return { pinyin: single?.pinyin, hanViet: single?.hanViet, meaning: single?.meaningVi, examples };
}

// ---------- SVG chữ & lưới ----------

/** Phép biến đổi từ hệ tọa độ dữ liệu nét (Make Me a Hanzi, y hướng lên, gốc 900) sang SVG 1024. */
export const STROKE_TRANSFORM = "scale(1,-1) translate(0,-900)";

/** SVG của chữ: `upto` = số nét đầu tiên được vẽ (mặc định tất cả). */
export function glyphSvg(data: StrokeJson, opts: { upto?: number; className?: string; lastClass?: string } = {}): string {
  const n = opts.upto ?? data.strokes.length;
  const paths = data.strokes
    .slice(0, n)
    .map((d, i) => `<path d="${d}"${opts.lastClass && i === n - 1 ? ` class="${opts.lastClass}"` : ""}/>`)
    .join("");
  return `<svg viewBox="0 0 1024 1024" class="${opts.className ?? "glyph"}" aria-hidden="true"><g transform="${STROKE_TRANSFORM}">${paths}</g></svg>`;
}

/** Lưới Mễ tự cách (khung + chữ thập + hai đường chéo, nét đứt). */
export function miziGridSvg(className = "mizi-grid"): string {
  return `<svg viewBox="0 0 100 100" class="${className}" aria-hidden="true" preserveAspectRatio="none">
    <rect x="0.5" y="0.5" width="99" height="99" class="g-frame"/>
    <path d="M50 0V100M0 50H100M0 0L100 100M100 0L0 100" class="g-guide"/></svg>`;
}

export interface WorksheetOptions {
  /** Số dòng cho mỗi chữ. */
  rows: number;
  /** Số ô chữ mờ (để tô) ở dòng đầu, sau ô mẫu. */
  traced: number;
  /** Số ô mỗi dòng. */
  cols: number;
}

export const DEFAULT_WORKSHEET: WorksheetOptions = { rows: 2, traced: 5, cols: 10 };

/** Kiểu từng ô của một chữ: ô mẫu (đậm), ô tô (mờ), ô trống. */
export function worksheetCells(o: WorksheetOptions): ("model" | "trace" | "empty")[][] {
  return Array.from({ length: o.rows }, (_, r) =>
    Array.from({ length: o.cols }, (_, c) => {
      if (r === 0 && c === 0) return "model";
      if (r === 0 && c <= o.traced) return "trace";
      return "empty";
    }),
  );
}
