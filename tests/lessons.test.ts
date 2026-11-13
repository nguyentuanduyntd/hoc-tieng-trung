import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pickDistractors, seededRandom } from "../src/lib/exercises.ts";
import { SPEAK_PASS, checkAnswer, scoreSpeech, shuffleDifferent } from "../src/lib/grading.ts";
import { completeUnit, isUnlocked, lessonOrder, nextLesson, passed, validateLessons } from "../src/lib/lessons.ts";
import { applySandhi, tonesOf } from "../src/lib/tones.ts";
import type { Exercise, LessonsFile, VocabFile } from "../src/types.ts";

const vocab: VocabFile = JSON.parse(readFileSync(new URL("../public/data/vocab/hsk1.json", import.meta.url), "utf8"));
const lessons: LessonsFile = JSON.parse(readFileSync(new URL("../public/data/lessons/hsk1.json", import.meta.url), "utf8"));
const byHanzi = new Map(vocab.words.map((w) => [w.hanzi, w]));
const W = (h: string) => byHanzi.get(h)!;

describe("dữ liệu bài học đã build", () => {
  it("hợp lệ (từ tồn tại, 5–8 từ/bài, đủ 8 dạng bài, 4 phương án, …)", () => {
    expect(validateLessons(lessons, new Set(vocab.words.map((w) => w.id)))).toEqual([]);
  });
  it("có ít nhất 1 unit HSK 1 hoàn chỉnh", () => {
    expect(lessons.units.length).toBeGreaterThanOrEqual(1);
    expect(lessons.units[0].lessonIds.length).toBeGreaterThanOrEqual(3);
  });
  it("mỗi bài 10–16 bài tập (khoảng 5–10 phút)", () => {
    for (const l of lessons.lessons) {
      expect(l.exercises.length).toBeGreaterThanOrEqual(10);
      expect(l.exercises.length).toBeLessThanOrEqual(16);
    }
  });
  it("bài điền từ không dùng phương án cũng đúng ngữ pháp", () => {
    const all = lessons.lessons.flatMap((l) => l.exercises);
    for (const e of all) {
      if (e.type !== "fill-blank") continue;
      const opts = e.prompt.options.map((id) => vocab.words.find((w) => w.id === id)!.hanzi);
      if (e.prompt.sentence.zh === "我是老师。") expect(opts).not.toContain("叫");
      if (e.prompt.sentence.zh === "我没有哥哥。") expect(opts).not.toContain("有");
    }
  });
});

describe("phương án nhiễu", () => {
  it("không chọn từ đồng âm hoặc đại từ thay thế được", () => {
    const pool = ["他", "她", "我", "你", "老师", "是", "叫", "名字"].map(W);
    for (let i = 0; i < 20; i++) {
      const d = pickDistractors(W("他"), pool, 3, seededRandom(String(i))).map((w) => w.hanzi);
      expect(d).not.toContain("她"); // đồng âm tā
      expect(d).not.toContain("我"); // đại từ
      expect(d).toHaveLength(3);
    }
  });
  it("dùng pool dự phòng khi thiếu", () => {
    const d = pickDistractors(W("好"), [W("好"), W("你")], 3, seededRandom("x"), [], [W("老师"), W("谢谢"), W("再见")]);
    expect(d).toHaveLength(3);
  });
  it("seed cố định cho kết quả ổn định", () => {
    const a = seededRandom("hsk1-u1-l1");
    const b = seededRandom("hsk1-u1-l1");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("chấm bài", () => {
  const ex = (e: Partial<Exercise> & { type: Exercise["type"] }) => ({ id: "x", prompt: {}, ...e }) as Exercise;
  it("chọn đáp án", () => {
    const e = ex({ type: "choose-meaning", answer: "a" });
    expect(checkAnswer(e, { type: "choose-meaning", value: "a" })).toBe(true);
    expect(checkAnswer(e, { type: "choose-meaning", value: "b" })).toBe(false);
    expect(checkAnswer(e, { type: "listen-choose-hanzi", value: "a" })).toBe(false);
  });
  it("thanh điệu", () => expect(checkAnswer(ex({ type: "choose-tone", answer: 3 }), { type: "choose-tone", value: 3 })).toBe(true));
  it("sắp xếp câu: so theo chữ, chấp nhận mảnh trùng chữ", () => {
    const e = ex({ type: "order-words", answer: ["我", "是", "老师"] });
    expect(checkAnswer(e, { type: "order-words", value: ["我", "是", "老师"] })).toBe(true);
    expect(checkAnswer(e, { type: "order-words", value: ["老师", "是", "我"] })).toBe(false);
    expect(checkAnswer(e, { type: "order-words", value: ["我", "是"] })).toBe(false);
  });
  it("ghép cặp đúng khi không sai lần nào", () => {
    const e = ex({ type: "match-pairs", answer: [] });
    expect(checkAnswer(e, { type: "match-pairs", mistakes: 0 })).toBe(true);
    expect(checkAnswer(e, { type: "match-pairs", mistakes: 1 })).toBe(false);
  });
  it("nói: đạt khi ≥ ngưỡng", () => {
    const e = ex({ type: "speak", answer: "你好" });
    expect(checkAnswer(e, { type: "speak", score: SPEAK_PASS })).toBe(true);
    expect(checkAnswer(e, { type: "speak", score: 0.5 })).toBe(false);
  });
  it("trộn luôn khác thứ tự gốc", () => {
    for (let i = 0; i < 10; i++) expect(shuffleDifferent(["a", "b", "c"], seededRandom(String(i)))).not.toEqual(["a", "b", "c"]);
    expect(shuffleDifferent(["a", "a"])).toEqual(["a", "a"]);
  });
});

describe("chấm phát âm", () => {
  it("khớp hoàn toàn, bỏ qua dấu câu", () => {
    const r = scoreSpeech("你叫什么名字？", "你叫什么名字");
    expect(r.score).toBe(1);
    expect(r.chars.every((c) => c.ok)).toBe(true);
  });
  it("thiếu chữ -> tô sai đúng chữ đó", () => {
    const r = scoreSpeech("我是老师。", "我老师");
    expect(r.chars.map((c) => c.ok)).toEqual([true, false, true, true]);
    expect(r.score).toBe(0.75);
  });
  it("chữ đồng âm được tính đúng khi có hàm sameSound", () => {
    const same = (a: string, b: string) => ["他", "她", "它"].includes(a) && ["他", "她", "它"].includes(b);
    expect(scoreSpeech("她是老师", "他是老师", same).score).toBe(1);
    expect(scoreSpeech("她是老师", "他是老师").score).toBe(0.75);
  });
  it("nói thừa nhiều bị trừ điểm, không âm", () => {
    expect(scoreSpeech("你好", "你好你好你好").score).toBe(0);
    expect(scoreSpeech("你好", "").score).toBe(0);
  });
});

describe("thanh điệu & biến điệu", () => {
  it("tách thanh", () => {
    expect(tonesOf("nǐ hǎo")).toEqual([3, 3]);
    expect(tonesOf("xiè xie")).toEqual([4, 5]);
  });
  it("3-3 -> 2-3", () => expect(applySandhi([3, 3]).spoken).toEqual([2, 3]));
  it("chuỗi 3 thanh 3", () => expect(applySandhi([3, 3, 3]).spoken).toEqual([2, 2, 3]));
  it("不 + 4 -> 2; 不 + 1 giữ 4", () => {
    expect(applySandhi([4, 4], ["不", "是"]).spoken).toEqual([2, 4]);
    expect(applySandhi([4, 1], ["不", "吃"]).spoken).toEqual([4, 1]);
  });
  it("一 + 4 -> 2; 一 + 1/2/3 -> 4", () => {
    expect(applySandhi([1, 4], ["一", "个"]).spoken).toEqual([2, 4]);
    expect(applySandhi([1, 3], ["一", "本"]).spoken).toEqual([4, 3]);
    expect(applySandhi([1, 2], ["一", "年"]).spoken).toEqual([4, 2]);
  });
  it("có giải thích tiếng Việt", () => expect(applySandhi([3, 3]).notes[0]).toMatch(/thanh 3/));
});

describe("lộ trình & mở khóa", () => {
  const order = lessonOrder(lessons);
  it("bài đầu luôn mở, bài sau khóa đến khi xong bài trước", () => {
    expect(isUnlocked(lessons, order[0], [])).toBe(true);
    expect(isUnlocked(lessons, order[1], [])).toBe(false);
    expect(isUnlocked(lessons, order[1], [order[0]])).toBe(true);
    expect(isUnlocked(lessons, "khong-co", [])).toBe(false);
  });
  it("bài tiếp theo", () => {
    expect(nextLesson(lessons, [])).toBe(order[0]);
    expect(nextLesson(lessons, [order[0]])).toBe(order[1]);
    expect(nextLesson(lessons, order)).toBeUndefined();
  });
  it("thi vượt hoàn thành cả unit, không trùng", () => {
    const done = completeUnit(lessons.units[0], [order[0]]);
    expect(done).toEqual(lessons.units[0].lessonIds);
  });
  it("ngưỡng đạt", () => {
    expect(passed(8, 10, 0.8)).toBe(true);
    expect(passed(7, 10, 0.8)).toBe(false);
    expect(passed(0, 0, 0.8)).toBe(false);
  });
});

describe("bài luyện thanh", async () => {
  const { singleTonePool, tonePairPool, tonePairOptions } = await import("../src/lib/tones.ts");
  it("pool thanh đơn chỉ gồm từ 1 chữ có thanh 1–4", () => {
    const pool = singleTonePool(vocab.words);
    expect(pool.length).toBeGreaterThan(50);
    expect(pool.some((w) => w.hanzi === "吗")).toBe(false); // thanh nhẹ
    expect(pool.some((w) => w.hanzi === "好")).toBe(true);
  });
  it("pool cặp thanh gồm từ 2 âm tiết", () => {
    const pool = tonePairPool(vocab.words);
    expect(pool.every((w) => w.pinyin.split(" ").length === 2)).toBe(true);
    expect(pool.some((w) => w.hanzi === "一点儿")).toBe(false);
  });
  it("4 phương án cặp thanh, có đáp án, không trùng", () => {
    for (let i = 0; i < 30; i++) {
      const opts = tonePairOptions([3, 3], seededRandom(String(i)));
      expect(opts).toHaveLength(4);
      expect(opts.map((o) => o.join("-"))).toContain("3-3");
      expect(new Set(opts.map((o) => o.join("-"))).size).toBe(4);
    }
  });
});
