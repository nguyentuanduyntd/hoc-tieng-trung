// Động lực (SPEC 3.18): XP cho mỗi hoạt động, cấp độ, huy hiệu theo mốc, kỷ lục cá nhân.
// Không có backend: chỉ lưu và hiện thành tích của chính người học — không có bảng xếp hạng.

import type { UserProgress } from "../types.ts";
import { wordStatuses } from "./srs.ts";

/** XP cho từng loại hoạt động. */
export const XP = {
  review: 2,
  lesson: 20,
  checkpoint: 30,
  skipUnit: 30,
  reading: 15,
  readingRepeat: 5,
  exam: 30,
  examPassBonus: 20,
  dictationPass: 3,
  dictationTry: 1,
  writeChar: 1,
  writeCharPerfect: 2,
  /** Bộ thủ / Pinyin: mỗi câu đúng. */
  quizCorrect: 1,
  /** Game: điểm / 10, tối đa 50 mỗi ván. */
  gameDivisor: 10,
  gameMax: 50,
  dailyGoal: 10,
} as const;

/** Số ngày giữ lịch sử XP theo ngày. */
export const XP_DAYS = 120;
export const EXAM_PASS = 120;

export type XpState = UserProgress["xp"];

export const emptyXp = (): XpState => ({ total: 0, byDay: {}, lastGoalBonus: "" });

/** Cộng XP vào ngày `date`. */
export function addXp(p: Pick<UserProgress, "xp">, amount: number, date: string): XpState {
  const n = Math.max(0, Math.round(amount));
  if (!n) return p.xp;
  const byDay = { ...p.xp.byDay, [date]: (p.xp.byDay[date] ?? 0) + n };
  const keys = Object.keys(byDay).sort().reverse();
  const trimmed = keys.length > XP_DAYS ? Object.fromEntries(keys.slice(0, XP_DAYS).map((k) => [k, byDay[k]])) : byDay;
  return { ...p.xp, total: p.xp.total + n, byDay: trimmed };
}

/** XP cần để LÊN cấp `level` (cấp 1 = 0): 0, 50, 150, 300, 500, 750… */
export const xpForLevel = (level: number) => 25 * level * (level - 1);

export function levelOf(total: number): { level: number; from: number; to: number; ratio: number } {
  let level = 1;
  while (xpForLevel(level + 1) <= total) level++;
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  return { level, from, to, ratio: (total - from) / (to - from) };
}

export const gameXp = (score: number) => Math.min(XP.gameMax, Math.floor(score / XP.gameDivisor));

/**
 * Ước lượng XP ban đầu cho tiến độ cũ (chưa có trường xp) từ lịch sử học — để người dùng cũ
 * không bắt đầu từ 0. Chỉ dùng một lần khi đọc dữ liệu cũ.
 */
export function estimateInitialXp(p: Omit<UserProgress, "xp" | "badges" | "bestStreak">): number {
  const checkpoints = p.completedLessonIds.filter((id) => id.includes("-cp")).length;
  const lessons = p.completedLessonIds.length - checkpoints;
  const reviews = Object.values(p.studyLog).reduce((n, d) => n + d.reviews, 0);
  const exams = p.examAttempts.reduce((n, a) => n + XP.exam + (a.score >= EXAM_PASS ? XP.examPassBonus : 0), 0);
  const readings = Object.keys(p.readingResults).length * XP.reading;
  const dictation = Object.values(p.dictation).reduce((n, m) => n + Object.values(m).filter((x) => x >= 0.8).length * XP.dictationPass, 0);
  const games = Object.values(p.gameRecords).reduce((n, r) => n + gameXp(r.score), 0);
  return lessons * XP.lesson + checkpoints * XP.checkpoint + reviews * XP.review + exams + readings + dictation + games;
}

// ---------- Huy hiệu ----------

export interface BadgeCtx {
  p: UserProgress;
  /** Số từ đã thuộc (SRS). */
  known: number;
  hsk1Lessons: number;
  pinyinLessons: number;
}

export interface Badge {
  id: string;
  icon: string;
  title: string;
  desc: string;
  /** [hiện tại, mục tiêu] */
  progress: (c: BadgeCtx) => [number, number];
}

const lessonsDone = (p: UserProgress) => p.completedLessonIds.filter((id) => !id.includes("-cp")).length;
const bestExam = (p: UserProgress) => Math.max(0, ...p.examAttempts.map((a) => a.score));
const dictationDone = (p: UserProgress) => Object.values(p.dictation).reduce((n, m) => n + Object.values(m).filter((x) => x >= 0.8).length, 0);
const radicalsLearned = (p: UserProgress) => Object.values(p.radicals).filter((r) => r.best >= 0.8).length;
const pinyinDone = (p: UserProgress) => Object.values(p.pinyinCourse).filter((r) => r.best >= 0.8).length;
const bestGame = (p: UserProgress) => Math.max(0, ...Object.values(p.gameRecords).map((r) => r.score));

export const BADGES: Badge[] = [
  { id: "streak-3", icon: "🔥", title: "Khởi động", desc: "Học 3 ngày liên tiếp", progress: (c) => [c.p.bestStreak, 3] },
  { id: "streak-7", icon: "🔥", title: "Một tuần bền bỉ", desc: "Học 7 ngày liên tiếp", progress: (c) => [c.p.bestStreak, 7] },
  { id: "streak-30", icon: "🌟", title: "Một tháng không nghỉ", desc: "Học 30 ngày liên tiếp", progress: (c) => [c.p.bestStreak, 30] },
  { id: "streak-100", icon: "💎", title: "100 ngày", desc: "Học 100 ngày liên tiếp", progress: (c) => [c.p.bestStreak, 100] },
  { id: "pinyin", icon: "🔤", title: "Vững pinyin", desc: "Xong cả Lộ trình Pinyin", progress: (c) => [pinyinDone(c.p), c.pinyinLessons] },
  { id: "lesson-1", icon: "📘", title: "Bài học đầu tiên", desc: "Xong 1 bài học", progress: (c) => [lessonsDone(c.p), 1] },
  { id: "lesson-10", icon: "📗", title: "Mười bài", desc: "Xong 10 bài học", progress: (c) => [lessonsDone(c.p), 10] },
  { id: "hsk1-path", icon: "🎓", title: "Hết lộ trình HSK 1", desc: "Xong mọi bài học HSK 1", progress: (c) => [lessonsDone(c.p), c.hsk1Lessons] },
  { id: "words-50", icon: "🧠", title: "50 từ", desc: "Thuộc 50 từ (ôn tập)", progress: (c) => [c.known, 50] },
  { id: "words-150", icon: "🧠", title: "150 từ", desc: "Thuộc 150 từ", progress: (c) => [c.known, 150] },
  { id: "words-300", icon: "🏆", title: "Thuộc 300 từ HSK 1", desc: "Thuộc 300 từ", progress: (c) => [c.known, 300] },
  { id: "reviews-500", icon: "🔁", title: "500 lượt ôn", desc: "Ôn 500 thẻ (tính trong 120 ngày gần nhất)", progress: (c) => [Object.values(c.p.studyLog).reduce((n, d) => n + d.reviews, 0), 500] },
  { id: "exam-pass", icon: "📝", title: "Qua thi thử", desc: `Đạt ≥ ${EXAM_PASS} điểm một đề thi thử`, progress: (c) => [bestExam(c.p), EXAM_PASS] },
  { id: "exam-180", icon: "🥇", title: "Điểm cao", desc: "Đạt ≥ 180 điểm một đề thi thử", progress: (c) => [bestExam(c.p), 180] },
  { id: "reader-5", icon: "📖", title: "Mọt sách", desc: "Hoàn thành 5 bài đọc", progress: (c) => [Object.keys(c.p.readingResults).length, 5] },
  { id: "dictation-30", icon: "✍️", title: "Tai thính", desc: "Chép đúng 30 câu chính tả", progress: (c) => [dictationDone(c.p), 30] },
  { id: "radicals-10", icon: "部", title: "Biết bộ thủ", desc: "Thuộc 10 bộ thủ", progress: (c) => [radicalsLearned(c.p), 10] },
  { id: "game-500", icon: "⌨️", title: "Tay gõ nhanh", desc: "Đạt 500 điểm Mưa từ vựng", progress: (c) => [bestGame(c.p), 500] },
  { id: "level-5", icon: "⭐", title: "Cấp 5", desc: "Đạt cấp 5 (500 XP)", progress: (c) => [c.p.xp.total, xpForLevel(5)] },
  { id: "level-10", icon: "🌠", title: "Cấp 10", desc: "Đạt cấp 10", progress: (c) => [c.p.xp.total, xpForLevel(10)] },
];

export function badgeCtx(p: UserProgress, opts: { hsk1Lessons?: number; pinyinLessons?: number } = {}): BadgeCtx {
  let known = 0;
  for (const s of wordStatuses(p.cards).values()) if (s === "known") known++;
  return { p, known, hsk1Lessons: opts.hsk1Lessons ?? 43, pinyinLessons: opts.pinyinLessons ?? 9 };
}

export const badgeEarned = (b: Badge, c: BadgeCtx) => {
  const [cur, target] = b.progress(c);
  return target > 0 && cur >= target;
};

/** Huy hiệu mới đạt (chưa có trong p.badges). */
export function newBadges(c: BadgeCtx): Badge[] {
  return BADGES.filter((b) => !c.p.badges[b.id] && badgeEarned(b, c));
}

/**
 * Áp dụng sau mỗi lần cập nhật tiến độ: kỷ lục streak, thưởng mục tiêu ngày, huy hiệu mới.
 * Trả về tiến độ mới + những gì vừa đạt (để báo).
 */
export function applyMotivation(
  p: UserProgress,
  date: string,
  opts: { xp?: number; hsk1Lessons?: number; pinyinLessons?: number } = {},
): { p: UserProgress; badges: Badge[]; levelUp?: number; goalBonus: boolean } {
  const beforeLevel = levelOf(p.xp.total).level;
  let xp = opts.xp ? addXp(p, opts.xp, date) : p.xp;
  let goalBonus = false;
  const seconds = p.studyLog[date]?.seconds ?? 0;
  if (xp.lastGoalBonus !== date && seconds >= p.dailyGoalMinutes * 60) {
    xp = { ...addXp({ xp }, XP.dailyGoal, date), lastGoalBonus: date };
    goalBonus = true;
  }
  let next: UserProgress = { ...p, xp, bestStreak: Math.max(p.bestStreak, p.streak) };
  const fresh = newBadges(badgeCtx(next, opts));
  if (fresh.length) next = { ...next, badges: { ...next.badges, ...Object.fromEntries(fresh.map((b) => [b.id, date])) } };
  const afterLevel = levelOf(next.xp.total).level;
  return { p: next, badges: fresh, levelUp: afterLevel > beforeLevel ? afterLevel : undefined, goalBonus };
}

/** Kỷ lục cá nhân. */
export function personalRecords(p: UserProgress): { label: string; value: string }[] {
  const days = Object.entries(p.xp.byDay);
  const bestDay = days.reduce<[string, number] | null>((a, d) => (!a || d[1] > a[1] ? d : a), null);
  const games = Object.entries(p.gameRecords);
  return [
    { label: "Chuỗi ngày học dài nhất", value: `${p.bestStreak} ngày` },
    { label: "XP nhiều nhất trong một ngày", value: bestDay ? `${bestDay[1]} XP (${bestDay[0].split("-").reverse().join("/")})` : "–" },
    { label: "Điểm thi thử cao nhất", value: p.examAttempts.length ? `${bestExam(p)}/200` : "–" },
    ...games.map(([k, r]) => ({ label: `Mưa từ vựng · ${k.endsWith("audio") ? "Nghe" : "Chữ"}`, value: `${r.score} điểm` })),
  ];
}
