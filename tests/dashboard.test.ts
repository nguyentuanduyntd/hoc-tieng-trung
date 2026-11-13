import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RESOURCES } from "../src/config/resources.ts";
import {
  addStudySeconds,
  emptyDay,
  goalRatio,
  isResourceReady,
  lastDays,
  learnerStats,
  levelProgress,
  logActivity,
  pickNextReading,
  shiftDate,
  suggestResources,
  todayPlan,
} from "../src/lib/dashboard.ts";
import { STUDY_LOG_DAYS, defaultProgress, sanitizeProgress } from "../src/lib/progress.ts";
import { KNOWN_STABILITY, newCard } from "../src/lib/srs.ts";
import type { VocabFile } from "../src/types.ts";

const vocab: VocabFile = JSON.parse(readFileSync(new URL("../public/data/vocab/hsk1.json", import.meta.url), "utf8"));
const TODAY = "2026-11-13";

describe("nhật ký học", () => {
  it("cộng hoạt động và giây học theo ngày", () => {
    let p = defaultProgress();
    p = logActivity(p, "reviews", TODAY, 5);
    p = logActivity(p, "reviews", TODAY);
    p = logActivity(p, "lessons", TODAY);
    p = addStudySeconds(p, TODAY, 90);
    p = addStudySeconds(p, TODAY, -10); // không trừ
    expect(p.studyLog[TODAY]).toEqual({ ...emptyDay(), reviews: 6, lessons: 1, seconds: 90 });
  });
  it(`chỉ giữ ${STUDY_LOG_DAYS} ngày gần nhất`, () => {
    let p = defaultProgress();
    for (let i = 0; i < STUDY_LOG_DAYS + 10; i++) p = addStudySeconds(p, shiftDate(TODAY, -i), 60);
    const keys = Object.keys(p.studyLog).sort();
    expect(keys).toHaveLength(STUDY_LOG_DAYS);
    expect(keys.at(-1)).toBe(TODAY);
  });
  it("sanitize bỏ khóa ngày sai và số âm", () => {
    const p = sanitizeProgress({ studyLog: { "2026-11-13": { seconds: 30, reviews: -2 }, hôm_nay: { seconds: 5 } } });
    expect(p.studyLog).toEqual({ "2026-11-13": { ...emptyDay(), seconds: 30 } });
  });
  it("7 ngày gần nhất, có cả ngày trống, qua ranh giới tháng", () => {
    let p = defaultProgress();
    p = addStudySeconds(p, "2026-11-01", 600);
    p = addStudySeconds(p, "2026-10-31", 125);
    const d = lastDays(p.studyLog, "2026-11-02", 7);
    expect(d.map((x) => x.date)).toEqual(["2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(d.map((x) => x.minutes)).toEqual([0, 0, 0, 0, 2, 10, 0]);
  });
  it("tỷ lệ mục tiêu ngày", () => {
    expect(goalRatio(300, 10)).toBe(0.5);
    expect(goalRatio(3600, 10)).toBe(1);
    expect(goalRatio(60, 0)).toBe(0);
  });
});

describe("việc nên làm hôm nay", () => {
  const base = { due: 0, fresh: 0, totalCards: 0, today: emptyDay() };
  it("thứ tự: ôn SRS -> bài học -> bài đọc; bước kế tiếp là bước đầu chưa xong", () => {
    const r = todayPlan({ ...base, due: 3, fresh: 2, totalCards: 10, nextLesson: { id: "l2", title: "Bài 2" }, nextReading: { id: "r1", title: "R1" } });
    expect(r.steps.map((s) => s.id)).toEqual(["srs", "lesson", "reading"]);
    expect(r.next?.id).toBe("srs");
    expect(r.steps[0].detail).toContain("3 thẻ đến hạn");
  });
  it("ôn xong -> gợi ý bài học; học xong bài hôm nay -> bài đọc", () => {
    const a = todayPlan({ ...base, totalCards: 10, nextLesson: { id: "l2", title: "Bài 2" }, nextReading: { id: "r1", title: "R1" } });
    expect(a.next?.id).toBe("lesson");
    expect(a.next?.href).toBe("#/bai-hoc/l2");
    const b = todayPlan({ ...base, totalCards: 10, today: { ...emptyDay(), lessons: 1 }, nextLesson: { id: "l3", title: "Bài 3" }, nextReading: { id: "r1", title: "R1" } });
    expect(b.next?.id).toBe("reading");
  });
  it("làm đủ cả 3 -> không còn bước", () => {
    const r = todayPlan({ ...base, totalCards: 5, today: { ...emptyDay(), lessons: 1, readings: 1, reviews: 4 }, nextLesson: { id: "x", title: "x" }, nextReading: { id: "y", title: "y" } });
    expect(r.next).toBeUndefined();
    expect(r.steps.every((s) => s.done)).toBe(true);
  });
  it("người mới chưa có thẻ được hướng dẫn học bài đầu", () => {
    expect(todayPlan({ ...base, nextLesson: { id: "l1", title: "Bài 1" } }).steps[0].detail).toMatch(/Chưa có thẻ/);
  });
  it("chọn bài đọc tiếp theo", () => {
    const rs = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(pickNextReading(rs, { a: { score: 1, date: TODAY } })?.id).toBe("b");
    const all = { a: { score: 1, date: "2026-11-10" }, b: { score: 0.5, date: "2026-11-01" }, c: { score: 0.2, date: "2026-11-01" } };
    expect(pickNextReading(rs, all)?.id).toBe("c"); // cũ nhất, điểm thấp hơn
  });
});

describe("tiến độ theo cấp", () => {
  it("đếm từ đã thuộc / đang học trên tổng mục tiêu của cấp", () => {
    const lv1 = vocab.words.filter((w) => w.hsk3Level === 1);
    const T = new Date();
    const cards = [
      { ...newCard(lv1[0].id, "zh-vi", T), reps: 5, stability: KNOWN_STABILITY + 5 },
      { ...newCard(lv1[1].id, "zh-vi", T), reps: 1, stability: 3 },
      newCard(lv1[2].id, "zh-vi", T),
    ];
    const lp = levelProgress(vocab.words, cards, "3.0");
    expect(lp[0]).toMatchObject({ level: 1, target: 300, available: lv1.length, known: 1, learning: 2 });
    expect(lp.map((x) => x.level)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(levelProgress(vocab.words, [], "2.0")[0]).toMatchObject({ target: 150, available: 150, known: 0 });
  });
});

describe("gợi ý nguồn ngoài", () => {
  const fresh = learnerStats(defaultProgress());
  it("CTI chỉ “đến lúc dùng” khi thi thử đạt ≥ 80%", () => {
    expect(isResourceReady("cti", fresh)).toBe(false);
    expect(isResourceReady("cti", { ...fresh, examsTaken: 1, bestExamRatio: 0.75 })).toBe(false);
    expect(isResourceReady("cti", { ...fresh, examsTaken: 1, bestExamRatio: 0.8 })).toBe(true);
  });
  it("điểm thi cao nhất tính trên tổng điểm", () => {
    const p = { ...defaultProgress(), examAttempts: [{ examId: "x", date: TODAY, score: 120, sectionScores: {} }, { examId: "x", date: TODAY, score: 180, sectionScores: {} }] };
    expect(learnerStats(p).bestExamRatio).toBe(0.9);
  });
  it("gợi ý theo ngữ cảnh: thi xong -> CTI & Mandarin Bean; nghe -> Mandarin Corner", () => {
    expect(suggestResources(RESOURCES, "exam", fresh).map((r) => r.id).sort()).toEqual(["cti", "mandarinbean"]);
    expect(suggestResources(RESOURCES, "listening", fresh).map((r) => r.id)).toEqual(["mandarincorner"]);
  });
  it("nguồn đã đến lúc dùng được xếp trước", () => {
    const s = { ...fresh, examsTaken: 1, bestExamRatio: 0.5 };
    expect(suggestResources(RESOURCES, "exam", s)[0].id).toBe("mandarinbean");
    expect(suggestResources(RESOURCES, "exam", { ...s, bestExamRatio: 0.9 }).every((r) => isResourceReady(r.id, { ...s, bestExamRatio: 0.9 }))).toBe(true);
  });
  it("mọi nguồn đều có nhãn “Dùng khi nào” và cấp phù hợp", () => {
    expect(RESOURCES).toHaveLength(8);
    for (const r of RESOURCES) {
      expect(r.whenToUse).toBeTruthy();
      expect(r.levels).toBeTruthy();
      expect(r.contexts.length).toBeGreaterThan(0);
    }
  });
});
