import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkAnswer } from "../src/lib/grading.ts";
import { sanitizeProgress } from "../src/lib/progress.ts";
import {
  READING_LIMITS,
  buildReading,
  estimateSpeechMs,
  nextSentenceIndex,
  shadowPauseMs,
  validateReading,
} from "../src/lib/readings.ts";
import { createSegmenter } from "../src/lib/segment.ts";
import { sentencePinyin, tokenPinyins } from "../src/lib/sentence.ts";
import { KNOWN_STABILITY, newCard, wordStatuses } from "../src/lib/srs.ts";
import type { ReadingsFile, VocabFile } from "../src/types.ts";

const vocab: VocabFile = JSON.parse(readFileSync(new URL("../public/data/vocab/hsk1.json", import.meta.url), "utf8"));
const file: ReadingsFile = JSON.parse(readFileSync(new URL("../public/data/readings/hsk1.json", import.meta.url), "utf8"));
const byId = new Map(vocab.words.map((w) => [w.id, w]));
const seg = createSegmenter(new Map(vocab.words.map((w) => [w.hanzi, w.id])));
const pyOf = (id: string) => byId.get(id)?.pinyin;

describe("dữ liệu bài đọc đã build", () => {
  it("có ít nhất 5 bài HSK 1", () => {
    expect(file.readings.filter((r) => r.hskLevel === 1).length).toBeGreaterThanOrEqual(5);
  });
  it("mỗi bài hợp lệ: 80–300 chữ, ≤ 5% từ ngoài cấp, 3–5 câu hỏi, tách từ đầy đủ", () => {
    for (const r of file.readings) expect(validateReading(r), r.id).toEqual([]);
  });
  it("có cả bài văn và hội thoại; hội thoại có người nói cho mọi câu", () => {
    expect(file.readings.some((r) => r.kind === "text")).toBe(true);
    const dialogues = file.readings.filter((r) => r.kind === "dialogue");
    expect(dialogues.length).toBeGreaterThan(0);
    for (const d of dialogues) for (const s of d.sentences) expect(d.speakers?.[s.speaker!]).toBeTruthy();
  });
  it("mọi token chữ Hán đều trỏ tới từ trong từ điển", () => {
    for (const r of file.readings)
      for (const s of r.sentences) for (const t of s.tokens) if (/\p{Script=Han}/u.test(t.text)) expect(byId.has(t.wordId!), t.text).toBe(true);
  });
});

describe("dựng bài đọc", () => {
  const levelOf = (w: { hsk3Level?: number; hsk2Level?: number }) => Math.min(w.hsk3Level ?? 99, w.hsk2Level ?? 99);
  const base = {
    id: "t",
    title: "t",
    kind: "text" as const,
    questions: [
      { q: "a", options: ["x", "y"], answer: 0 },
      { q: "b", options: ["x", "y"], answer: 1 },
      { q: "c", options: ["x", "y"], answer: 0 },
    ],
  };
  it("báo lỗi bài quá ngắn", () => {
    const { errors } = buildReading({ ...base, sentences: [{ zh: "你好。", vi: "Chào." }] }, 1, seg, byId, levelOf);
    expect(errors.some((e) => e.includes("chữ Hán"))).toBe(true);
  });
  it("báo lỗi chữ ngoài từ điển", () => {
    const { errors } = buildReading({ ...base, sentences: [{ zh: "我爱龙。", vi: "x" }] }, 1, seg, byId, levelOf);
    expect(errors.some((e) => e.includes("龙"))).toBe(true);
  });
  it("tính tỷ lệ từ ngoài cấp", () => {
    // thêm một từ giả cấp 5 vào từ điển
    const dragon = { ...vocab.words[0], id: "龙_long2", hanzi: "龙", pinyin: "lóng", pinyinNumbered: "long2", hsk3Level: 5, hsk2Level: undefined };
    const ids = new Map([...byId, [dragon.id, dragon]]);
    const seg2 = createSegmenter(new Map([...vocab.words.map((w) => [w.hanzi, w.id] as [string, string]), ["龙", dragon.id]]));
    const { reading } = buildReading({ ...base, sentences: [{ zh: "我爱龙。", vi: "x" }] }, 1, seg2, ids, levelOf);
    expect(reading.stats.outOfLevelRatio).toBeCloseTo(1 / 3, 2);
    expect(validateReading(reading).some((e) => e.includes("ngoài cấp"))).toBe(true);
  });
  it("hội thoại thiếu người nói bị báo lỗi", () => {
    const { errors } = buildReading({ ...base, kind: "dialogue", speakers: { A: "A" }, sentences: [{ zh: "你好。", vi: "x" }] }, 1, seg, byId, levelOf);
    expect(errors.some((e) => e.includes("người nói"))).toBe(true);
  });
  it("giới hạn theo SPEC", () => {
    expect(READING_LIMITS).toMatchObject({ minHanzi: 80, maxHanzi: 300, maxOutOfLevel: 0.05 });
  });
});

describe("pinyin từng từ (ruby) & lời dẫn", () => {
  it("cùng độ dài với tokens, dấu câu rỗng, có biến điệu", () => {
    const t = seg.segment("那件一百块。");
    const p = tokenPinyins(t, pyOf);
    expect(p).toHaveLength(t.length);
    expect(p[2]).toBe("yì"); // 一 trước 百 (thanh 3)
    expect(p.at(-1)).toBe("");
  });
  it("一 khi đếm vẫn giữ yī", () => expect(tokenPinyins(seg.segment("一二三"), pyOf)[0]).toBe("yī"));
  it("ngoặc kép: không dư dấu cách, viết hoa đầu lời dẫn", () => {
    expect(sentencePinyin(seg.segment("我说：“好！”"), pyOf)).toBe("Wǒ shuō: “Hǎo!”");
  });
});

describe("đọc hiểu", () => {
  it("chấm câu hỏi chọn đáp án", () => {
    const q = file.readings[0].questions[0];
    expect(checkAnswer(q, { type: "comprehension", value: q.answer as number })).toBe(true);
    expect(checkAnswer(q, { type: "comprehension", value: (q.answer as number) + 1 })).toBe(false);
  });
  it("lưu kết quả bài đọc, loại giá trị sai", () => {
    const p = sanitizeProgress({ readingResults: { a: { score: 0.5, date: "2026-11-13" }, b: { score: 3, date: "x" }, c: "?" } });
    expect(p.readingResults).toEqual({ a: { score: 0.5, date: "2026-11-13" } });
    expect(sanitizeProgress({}).readingResults).toEqual({});
  });
});

describe("trạng thái từ (tô màu)", () => {
  const T = new Date("2026-11-13T09:00:00");
  it("mới / đang học / đã thuộc", () => {
    const learning = { ...newCard("a", "zh-vi", T), reps: 2, stability: 5 };
    const known1 = { ...newCard("b", "zh-vi", T), reps: 5, stability: KNOWN_STABILITY + 1 };
    const known2 = { ...newCard("b", "vi-zh", T), reps: 4, stability: KNOWN_STABILITY };
    const mixed = [{ ...newCard("c", "zh-vi", T), reps: 5, stability: 40 }, { ...newCard("c", "vi-zh", T), reps: 1, stability: 2 }];
    const s = wordStatuses([learning, known1, known2, ...mixed, newCard("d", "zh-vi", T)]);
    expect(s.get("a")).toBe("learning");
    expect(s.get("b")).toBe("known");
    expect(s.get("c")).toBe("learning");
    expect(s.get("d")).toBe("learning"); // đã thêm vào ôn nhưng chưa học
    expect(s.get("e")).toBeUndefined(); // mới
  });
});

describe("nghe & shadowing", () => {
  it("khoảng dừng = thời lượng × 1,2, tối thiểu 1,2 giây", () => {
    expect(shadowPauseMs(2000)).toBe(2400);
    expect(shadowPauseMs(300)).toBe(1200);
    expect(shadowPauseMs(2000, 1.5)).toBe(3000);
  });
  it("ước lượng thời lượng tăng khi đọc chậm", () => {
    expect(estimateSpeechMs("你好", 0.5)).toBe(2 * estimateSpeechMs("你好", 1));
  });
  it("câu tiếp theo / lặp câu / hết bài", () => {
    expect(nextSentenceIndex(0, 3, false)).toBe(1);
    expect(nextSentenceIndex(2, 3, false)).toBeNull();
    expect(nextSentenceIndex(1, 3, true)).toBe(1);
  });
});
