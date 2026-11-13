import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXAM_CONFIGS, getExamConfig } from "../src/config/exams.ts";
import { allQuestions, applyWrongToSrs, buildExam, formatClock, scoreExam, validateExam, wrongWordIds } from "../src/lib/exam.ts";
import { createSegmenter } from "../src/lib/segment.ts";
import { applyReview } from "../src/lib/srs.ts";
import type { Exam, ExamsFile, VocabFile } from "../src/types.ts";

const vocab: VocabFile = JSON.parse(readFileSync(new URL("../public/data/vocab/hsk1.json", import.meta.url), "utf8"));
const file: ExamsFile = JSON.parse(readFileSync(new URL("../public/data/exams/hsk1.json", import.meta.url), "utf8"));
const exam = file.exams.find((e) => e.standard === "3.0" && e.level === 1)!;
const config = getExamConfig("3.0", 1)!;
const byId = new Map(vocab.words.map((w) => [w.id, w]));
const byHanzi = new Map(vocab.words.map((w) => [w.hanzi, w]));
const seg = createSegmenter(new Map(vocab.words.map((w) => [w.hanzi, w.id])));
const T = new Date("2026-11-13T09:00:00");

const allCorrect = (x: Exam) => Object.fromEntries(allQuestions(x).map((q) => [q.id, q.answer]));

describe("config cấu trúc đề", () => {
  it("mỗi chuẩn/cấp: tổng câu khớp phần, điểm đạt < tổng điểm", () => {
    for (const c of EXAM_CONFIGS) {
      expect(c.sections.reduce((n, s) => n + s.scoreMax, 0)).toBe(c.totalScore);
      expect(c.passScore).toBeLessThan(c.totalScore);
      for (const s of c.sections) for (const p of s.parts) expect(p.count).toBeGreaterThan(0);
    }
  });
  it("HSK 3.0 cấp 1: 40 câu (nghe 20, đọc 20), chưa xác minh chính thức", () => {
    const counts = config.sections.map((s) => s.parts.reduce((n, p) => n + p.count, 0));
    expect(counts).toEqual([20, 20]);
    expect(config.verified).toBe(false);
  });
  it("không có cấu trúc cho cấp chưa cấu hình", () => expect(getExamConfig("3.0", 9)).toBeUndefined());
});

describe("đề HSK 1 chuẩn 3.0 đã build", () => {
  it("hợp lệ theo config", () => expect(validateExam(exam, config)).toEqual([]));
  it("đủ 40 câu, đánh số 1..40", () => {
    const qs = allQuestions(exam);
    expect(qs).toHaveLength(40);
    expect(qs.map((q) => q.number)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
  });
  it("từ khóa của mọi câu đều có trong từ điển", () => {
    for (const q of allQuestions(exam)) for (const id of q.keyWordIds) expect(byId.has(id), id).toBe(true);
  });
  it("đáp án không dồn vào một vị trí", () => {
    const pos = new Set(allQuestions(exam).filter((q) => q.options.length === 3).map((q) => q.answer));
    expect(pos.size).toBe(3);
  });
});

describe("kiểm tra đề sai cấu trúc", () => {
  const baseSpec = JSON.parse(readFileSync(new URL("../data/curated/exams/hsk1-3.0-01.json", import.meta.url), "utf8"));
  it("thiếu câu trong một phần", () => {
    const spec = structuredClone(baseSpec);
    spec.parts.L1.pop();
    expect(buildExam(spec, config, seg, byId, byHanzi).errors.some((e) => e.includes("L1") && e.includes("cần 5"))).toBe(true);
  });
  it("sai số phương án, đáp án ngoài phạm vi, chữ lạ, từ khóa lạ", () => {
    const spec = structuredClone(baseSpec);
    spec.parts.L2[0].options = ["🥛", "🍵"];
    spec.parts.R4[0].answer = 7;
    spec.parts.R2[0].text = "我爱龙。";
    spec.parts.R3[0].keyWords = ["龙"];
    const errs = buildExam(spec, config, seg, byId, byHanzi).errors.join("\n");
    expect(errs).toMatch(/cần 3 phương án/);
    expect(errs).toMatch(/đáp án ngoài phạm vi/);
    expect(errs).toMatch(/龙/);
    expect(errs).toMatch(/từ khóa "龙"/);
  });
  it("phần Đúng/Sai toàn một đáp án bị cảnh báo", () => {
    const spec = structuredClone(baseSpec);
    for (const q of spec.parts.R1) q.answer = true;
    expect(buildExam(spec, config, seg, byId, byHanzi).errors.some((e) => e.includes("cả câu đúng và câu sai"))).toBe(true);
  });
  it("phần không có trong cấu trúc", () => {
    const spec = structuredClone(baseSpec);
    spec.parts.L9 = [];
    expect(buildExam(spec, config, seg, byId, byHanzi).errors.some((e) => e.includes("L9"))).toBe(true);
  });
});

describe("chấm điểm", () => {
  it("làm đúng hết = 200, đạt", () => {
    const r = scoreExam(exam, config, allCorrect(exam));
    expect(r.total).toBe(200);
    expect(r.passed).toBe(true);
    expect(r.wrongIds).toEqual([]);
    expect(r.sections.map((s) => s.score)).toEqual([100, 100]);
  });
  it("bỏ trống = sai, 0 điểm, không đạt", () => {
    const r = scoreExam(exam, config, {});
    expect(r.total).toBe(0);
    expect(r.passed).toBe(false);
    expect(r.unansweredIds).toHaveLength(40);
  });
  it("điểm từng phần: sai 4 câu nghe -> nghe 80; ngưỡng đạt 120", () => {
    const a = allCorrect(exam);
    const listening = exam.sections[0].parts.flatMap((p) => p.questions);
    for (const q of listening.slice(0, 4)) a[q.id] = (q.answer + 1) % q.options.length;
    const r = scoreExam(exam, config, a);
    expect(r.sections[0]).toMatchObject({ correct: 16, total: 20, score: 80 });
    expect(r.total).toBe(180);
    expect(r.wrongIds).toHaveLength(4);
  });
  it("đúng 12/40 (60 điểm) không đạt; đúng 24/40 (120) đạt", () => {
    const qs = allQuestions(exam);
    const pick = (n: number) => Object.fromEntries(qs.map((q, i) => [q.id, i < n ? q.answer : (q.answer + 1) % q.options.length]));
    expect(scoreExam(exam, config, pick(12)).passed).toBe(false);
    // 20 câu nghe + 4 câu đọc đúng = 100 + 20 = 120
    expect(scoreExam(exam, config, pick(24)).total).toBe(120);
    expect(scoreExam(exam, config, pick(24)).passed).toBe(true);
  });
});

describe("câu sai -> ôn tập", () => {
  it("lấy từ khóa của câu sai, không trùng", () => {
    const qs = allQuestions(exam);
    const ids = wrongWordIds(exam, [qs[0].id, qs[0].id, qs[1].id]);
    expect(ids).toEqual([...new Set([...qs[0].keyWordIds, ...qs[1].keyWordIds])]);
  });
  it("từ chưa có thẻ -> tạo thẻ; từ đã học -> đến hạn ngay", () => {
    const [a, b] = vocab.words;
    let cards = applyWrongToSrs([], [a.id], ["zh-vi", "vi-zh"], T);
    expect(cards.map((c) => c.id)).toEqual([`${a.id}::zh-vi`, `${a.id}::vi-zh`]);
    cards = applyReview(cards, `${a.id}::zh-vi`, 3, T); // hẹn 4 ngày sau
    const later = new Date(T.getTime() + 86_400_000);
    cards = applyWrongToSrs(cards, [a.id, b.id], ["zh-vi"], later);
    expect(Date.parse(cards.find((c) => c.id === `${a.id}::zh-vi`)!.due)).toBe(later.getTime());
    expect(cards.some((c) => c.wordId === b.id)).toBe(true);
  });
});

describe("đồng hồ", () => {
  it.each([
    [17 * 60_000, "17:00"],
    [61_500, "01:02"],
    [0, "00:00"],
    [-5000, "00:00"],
  ])("%i ms -> %s", (ms, s) => expect(formatClock(ms)).toBe(s));
});
