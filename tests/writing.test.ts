import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKSHEET,
  charInfo,
  classifyMistake,
  glyphSvg,
  lessonChars,
  miziGridSvg,
  mistakeMessage,
  pathDistance,
  resample,
  uniqueChars,
  worksheetCells,
  type StrokeJson,
} from "../src/lib/writing.ts";
import type { LessonsFile, VocabFile } from "../src/types.ts";

const vocab: VocabFile = JSON.parse(readFileSync(new URL("../public/data/vocab/hsk1.json", import.meta.url), "utf8"));
const lessons: LessonsFile = JSON.parse(readFileSync(new URL("../public/data/lessons/hsk1.json", import.meta.url), "utf8"));
const stroke = (ch: string): StrokeJson => JSON.parse(readFileSync(new URL(`../public/data/strokes/${ch}.json`, import.meta.url), "utf8"));
const pts = (m: [number, number][]) => m.map(([x, y]) => ({ x, y }));

describe("hình học nét", () => {
  it("lấy mẫu đều và khoảng cách", () => {
    const r = resample([{ x: 0, y: 0 }, { x: 100, y: 0 }], 5);
    expect(r.map((p) => p.x)).toEqual([0, 25, 50, 75, 100]);
    expect(pathDistance([{ x: 0, y: 0 }, { x: 100, y: 0 }], [{ x: 0, y: 10 }, { x: 100, y: 10 }])).toBeCloseTo(10);
  });
});

describe("chẩn đoán nét sai (chữ 十: nét 1 ngang, nét 2 sổ)", () => {
  const ten = stroke("十");
  const [h, v] = ten.medians;
  it("vẽ nét sổ khi đang tới nét ngang -> sai thứ tự", () => {
    const m = classifyMistake(pts(v), ten.medians, 0);
    expect(m).toEqual({ kind: "order", matched: 1 });
    expect(mistakeMessage(m, 0)).toMatch(/Sai thứ tự: đó là nét 2, cần viết nét 1 trước/);
  });
  it("vẽ ngang từ phải sang trái -> ngược hướng", () => {
    expect(classifyMistake(pts([...h].reverse()), ten.medians, 0).kind).toBe("backwards");
    expect(classifyMistake([], ten.medians, 0, true).kind).toBe("backwards");
  });
  it("vẽ linh tinh -> sai hình", () => {
    const m = classifyMistake([{ x: 0, y: 0 }, { x: 30, y: 800 }], ten.medians, 0);
    expect(m.kind).toBe("shape");
    expect(mistakeMessage(m, 0)).toMatch(/Nét 1/);
  });
});

describe("chọn chữ", () => {
  it("chữ không trùng, giữ thứ tự", () => expect(uniqueChars([{ hanzi: "你们" }, { hanzi: "我们" }, { hanzi: "你" }])).toEqual(["你", "们", "我"]));
  it("mọi bài học đều có chữ và đủ dữ liệu nét", () => {
    const byId = new Map(vocab.words.map((w) => [w.id, w]));
    for (const l of lessons.lessons) {
      const chars = lessonChars(l, byId);
      expect(chars.length, l.id).toBeGreaterThan(0);
      for (const ch of chars) expect(() => stroke(ch), ch).not.toThrow();
    }
  });
  it("thông tin chữ: từ một chữ + từ chứa chữ", () => {
    const i = charInfo("学", vocab.words);
    expect(i.pinyin).toBe("xué");
    expect(i.examples.length).toBeGreaterThan(0);
    for (const w of i.examples) expect(w.hanzi).toContain("学");
  });
});

describe("phiếu in", () => {
  it("dòng đầu: 1 ô mẫu, N ô mờ, còn lại trống", () => {
    const cells = worksheetCells({ rows: 2, traced: 3, cols: 6 });
    expect(cells).toEqual([
      ["model", "trace", "trace", "trace", "empty", "empty"],
      ["empty", "empty", "empty", "empty", "empty", "empty"],
    ]);
    expect(worksheetCells(DEFAULT_WORKSHEET)[0]).toHaveLength(DEFAULT_WORKSHEET.cols);
  });
  it("SVG chữ vẽ đúng số nét, đánh dấu nét mới", () => {
    const d = stroke("十");
    expect(glyphSvg(d).match(/<path/g)).toHaveLength(2);
    const step1 = glyphSvg(d, { upto: 1, lastClass: "ws-new" });
    expect(step1.match(/<path/g)).toHaveLength(1);
    expect(step1).toContain('class="ws-new"');
    expect(miziGridSvg()).toContain("M50 0V100");
  });
});
