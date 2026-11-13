import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createSegmenter, unknownHanzi } from "../src/lib/segment.ts";
import { sentencePinyin } from "../src/lib/sentence.ts";
import type { VocabFile } from "../src/types.ts";

const vocab: VocabFile = JSON.parse(readFileSync(new URL("../public/data/vocab/hsk1.json", import.meta.url), "utf8"));
const seg = createSegmenter(new Map(vocab.words.map((w) => [w.hanzi, w.id])));
const pyOf = (id: string) => vocab.words.find((w) => w.id === id)?.pinyin;
const texts = (s: string) => seg.segment(s).map((t) => t.text);
const py = (s: string) => sentencePinyin(seg.segment(s), pyOf);

describe("tách từ (forward maximum matching)", () => {
  it("ưu tiên từ dài nhất", () => {
    expect(texts("火车站在哪里？")).toEqual(["火车站", "在", "哪里", "？"]);
    expect(texts("我女儿在小学上学。")).toEqual(["我", "女儿", "在", "小学", "上学", "。"]);
  });
  it("token có wordId, dấu câu thì không", () => {
    const t = seg.segment("你好！");
    expect(t.map((x) => !!x.wordId)).toEqual([true, true, false]);
  });
  it("chữ ngoài từ điển được báo lại", () => {
    expect(unknownHanzi(seg.segment("我爱龙"))).toEqual(["龙"]);
  });
  it("chữ Latin/số gom thành 1 token", () => expect(texts("我有3个")).toEqual(["我", "有", "3", "个"]));
});

describe("pinyin câu + biến điệu 一 / 不", () => {
  it("不 + thanh 4 -> bú", () => expect(py("我不去。")).toBe("Wǒ bú qù."));
  it("不 + thanh khác giữ bù", () => expect(py("我不知道。")).toBe("Wǒ bù zhī dào."));
  it("一 + thanh 4 -> yí", () => expect(py("一个人")).toBe("Yí gè rén"));
  it("一 + thanh 3 -> yì", () => expect(py("一本书")).toBe("Yì běn shū"));
  it("一 trong số đếm giữ yī", () => expect(py("十一")).toBe("Shí yī"));
  it("dấu câu Trung -> Latin", () => expect(py("你好，谢谢！")).toBe("Nǐ hǎo, xiè xie!"));
  it("viết hoa đầu mỗi câu", () => expect(py("对不起！没关系。")).toBe("Duì bu qǐ! Méi guān xi."));
});

describe("câu ví dụ trong dữ liệu", () => {
  it("mọi câu đã tách từ, ghép lại đúng câu gốc, không có chữ lạ", () => {
    const exs = vocab.words.flatMap((w) => w.examples);
    expect(exs.length).toBeGreaterThan(0);
    for (const e of exs) {
      expect(e.tokens!.map((t) => t.text).join("")).toBe(e.zh);
      expect(unknownHanzi(e.tokens!)).toEqual([]);
    }
  });
});
