import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HSK_STANDARDS, getNewWordsTarget, wordLevel, wordsAtLevel } from "../src/config/hsk.ts";
import { validateWord, validateWordList } from "../src/data/validate.ts";
import { searchWords } from "../src/lib/search.ts";
import type { VocabFile, Word } from "../src/types.ts";

const vocab: VocabFile = JSON.parse(readFileSync(new URL("../public/data/vocab/hsk1.json", import.meta.url), "utf8"));

const good: Word = {
  id: "你好_ni3hao3",
  hanzi: "你好",
  pinyin: "nǐ hǎo",
  pinyinNumbered: "ni3 hao3",
  hanViet: "nhĩ hảo",
  meaningVi: "xin chào",
  hsk3Level: 1,
  examples: [],
};

describe("config HSK", () => {
  it("mặc định có cả 2 chuẩn, cấp tăng dần, số từ tích lũy tăng dần", () => {
    for (const std of Object.values(HSK_STANDARDS)) {
      std.levels.forEach((l, i) => {
        if (i > 0) {
          expect(l.level).toBeGreaterThan(std.levels[i - 1].level);
          expect(l.cumulativeWords).toBeGreaterThan(std.levels[i - 1].cumulativeWords);
        }
      });
    }
  });
  it("số từ mới từng cấp", () => {
    expect(getNewWordsTarget("3.0", 1)).toBe(300);
    expect(getNewWordsTarget("3.0", 2)).toBe(200);
    expect(getNewWordsTarget("2.0", 3)).toBe(300);
    expect(getNewWordsTarget("2.0", 9)).toBeUndefined();
  });
});

describe("validateWord", () => {
  it("từ hợp lệ không có lỗi", () => expect(validateWord(good)).toEqual([]));
  it("bắt lỗi pinyin số không khớp", () =>
    expect(validateWord({ ...good, pinyinNumbered: "ni2 hao3" }).map((i) => i.field)).toContain("pinyinNumbered"));
  it("bắt lỗi số âm tiết", () =>
    expect(validateWord({ ...good, pinyin: "nǐhǎo", pinyinNumbered: "ni3hao3" }).map((i) => i.field)).toContain("pinyin"));
  it("bắt lỗi số âm Hán Việt", () =>
    expect(validateWord({ ...good, hanViet: "nhĩ" }).map((i) => i.field)).toContain("hanViet"));
  it("chấp nhận nhi hóa", () =>
    expect(
      validateWord({ ...good, id: "x", hanzi: "一点儿", pinyin: "yī diǎnr", pinyinNumbered: "yi1 dian3r", hanViet: "nhất điểm nhi" }),
    ).toEqual([]));
  it("bắt lỗi cấp ngoài khoảng", () =>
    expect(validateWord({ ...good, hsk2Level: 7 }).map((i) => i.field)).toContain("hsk2Level"));
  it("bắt trùng hanzi trong danh sách", () =>
    expect(validateWordList([good, { ...good, id: "khác" }]).some((i) => i.field === "list")).toBe(true));
});

describe("dữ liệu HSK1 đã build", () => {
  it("hợp lệ hoàn toàn", () => expect(validateWordList(vocab.words)).toEqual([]));
  it("meta.count khớp số từ", () => expect(vocab.meta.count).toBe(vocab.words.length));
  it("HSK 3.0 cấp 1 xấp xỉ mục tiêu config (±5%)", () => {
    const n = wordsAtLevel(vocab.words, "3.0", 1).length;
    expect(Math.abs(n - getNewWordsTarget("3.0", 1)!) / getNewWordsTarget("3.0", 1)!).toBeLessThanOrEqual(0.05);
  });
  it("HSK 2.0 cấp 1 đủ 150 từ", () => expect(wordsAtLevel(vocab.words, "2.0", 1)).toHaveLength(150));
  it("mỗi từ thuộc cấp 1 của ít nhất một chuẩn", () => {
    for (const w of vocab.words) expect([wordLevel(w, "3.0"), wordLevel(w, "2.0")]).toContain(1);
  });
  it("mọi từ đều có âm Hán Việt và nghĩa Việt", () => {
    for (const w of vocab.words) {
      expect(w.hanViet, w.hanzi).toBeTruthy();
      expect(w.meaningVi, w.hanzi).toBeTruthy();
    }
  });
  it("cách đọc đa âm được chọn đúng", () => {
    const by = (h: string) => vocab.words.find((w) => w.hanzi === h)!;
    expect(by("了").pinyin).toBe("le");
    expect(by("便宜").pinyin).toBe("pián yi");
    expect(by("还").pinyin).toBe("hái");
    expect(by("百").meaningEn).not.toMatch(/surname/);
  });
});

describe("tìm kiếm", () => {
  const top = (q: string) => searchWords(vocab.words, q)[0]?.hanzi;
  it("Hán tự", () => expect(top("谢谢")).toBe("谢谢"));
  it("pinyin có dấu", () => expect(top("xiè xie")).toBe("谢谢"));
  it("pinyin số viết liền", () => expect(top("xie4xie5")).toBe("谢谢"));
  it("pinyin không dấu", () => expect(top("xiexie")).toBe("谢谢"));
  it("tiếng Việt có dấu", () => expect(top("cảm ơn")).toBe("谢谢"));
  it("tiếng Việt không dấu", () => expect(top("cam on")).toBe("谢谢"));
  it("Hán Việt", () => expect(top("tạ tạ")).toBe("谢谢"));
  it("chuỗi rỗng", () => expect(searchWords(vocab.words, "  ")).toEqual([]));
});
