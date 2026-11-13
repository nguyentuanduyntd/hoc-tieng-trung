import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { align, checkHanzi, checkPinyin, dictationStatus, recordSentence, splitTyped, targetSyllables } from "../src/lib/dictation.ts";
import { sanitizeProgress } from "../src/lib/progress.ts";
import type { ReadingSentence, ReadingsFile } from "../src/types.ts";

const readings: ReadingsFile = JSON.parse(readFileSync(new URL("../public/data/readings/hsk1.json", import.meta.url), "utf8"));
const allSentences = readings.readings.flatMap((r) => r.sentences);

/** Câu giả lập: mỗi token một từ. */
const S = (pairs: [string, string][]): Pick<ReadingSentence, "tokens" | "tokenPinyin"> => ({
  tokens: pairs.map(([text]) => ({ text })),
  tokenPinyin: pairs.map(([, py]) => py),
});
const woshi = S([["我", "wǒ"], ["是", "shì"], ["学生", "xué sheng"], ["。", ""]]);
const marks = (r: { cells: { mark: string }[] }) => r.cells.map((c) => c.mark).join(" ");

describe("căn hàng", () => {
  it("ghép / thay / thiếu / thừa", () => {
    const ops = align(["a", "b", "c"], ["a", "x", "c", "d"], (x, y) => x === y);
    expect(ops.map((o) => o.kind)).toEqual(["match", "sub", "match", "ins"]);
    expect(align(["a", "b"], ["b"], (x, y) => x === y).map((o) => o.kind)).toEqual(["del", "match"]);
  });
});

describe("chấm chữ Hán", () => {
  it("đúng hết, bỏ qua dấu câu và khoảng trắng", () => {
    const r = checkHanzi("我是学生。", " 我是 学生 ");
    expect(marks(r)).toBe("ok ok ok ok");
    expect(r.accuracy).toBe(1);
  });
  it("sai, thiếu, thừa", () => {
    const r = checkHanzi("我是学生。", "你是生生们");
    expect(r.cells.map((c) => [c.mark, c.got ?? ""])).toEqual([
      ["wrong", "你"],
      ["ok", ""],
      ["wrong", "生"],
      ["ok", ""],
    ]);
    expect(r.extra).toEqual(["们"]);
    expect(checkHanzi("我是学生", "我学生").cells.map((c) => c.mark)).toEqual(["ok", "missing", "ok", "ok"]);
  });
  it("chữ đồng âm (他/她) tính đúng nhưng đánh dấu", () => {
    const same = (a: string, b: string) => "他她它".includes(a) && "他她它".includes(b);
    const r = checkHanzi("她是老师。", "他是老师", same);
    expect(r.cells[0]).toEqual({ target: "她", mark: "homophone", got: "他" });
    expect(r.accuracy).toBe(1);
  });
});

describe("tách pinyin người học gõ", () => {
  const dict = ["wo", "shi", "xue", "sheng"];
  it("có cách, viết liền, số thanh, dấu thanh", () => {
    const L = (s: string) => splitTyped(s, dict).map((x) => x.letters + (x.tone ?? ""));
    expect(L("wo shi xue sheng")).toEqual(["wo", "shi", "xue", "sheng"]);
    expect(L("woshixuesheng")).toEqual(["wo", "shi", "xue", "sheng"]);
    expect(L("wo3shi4xue2sheng")).toEqual(["wo3", "shi4", "xue2", "sheng"]);
    expect(L("wǒ shì xuéshēng")).toEqual(["wo3", "shi4", "xue2", "sheng1"]);
    expect(L("WoShi")).toEqual(["wo", "shi"]);
  });
  it("phần không khớp thành một mảnh riêng", () => {
    expect(splitTyped("woxxxshi", dict).map((x) => x.letters)).toEqual(["wo", "xxx", "shi"]);
  });
  it("ü gõ bằng v / u: / ü; nhi hóa dian3r", () => {
    expect(splitTyped("nv3 nu:3 nǚ", ["nv"]).map((x) => x.letters + x.tone)).toEqual(["nv3", "nv3", "nv3"]);
    expect(splitTyped("yi4dian3r", ["yi", "dianr"]).map((x) => x.letters + x.tone)).toEqual(["yi4", "dianr3"]);
  });
});

describe("chấm pinyin", () => {
  it("không dấu, liền hay cách đều đúng", () => {
    expect(checkPinyin(woshi, "woshixuesheng").accuracy).toBe(1);
    expect(checkPinyin(woshi, "wo shi xue sheng").accuracy).toBe(1);
  });
  it("sai thanh = nửa điểm; thanh nhẹ gõ 5 hoặc bỏ trống đều đúng", () => {
    const r = checkPinyin(woshi, "wo3 shi2 xue2 sheng5");
    expect(marks(r)).toBe("ok tone ok ok");
    expect(r.accuracy).toBe(0.88);
    expect(r.cells[1]).toEqual({ target: "shì", mark: "tone", got: "shi2" });
  });
  it("thiếu và sai âm tiết", () => {
    expect(marks(checkPinyin(woshi, "wo xue sheng"))).toBe("ok missing ok ok");
    expect(marks(checkPinyin(woshi, "ni shi xue sheng"))).toBe("wrong ok ok ok");
  });
  it("一/不 biến điệu: thanh nào cũng được", () => {
    const s = S([["不", "bú"], ["是", "shì"]]);
    expect(marks(checkPinyin(s, "bu4 shi4"))).toBe("ok ok");
    expect(marks(checkPinyin(s, "bu2 shi4"))).toBe("ok ok");
  });
  it("mọi câu bài đọc: gõ lại đúng pinyin (không dấu, viết liền) đạt 100%", () => {
    for (const s of allSentences) {
      const typed = targetSyllables(s).map((x) => x.letters).join("");
      expect(checkPinyin(s, typed).accuracy, s.zh).toBe(1);
      expect(checkHanzi(s.zh, s.zh).accuracy).toBe(1);
    }
  });
});

describe("trạng thái bài", () => {
  it("Chưa học / Đang học / Xong", () => {
    expect(dictationStatus(undefined, 3)).toBe("new");
    expect(dictationStatus({ 0: 1 }, 3)).toBe("learning");
    expect(dictationStatus({ 0: 1, 1: 0.9, 2: 0.5 }, 3)).toBe("learning");
    expect(dictationStatus({ 0: 1, 1: 0.9, 2: 0.8 }, 3)).toBe("done");
  });
  it("chỉ giữ điểm tốt nhất", () => {
    let d = recordSentence({ dictation: {} }, "r1", 0, 0.5);
    d = recordSentence({ dictation: d }, "r1", 0, 0.3);
    expect(d).toEqual({ r1: { 0: 0.5 } });
    d = recordSentence({ dictation: d }, "r1", 0, 0.9);
    expect(d.r1[0]).toBe(0.9);
  });
  it("migration: dữ liệu cũ không có `dictation` -> rỗng; giá trị sai bị bỏ", () => {
    expect(sanitizeProgress({}).dictation).toEqual({});
    expect(sanitizeProgress({ dictation: { a: { 0: 0.5, 1: 2, x: 1 }, b: "x", c: {} } }).dictation).toEqual({ a: { 0: 0.5 } });
  });
  it("có ít nhất 10 bài chính tả HSK 1", () => expect(readings.readings.filter((r) => r.hskLevel === 1).length).toBeGreaterThanOrEqual(10));
});
