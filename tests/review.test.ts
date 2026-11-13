import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { POS_LABELS } from "../src/lib/pos.ts";
import { REVIEW_COLUMNS, applyReviewRows, buildReviewTsv, parsePos, parseReviewTsv } from "../src/lib/review.ts";
import type { VocabFile } from "../src/types.ts";

const vocab: VocabFile = JSON.parse(readFileSync(new URL("../public/data/vocab/hsk1.json", import.meta.url), "utf8"));
const curated = readFileSync(new URL("../data/curated/hsk1.tsv", import.meta.url), "utf8");
const posFile = readFileSync(new URL("../data/curated/pos-hsk1.tsv", import.meta.url), "utf8");

/** Sửa một ô trong bảng duyệt theo hanzi. */
function edit(tsv: string, hanzi: string, col: (typeof REVIEW_COLUMNS)[number], value: string): string {
  const ci = REVIEW_COLUMNS.indexOf(col);
  return tsv
    .split("\n")
    .map((l) => {
      const c = l.split("\t");
      if (c[1] !== hanzi) return l;
      c[ci] = value;
      return c.join("\t");
    })
    .join("\n");
}

describe("dữ liệu từ vựng: từ loại, nghĩa, ví dụ", () => {
  it("mọi từ có từ loại hợp lệ, ít nhất một nghĩa và một câu ví dụ", () => {
    for (const w of vocab.words) {
      expect(w.pos?.length, w.hanzi).toBeGreaterThan(0);
      for (const c of w.pos!) expect(POS_LABELS[c], `${w.hanzi}: ${c}`).toBeTruthy();
      expect(w.senses?.length, w.hanzi).toBeGreaterThan(0);
      expect(w.examples.length, w.hanzi).toBeGreaterThan(0);
    }
  });
  it("câu ví dụ có chứa đúng từ đó", () => {
    for (const w of vocab.words) for (const e of w.examples) expect(e.tokens!.some((t) => t.wordId === w.id), `${w.hanzi}: ${e.zh}`).toBe(true);
  });
  it("tách nghĩa theo dấu chấm phẩy", () => {
    expect(vocab.words.find((w) => w.hanzi === "爱")!.senses).toEqual(["yêu", "thích"]);
  });
});

describe("bảng duyệt", () => {
  const tsv = buildReviewTsv(vocab.words);
  it("có BOM, tiêu đề đủ cột, mỗi từ một dòng", () => {
    expect(tsv.startsWith("﻿")).toBe(true);
    const lines = tsv.replace(/\n$/, "").split("\n");
    expect(lines[0].replace("﻿", "").split("\t")).toEqual([...REVIEW_COLUMNS]);
    expect(lines).toHaveLength(vocab.words.length + 1);
    expect(lines.every((l) => l.split("\t").length === REVIEW_COLUMNS.length)).toBe(true);
  });
  it("xuất rồi nhập lại không đổi gì", () => {
    const { rows, errors } = parseReviewTsv(tsv);
    expect(errors).toEqual([]);
    const r = applyReviewRows(curated, posFile, rows);
    expect(r.errors).toEqual([]);
    expect(r.changed).toEqual([]);
    expect(r.curated).toBe(curated.replace(/\r\n/g, "\n"));
  });
  it("duyệt “ok” -> reviewed; sửa nghĩa + từ loại được áp dụng", () => {
    let t = edit(tsv, "爱", "duyet", "ok");
    t = edit(t, "八", "nghia_viet", "số tám");
    t = edit(t, "八", "duyet", "OK");
    t = edit(t, "吧", "tu_loai", "trợ từ, động từ");
    const { rows, errors } = parseReviewTsv(t);
    expect(errors).toEqual([]);
    const r = applyReviewRows(curated, posFile, rows);
    expect(r.errors).toEqual([]);
    expect(r.approved).toBe(2);
    expect(r.curated).toMatch(/^爱\t\tái\tyêu; thích\treviewed$/m);
    expect(r.curated).toMatch(/^八\t\tbát\tsố tám\treviewed$/m);
    expect(r.posFile).toMatch(/^吧\tu,v$/m);
    expect(r.changed.map((c) => `${c.hanzi}:${c.field}`).sort()).toEqual(["八:nghĩa", "吧:từ loại"]);
  });
  it("sửa mà không ghi ok -> về bản nháp", () => {
    const base = curated.replace(/^(爱\t\tái\tyêu; thích)$/m, "$1\treviewed");
    const { rows } = parseReviewTsv(edit(tsv, "爱", "nghia_viet", "yêu thương"));
    expect(applyReviewRows(base, posFile, rows).curated).toMatch(/^爱\t\tái\tyêu thương$/m);
  });
  it("bắt lỗi: Hán Việt sai số chữ, từ loại lạ, thiếu cột", () => {
    const { rows } = parseReviewTsv(edit(tsv, "爸爸", "han_viet", "bá"));
    expect(applyReviewRows(curated, posFile, rows).errors.join()).toMatch(/không khớp số chữ/);
    expect(parseReviewTsv(edit(tsv, "吧", "tu_loai", "xyz")).errors.join()).toMatch(/không nhận ra/);
    expect(parseReviewTsv("a\tb\n1\t2").errors.join()).toMatch(/thiếu cột/);
  });
  it("nhận cả mã lẫn nhãn từ loại", () => {
    expect(parsePos("v, giới từ")).toEqual({ codes: ["v", "p"], bad: [] });
  });
});
