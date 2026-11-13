// Xuất từ vựng sang file .txt phân cách Tab để nhập thẳng vào Anki (File > Import).
// Định dạng header: https://docs.ankiweb.net/importing/text-files.html#file-headers

import type { SrsCard, Word } from "../types.ts";

export type AnkiFilter = "all" | "learned" | "difficult";

export interface AnkiExportOptions {
  /** Cấp HSK (theo `levelOf`); undefined = mọi cấp. */
  level?: number;
  levelOf: (w: Word) => number | undefined;
  filter: AnkiFilter;
  cards: SrsCard[];
  deckRoot?: string;
  /** Nhãn chuẩn đưa vào tag, vd "hsk3.0". */
  standardTag?: string;
}

export const ANKI_COLUMNS = ["Hanzi", "Pinyin", "HanViet", "NghiaViet", "ViDu", "Tags"] as const;

/** Từ có ít nhất 1 thẻ đã ôn. */
export function learnedWordIds(cards: SrsCard[]): Set<string> {
  return new Set(cards.filter((c) => c.reps > 0).map((c) => c.wordId));
}

/** Từ hay sai: tổng số lần quên ≥ 2, hoặc độ khó FSRS ≥ 7. */
export function difficultWordIds(cards: SrsCard[]): Set<string> {
  const lapses = new Map<string, number>();
  const hard = new Set<string>();
  for (const c of cards) {
    lapses.set(c.wordId, (lapses.get(c.wordId) ?? 0) + c.lapses);
    if (c.reps > 0 && c.difficulty >= 7) hard.add(c.wordId);
  }
  for (const [id, n] of lapses) if (n >= 2) hard.add(id);
  return hard;
}

/** Làm sạch một trường: bỏ Tab/xuống dòng, thoát HTML (vì header #html:true). */
export function ankiField(s: string | undefined): string {
  return (s ?? "")
    .replace(/[\t\r\n]+/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .trim();
}

const tag = (s: string) => s.replace(/\s+/g, "_");

export function selectWords(words: Word[], o: AnkiExportOptions): Word[] {
  const keep =
    o.filter === "learned" ? learnedWordIds(o.cards) : o.filter === "difficult" ? difficultWordIds(o.cards) : undefined;
  return words.filter((w) => (o.level === undefined || o.levelOf(w) === o.level) && (!keep || keep.has(w.id)));
}

export function buildAnkiTxt(words: Word[], o: AnkiExportOptions): string {
  const selected = selectWords(words, o);
  const deck = `${o.deckRoot ?? "HocTiengTrung"}::${o.level !== undefined ? `HSK${o.level}` : "TatCa"}`;
  const lines = [
    "#separator:Tab",
    "#html:true",
    `#deck:${deck}`,
    `#columns:${ANKI_COLUMNS.join("\t")}`,
    `#tags column:${ANKI_COLUMNS.length}`,
  ];
  for (const w of selected) {
    const ex = w.examples[0];
    const exHtml = ex ? `${ankiField(ex.zh)}<br>${ankiField(ex.pinyin)}<br>${ankiField(ex.vi)}` : "";
    const lv = o.levelOf(w);
    const tags = [lv !== undefined ? `hsk${lv}` : "", o.standardTag ? tag(o.standardTag) : "", o.filter === "difficult" ? "hay_sai" : ""]
      .filter(Boolean)
      .join(" ");
    lines.push([ankiField(w.hanzi), ankiField(w.pinyin), ankiField(w.hanViet), ankiField(w.meaningVi), exHtml, tags].join("\t"));
  }
  return lines.join("\n") + "\n";
}
