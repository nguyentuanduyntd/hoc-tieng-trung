import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RADICAL_PASS, buildRadicalQuiz, charsOf, isLearned, recordRadicalQuiz, topicProgress } from "../src/lib/radicals.ts";
import { sanitizeProgress } from "../src/lib/progress.ts";
import type { RadicalsFile, VocabFile } from "../src/types.ts";

const file: RadicalsFile = JSON.parse(readFileSync(new URL("../public/data/radicals.json", import.meta.url), "utf8"));
const vocab: VocabFile = JSON.parse(readFileSync(new URL("../public/data/vocab/hsk1.json", import.meta.url), "utf8"));
const strokeFile = (ch: string) => new URL(`../public/data/strokes/${ch}.json`, import.meta.url);

describe("dữ liệu bộ thủ", () => {
  it("≥ 50 bộ, đủ 7 nhóm chủ đề, mỗi nhóm có bộ", () => {
    expect(file.radicals.length).toBeGreaterThanOrEqual(50);
    expect(file.topics.map((t) => t.title)).toEqual(["Con người", "Thiên nhiên", "Động vật", "Hành động", "Phương hướng & nơi chốn", "Đồ vật", "Nét & biểu tượng"]);
    for (const t of file.topics) expect(file.radicals.some((r) => r.topic === t.id), t.id).toBe(true);
  });
  it("mỗi bộ có nghĩa, Hán Việt, số nét từng dạng, mẹo nhớ, ≥ 3 chữ ví dụ có pinyin", () => {
    for (const r of file.radicals) {
      expect(r.hanViet && r.meaningVi && r.mnemonic, r.id).toBeTruthy();
      for (const f of r.forms) expect(r.strokes[f], `${r.id} ${f}`).toBeGreaterThan(0);
      expect(r.examples.length, r.id).toBeGreaterThanOrEqual(3);
      expect(r.examples.length, r.id).toBeLessThanOrEqual(12);
      for (const e of r.examples) expect(e.pinyin, `${r.id} ${e.hanzi}`).toBeTruthy();
    }
    expect(file.radicals.filter((r) => r.examples.length >= 5).length / file.radicals.length).toBeGreaterThan(0.9);
  });
  it("pinyin chữ ví dụ là một âm tiết, chữ thường (không lấy pinyin cả từ)", () => {
    for (const r of file.radicals)
      for (const e of r.examples) {
        expect(e.pinyin, e.hanzi).not.toMatch(/\s/);
        expect(e.pinyin, e.hanzi).toBe(e.pinyin.toLowerCase());
      }
    expect(file.radicals.find((r) => r.id === "水")!.examples.find((e) => e.hanzi === "汉")?.pinyin).toBe("hàn");
  });
  it("biến thể quan trọng có mặt: 水→氵, 人→亻, 手→扌, 心→忄, 言→讠, 食→饣, 糸→纟, 金→钅", () => {
    const v = (id: string) => file.radicals.find((r) => r.id === id)!.variants;
    expect(v("水")).toContain("氵");
    expect(v("人")).toContain("亻");
    expect(v("手")).toContain("扌");
    expect(v("心")).toContain("忄");
    expect(v("言")).toContain("讠");
    expect(v("食")).toContain("饣");
    expect(v("糸")).toContain("纟");
    expect(v("金")).toContain("钅");
  });
  it("có dữ liệu nét cho dạng gốc + các dạng vẽ được, và mọi chữ ví dụ", () => {
    for (const r of file.radicals) {
      expect(r.drawable, r.id).toContain(r.id);
      for (const f of r.drawable) expect(existsSync(strokeFile(f)), f).toBe(true);
      for (const e of r.examples) expect(existsSync(strokeFile(e.hanzi)), e.hanzi).toBe(true);
    }
  });
  it("chữ HSK 1 có bộ thuộc danh mục ≥ 80%; chữ ví dụ ★ đúng là chữ HSK 1", () => {
    const hsk1 = new Set(vocab.words.flatMap((w) => [...w.hanzi]));
    expect(Object.keys(file.chars).length / hsk1.size).toBeGreaterThan(0.8);
    for (const r of file.radicals) for (const e of r.examples) expect(e.hsk1, e.hanzi).toBe(hsk1.has(e.hanzi));
  });
  it("số nét bộ thủ khớp số nét bộ trong dữ liệu nét (radStrokes) — trừ 习 (từ điển xếp bộ khác nhau)", () => {
    const EXCEPT = new Set(["习"]);
    const mismatch: string[] = [];
    for (const [ch, c] of Object.entries(file.chars)) {
      if (!c.radStrokes || EXCEPT.has(ch)) continue;
      const n = file.radicals.find((r) => r.id === c.radical)!.strokes[c.form];
      if (n !== c.radStrokes.length) mismatch.push(`${ch} ${c.form}`);
    }
    expect(mismatch).toEqual([]);
  });
});

describe("bài luyện", () => {
  it("nhận diện: đáp án là bộ của chữ, 4 lựa chọn khác nhau, nhiễu không phải phần khác của chữ", () => {
    const qs = buildRadicalQuiz(file, file.radicals.map((r) => r.id), 30, 7);
    const id = qs.filter((q) => q.kind === "identify");
    expect(id.length).toBeGreaterThan(5);
    for (const q of id) {
      expect(q.answer).toBe(file.chars[q.char].radical);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.answer);
      for (const o of q.options) if (o !== q.answer) expect(q.char.includes(o)).toBe(false);
    }
  });
  it("ghép: đáp án là chữ, có nét bộ; lựa chọn khác nhau", () => {
    const qs = buildRadicalQuiz(file, file.radicals.map((r) => r.id), 30, 11);
    const comp = qs.filter((q) => q.kind === "compose");
    expect(comp.length).toBeGreaterThan(5);
    for (const q of comp) {
      if (q.kind !== "compose") continue;
      expect(q.answer).toBe(q.char);
      expect(file.chars[q.char].radStrokes?.length).toBeGreaterThan(0);
      expect(new Set(q.options).size).toBe(4);
    }
  });
  it("cùng hạt giống -> cùng đề; luyện một bộ chỉ hỏi chữ của bộ đó", () => {
    const a = buildRadicalQuiz(file, ["口"], 6, 3);
    expect(buildRadicalQuiz(file, ["口"], 6, 3)).toEqual(a);
    for (const q of a) expect(file.chars[q.char].radical).toBe("口");
    expect(charsOf(file, new Set(["口"])).length).toBeGreaterThan(5);
  });
});

describe("tiến độ", () => {
  it("ghi điểm tốt nhất theo bộ, ≥ 80% là đã thuộc; tiến độ theo nhóm", () => {
    const qs = buildRadicalQuiz(file, ["女"], 4, 5);
    const r1 = recordRadicalQuiz({ radicals: {} }, file, qs.map((q, i) => ({ q, correct: i > 0 })), "2026-11-13");
    expect(r1["女"].best).toBe(Math.round((3 / qs.length) * 100) / 100);
    const r2 = recordRadicalQuiz({ radicals: r1 }, file, qs.map((q) => ({ q, correct: true })), "2026-11-14");
    expect(r2["女"]).toEqual({ best: 1, date: "2026-11-14" });
    const r3 = recordRadicalQuiz({ radicals: r2 }, file, qs.map((q) => ({ q, correct: false })), "2026-11-15");
    expect(r3["女"].best).toBe(1);
    expect(isLearned({ radicals: r2 }, "女")).toBe(true);
    expect(RADICAL_PASS).toBe(0.8);
    const tp = topicProgress(file, { radicals: r2 });
    expect(tp["con-nguoi"].learned).toBe(1);
    expect(tp["con-nguoi"].total).toBe(file.radicals.filter((r) => r.topic === "con-nguoi").length);
  });
  it("bộ chỉ có 1 câu trong bài thì không ghi điểm", () => {
    const q = buildRadicalQuiz(file, ["女"], 1, 5)[0];
    expect(recordRadicalQuiz({ radicals: {} }, file, [{ q, correct: true }], "2026-11-13")).toEqual({});
  });
  it("migration: tiến độ cũ không có `radicals` -> rỗng; giá trị sai bị bỏ", () => {
    expect(sanitizeProgress({}).radicals).toEqual({});
    expect(sanitizeProgress({ radicals: { 女: { best: 0.9, date: "2026-11-13" }, 口: { best: 2, date: "x" }, 木: "x" } }).radicals).toEqual({
      女: { best: 0.9, date: "2026-11-13" },
    });
  });
});
