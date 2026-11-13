import { describe, expect, it } from "vitest";
import {
  applyTone,
  markedToNumbered,
  numberedKey,
  numberedToMarked,
  splitNumbered,
  stripTones,
  toneless,
} from "../src/lib/pinyin.ts";

describe("applyTone — quy tắc đặt dấu", () => {
  it.each([
    ["hao", 3, "hǎo"],
    ["xie", 4, "xiè"],
    ["gou", 3, "gǒu"],
    ["liu", 4, "liù"], // iu -> dấu trên u
    ["gui", 4, "guì"], // ui -> dấu trên i
    ["lv", 4, "lǜ"],
    ["nu:", 3, "nǚ"],
    ["ma", 5, "ma"],
    ["Bei", 3, "Běi"],
  ])("%s + thanh %i = %s", (s, t, out) => expect(applyTone(s, t)).toBe(out));
});

describe("numberedToMarked", () => {
  it("có dấu cách", () => expect(numberedToMarked("ni3 hao3")).toBe("nǐ hǎo"));
  it("viết liền (ni3hao3)", () => expect(numberedToMarked("ni3hao3")).toBe("nǐ hǎo"));
  it("thanh nhẹ 5", () => expect(numberedToMarked("ba4 ba5")).toBe("bà ba"));
  it("nhi hóa", () => expect(numberedToMarked("yi1 dian3r")).toBe("yī diǎnr"));
  it("ü viết bằng v", () => expect(numberedToMarked("nv3 er2")).toBe("nǚ ér"));
  it("âm tiết sau r không bị coi là nhi hóa", () => expect(splitNumbered("ren2ren2")).toEqual(["ren2", "ren2"]));
});

describe("markedToNumbered", () => {
  it.each([
    ["nǐ hǎo", "ni3 hao3"],
    ["bà ba", "ba4 ba5"],
    ["yī diǎnr", "yi1 dian3r"],
    ["zhèr", "zhe4r"],
    ["nǚ ér", "nü3 er2"],
    ["hǎo wánr", "hao3 wan2r"],
    ["Běi jīng", "Bei3 jing1"],
  ])("%s -> %s", (a, b) => expect(markedToNumbered(a)).toBe(b));

  it("chuyển đi chuyển lại không đổi", () => {
    for (const p of ["xiè xie", "duì bu qǐ", "lǜ", "qù nián", "hǎo wánr"]) {
      expect(numberedToMarked(markedToNumbered(p))).toBe(p);
    }
  });
});

describe("khóa tìm kiếm", () => {
  it("stripTones", () => expect(stripTones("nǚ hǎo")).toBe("nü hao"));
  it("toneless", () => expect(toneless("Nǚ ér")).toBe("nver"));
  it("numberedKey chấp nhận v/ü/u:", () => {
    expect(numberedKey("nü3 er2")).toBe("nv3er2");
    expect(numberedKey("nu:3er2")).toBe("nv3er2");
  });
});
