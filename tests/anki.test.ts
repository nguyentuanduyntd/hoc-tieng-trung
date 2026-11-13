import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ANKI_COLUMNS, ankiField, buildAnkiTxt, difficultWordIds } from "../src/lib/anki.ts";
import { addWordCards, applyReview } from "../src/lib/srs.ts";
import type { VocabFile, Word } from "../src/types.ts";

const vocab: VocabFile = JSON.parse(readFileSync(new URL("../public/data/vocab/hsk1.json", import.meta.url), "utf8"));
const levelOf = (w: Word) => w.hsk3Level;
const T0 = new Date("2026-11-13T09:00:00");

/** Kiểm tra cấu trúc file giống cách Anki đọc: header #key:value, mỗi dòng đủ số cột. */
function parse(txt: string) {
  const lines = txt.split("\n").filter((l) => l !== "");
  const headers = Object.fromEntries(lines.filter((l) => l.startsWith("#")).map((l) => l.slice(1).split(/:(.*)/s).slice(0, 2)));
  const rows = lines.filter((l) => !l.startsWith("#")).map((l) => l.split("\t"));
  return { headers, rows };
}

describe("xuất Anki", () => {
  const txt = buildAnkiTxt(vocab.words, { level: 1, levelOf, filter: "all", cards: [], standardTag: "hsk3.0" });
  const { headers, rows } = parse(txt);

  it("header đúng định dạng Anki", () => {
    expect(txt.startsWith("#separator:Tab\n#html:true\n#deck:HocTiengTrung::HSK1\n")).toBe(true);
    expect(headers.columns).toBe(ANKI_COLUMNS.join("\t"));
    expect(headers["tags column"]).toBe("6");
  });

  it("mỗi dòng đủ 6 cột, Hán tự không trống", () => {
    expect(rows.length).toBe(vocab.words.filter((w) => w.hsk3Level === 1).length);
    for (const r of rows) {
      expect(r).toHaveLength(6);
      expect(r[0]).toBeTruthy();
    }
  });

  it("dòng mẫu theo SPEC", () => {
    const row = rows.find((r) => r[0] === "谢谢")!;
    expect(row.slice(0, 4)).toEqual(["谢谢", "xiè xie", "tạ tạ", "cảm ơn"]);
    expect(row[5]).toBe("hsk1 hsk3.0");
  });

  it("ví dụ dùng <br>, không có Tab/xuống dòng trong trường", () => {
    const withEx = rows.find((r) => r[4]);
    expect(withEx?.[4]).toMatch(/<br>/);
    expect(txt.split("\n").every((l) => !l.includes("\r"))).toBe(true);
  });

  it("làm sạch trường", () => {
    expect(ankiField('a\tb\nc <i>"x"</i> & y')).toBe("a b c &lt;i&gt;&quot;x&quot;&lt;/i&gt; &amp; y");
    expect(ankiField(undefined)).toBe("");
  });

  it("lọc: chỉ từ đã học / từ hay sai", () => {
    const [a, b] = vocab.words;
    let cards = addWordCards([], a.id, ["zh-vi"], T0);
    cards = addWordCards(cards, b.id, ["zh-vi"], T0);
    cards = applyReview(cards, `${a.id}::zh-vi`, 3, T0);
    const learned = parse(buildAnkiTxt(vocab.words, { levelOf, filter: "learned", cards })).rows;
    expect(learned.map((r) => r[0])).toEqual([a.hanzi]);

    const later = new Date(T0.getTime() + 5 * 86_400_000);
    cards = applyReview(cards, `${a.id}::zh-vi`, 1, later);
    cards = applyReview(cards, `${a.id}::zh-vi`, 3, later);
    cards = applyReview(cards, `${a.id}::zh-vi`, 1, new Date(later.getTime() + 2 * 86_400_000));
    expect(difficultWordIds(cards).has(a.id)).toBe(true);
    const hard = parse(buildAnkiTxt(vocab.words, { levelOf, filter: "difficult", cards })).rows;
    expect(hard.map((r) => r[0])).toEqual([a.hanzi]);
    expect(hard[0][5]).toContain("hay_sai");
  });

  it("không chọn cấp -> deck TatCa, gồm mọi từ", () => {
    const all = buildAnkiTxt(vocab.words, { levelOf, filter: "all", cards: [] });
    expect(all).toContain("#deck:HocTiengTrung::TatCa");
    expect(parse(all).rows).toHaveLength(vocab.words.length);
  });
});
