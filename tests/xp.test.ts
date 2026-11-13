import { describe, expect, it } from "vitest";
import { defaultProgress, sanitizeProgress } from "../src/lib/progress.ts";
import { BADGES, XP, XP_DAYS, addXp, applyMotivation, badgeCtx, estimateInitialXp, gameXp, levelOf, newBadges, personalRecords, xpForLevel } from "../src/lib/xp.ts";
import type { SrsCard, UserProgress } from "../src/types.ts";

const D = "2026-11-13";
const base = (over: Partial<UserProgress> = {}): UserProgress => ({ ...defaultProgress(), ...over });
const knownCard = (i: number): SrsCard => ({ id: `w${i}::zh-vi`, wordId: `w${i}`, cardType: "zh-vi", due: "2027-01-01T00:00:00Z", stability: 60, difficulty: 5, reps: 5, lapses: 0 });

describe("XP & cấp", () => {
  it("cộng XP theo ngày, làm tròn, bỏ số âm; giữ 120 ngày", () => {
    let p = base();
    p = { ...p, xp: addXp(p, 12.4, D) };
    p = { ...p, xp: addXp(p, 3, D) };
    p = { ...p, xp: addXp(p, -5, D) };
    expect(p.xp.total).toBe(15);
    expect(p.xp.byDay[D]).toBe(15);
    const many = Object.fromEntries(Array.from({ length: 130 }, (_, i) => [`2026-01-${String(i).padStart(3, "0")}`, 1]));
    const q = addXp({ xp: { total: 130, byDay: many, lastGoalBonus: "" } }, 1, D);
    expect(Object.keys(q.byDay)).toHaveLength(XP_DAYS);
    expect(q.byDay[D]).toBe(1);
  });
  it("ngưỡng cấp 0, 50, 150, 300, 500…", () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 50, 150, 300, 500]);
    expect(levelOf(0)).toMatchObject({ level: 1, from: 0, to: 50, ratio: 0 });
    expect(levelOf(149).level).toBe(2);
    expect(levelOf(150).level).toBe(3);
    expect(levelOf(175).ratio).toBeCloseTo(25 / 150);
  });
  it("XP game: điểm ÷ 10, tối đa 50", () => {
    expect(gameXp(95)).toBe(9);
    expect(gameXp(10_000)).toBe(XP.gameMax);
  });
});

describe("thưởng & huy hiệu", () => {
  it("thưởng mục tiêu ngày một lần mỗi ngày", () => {
    const p = base({ dailyGoalMinutes: 10, studyLog: { [D]: { seconds: 600, reviews: 0, lessons: 0, readings: 0, exams: 0 } } });
    const a = applyMotivation(p, D);
    expect(a.goalBonus).toBe(true);
    expect(a.p.xp.total).toBe(XP.dailyGoal);
    const b = applyMotivation(a.p, D, { xp: 2 });
    expect(b.goalBonus).toBe(false);
    expect(b.p.xp.total).toBe(XP.dailyGoal + 2);
  });
  it("kỷ lục streak không giảm khi streak đứt", () => {
    const a = applyMotivation(base({ streak: 8, bestStreak: 3 }), D);
    expect(a.p.bestStreak).toBe(8);
    expect(applyMotivation({ ...a.p, streak: 1 }, D).p.bestStreak).toBe(8);
  });
  it("huy hiệu theo mốc: streak 7/30, thuộc 300 từ, qua thi thử; mỗi huy hiệu chỉ nhận một lần", () => {
    const p = base({
      streak: 30,
      cards: Array.from({ length: 300 }, (_, i) => knownCard(i)),
      examAttempts: [{ examId: "x", date: D, score: 130, sectionScores: {} }],
    });
    const a = applyMotivation(p, D);
    const ids = a.badges.map((b) => b.id);
    for (const id of ["streak-3", "streak-7", "streak-30", "words-50", "words-150", "words-300", "exam-pass"]) expect(ids).toContain(id);
    expect(ids).not.toContain("streak-100");
    expect(ids).not.toContain("exam-180");
    expect(a.p.badges["words-300"]).toBe(D);
    expect(applyMotivation(a.p, "2026-11-14").badges).toEqual([]);
  });
  it("báo lên cấp", () => {
    const a = applyMotivation(base({ xp: { total: 45, byDay: {}, lastGoalBonus: "" } }), D, { xp: 10 });
    expect(a.levelUp).toBe(2);
    expect(applyMotivation(a.p, D, { xp: 1 }).levelUp).toBeUndefined();
  });
  it("mọi huy hiệu có mục tiêu dương, id không trùng; người mới chưa có huy hiệu", () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    const c = badgeCtx(base());
    for (const b of BADGES) expect(b.progress(c)[1], b.id).toBeGreaterThan(0);
    expect(newBadges(c)).toEqual([]);
  });
});

describe("migration & kỷ lục", () => {
  it("tiến độ cũ chưa có XP: ước lượng XP từ lịch sử; bestStreak = streak hiện tại", () => {
    const old = {
      streak: 5,
      completedLessonIds: ["hsk1-u1-l1", "hsk1-u1-l2", "hsk1-cp1"],
      studyLog: { [D]: { seconds: 0, reviews: 10, lessons: 0, readings: 0, exams: 0 } },
      examAttempts: [{ examId: "x", date: D, score: 150, sectionScores: {} }],
      readingResults: { r1: { score: 1, date: D } },
    };
    const p = sanitizeProgress(old);
    const expected = 2 * XP.lesson + XP.checkpoint + 10 * XP.review + XP.exam + XP.examPassBonus + XP.reading;
    expect(p.xp.total).toBe(expected);
    expect(estimateInitialXp(p)).toBe(expected);
    expect(p.bestStreak).toBe(5);
    expect(p.badges).toEqual({});
  });
  it("tiến độ đã có XP: giữ nguyên, bỏ giá trị sai", () => {
    const p = sanitizeProgress({ xp: { total: 77, byDay: { [D]: 7, x: -1 }, lastGoalBonus: D }, badges: { "lesson-1": D, bad: 3 }, bestStreak: 9, streak: 2 });
    expect(p.xp).toEqual({ total: 77, byDay: { [D]: 7 }, lastGoalBonus: D });
    expect(p.badges).toEqual({ "lesson-1": D });
    expect(p.bestStreak).toBe(9);
    expect(sanitizeProgress({ xp: { total: -3 } }).xp.total).toBe(0);
  });
  it("kỷ lục cá nhân", () => {
    const p = base({ bestStreak: 12, xp: { total: 40, byDay: { "2026-11-01": 10, [D]: 30 }, lastGoalBonus: "" }, gameRecords: { "pinyin-text": { score: 230, date: D } } });
    const r = Object.fromEntries(personalRecords(p).map((x) => [x.label, x.value]));
    expect(r["Chuỗi ngày học dài nhất"]).toBe("12 ngày");
    expect(r["XP nhiều nhất trong một ngày"]).toBe("30 XP (13/11/2026)");
    expect(r["Mưa từ vựng · Chữ"]).toBe("230 điểm");
  });
});
