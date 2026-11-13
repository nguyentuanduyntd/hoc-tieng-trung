// Dashboard: nhật ký học theo ngày, việc nên làm hôm nay, tiến độ theo cấp, gợi ý nguồn ngoài.

import { HSK_STANDARDS, getNewWordsTarget, wordLevel } from "../config/hsk.ts";
import type { ExternalResource } from "../config/resources.ts";
import type { DayLog, HskStandard, SrsCard, UserProgress, Word } from "../types.ts";
import { STUDY_LOG_DAYS } from "./progress.ts";
import { wordStatuses } from "./srs.ts";

// ---------- Nhật ký ----------

export const emptyDay = (): DayLog => ({ seconds: 0, reviews: 0, lessons: 0, readings: 0, exams: 0 });

function trimLog(log: UserProgress["studyLog"]): UserProgress["studyLog"] {
  const keys = Object.keys(log).sort().reverse();
  if (keys.length <= STUDY_LOG_DAYS) return log;
  return Object.fromEntries(keys.slice(0, STUDY_LOG_DAYS).map((k) => [k, log[k]]));
}

export type ActivityKind = "reviews" | "lessons" | "readings" | "exams";

/** Ghi một hoạt động vào ngày `date`. */
export function logActivity(p: UserProgress, kind: ActivityKind, date: string, amount = 1): UserProgress {
  const day = { ...emptyDay(), ...p.studyLog[date] };
  day[kind] += amount;
  return { ...p, studyLog: trimLog({ ...p.studyLog, [date]: day }) };
}

export function addStudySeconds(p: UserProgress, date: string, seconds: number): UserProgress {
  const day = { ...emptyDay(), ...p.studyLog[date] };
  day.seconds += Math.max(0, seconds);
  return { ...p, studyLog: trimLog({ ...p.studyLog, [date]: day }) };
}

/** Lùi `n` ngày từ ngày YYYY-MM-DD (theo lịch địa phương). */
export function shiftDate(date: string, n: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + n);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Số phút học của `n` ngày gần nhất (cũ -> mới), kể cả ngày không học (= 0). */
export function lastDays(log: UserProgress["studyLog"], today: string, n = 7): { date: string; minutes: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const date = shiftDate(today, i - (n - 1));
    return { date, minutes: Math.round((log[date]?.seconds ?? 0) / 60) };
  });
}

// ---------- Việc nên làm hôm nay ----------

export interface PlanInput {
  due: number;
  fresh: number;
  totalCards: number;
  nextLesson?: { id: string; title: string };
  nextReading?: { id: string; title: string };
  today: DayLog;
}

export interface PlanStep {
  id: "srs" | "lesson" | "reading";
  title: string;
  detail: string;
  href: string;
  done: boolean;
}

/** Thứ tự cố định theo SPEC: ôn SRS đến hạn -> bài học tiếp theo -> 1 bài đọc. */
export function todayPlan(i: PlanInput): { steps: PlanStep[]; next?: PlanStep } {
  const srsLeft = i.due + i.fresh;
  const steps: PlanStep[] = [
    {
      id: "srs",
      title: "Ôn tập thẻ đến hạn",
      detail:
        srsLeft > 0
          ? `${i.due} thẻ đến hạn · ${i.fresh} thẻ mới`
          : i.totalCards === 0
            ? "Chưa có thẻ — học bài đầu tiên để có thẻ ôn"
            : i.today.reviews > 0
              ? `Đã ôn ${i.today.reviews} thẻ hôm nay`
              : "Không có thẻ đến hạn",
      href: "#/on-tap",
      done: srsLeft === 0,
    },
    {
      id: "lesson",
      title: "Học bài tiếp theo",
      detail: i.today.lessons > 0 ? `Đã xong ${i.today.lessons} bài hôm nay` : i.nextLesson ? i.nextLesson.title : "Đã học hết các bài hiện có",
      href: i.nextLesson ? `#/bai-hoc/${i.nextLesson.id}` : "#/bai-hoc",
      done: i.today.lessons > 0 || !i.nextLesson,
    },
    {
      id: "reading",
      title: "Đọc 1 bài",
      detail: i.today.readings > 0 ? `Đã đọc ${i.today.readings} bài hôm nay` : i.nextReading ? i.nextReading.title : "Chưa có bài đọc",
      href: i.nextReading ? `#/doc/${i.nextReading.id}` : "#/doc",
      done: i.today.readings > 0 || !i.nextReading,
    },
  ];
  return { steps, next: steps.find((s) => !s.done) };
}

/** Bài đọc nên đọc tiếp: bài chưa làm đầu tiên; nếu đã làm hết thì bài làm lâu nhất / điểm thấp nhất. */
export function pickNextReading<T extends { id: string }>(readings: T[], results: UserProgress["readingResults"]): T | undefined {
  const notDone = readings.find((r) => !results[r.id]);
  if (notDone) return notDone;
  return [...readings].sort((a, b) => {
    const ra = results[a.id];
    const rb = results[b.id];
    return ra.date === rb.date ? ra.score - rb.score : ra.date < rb.date ? -1 : 1;
  })[0];
}

// ---------- Tiến độ theo cấp ----------

export interface LevelProgress {
  level: number;
  label: string;
  /** Số từ mới của cấp theo chuẩn (config). */
  target: number;
  /** Số từ của cấp có trong dữ liệu. */
  available: number;
  known: number;
  learning: number;
}

export function levelProgress(words: Word[], cards: SrsCard[], std: HskStandard): LevelProgress[] {
  const st = wordStatuses(cards);
  return HSK_STANDARDS[std].levels.map((l) => {
    const ws = words.filter((w) => wordLevel(w, std) === l.level);
    let known = 0;
    let learning = 0;
    for (const w of ws) {
      const s = st.get(w.id);
      if (s === "known") known++;
      else if (s === "learning") learning++;
    }
    return { level: l.level, label: l.label, target: getNewWordsTarget(std, l.level) ?? 0, available: ws.length, known, learning };
  });
}

export function goalRatio(seconds: number, goalMinutes: number): number {
  return goalMinutes > 0 ? Math.min(1, seconds / 60 / goalMinutes) : 0;
}

// ---------- Gợi ý nguồn ngoài theo ngữ cảnh & tiến độ ----------

export interface LearnerStats {
  completedLessons: number;
  readingsDone: number;
  cards: number;
  examsTaken: number;
  /** Điểm cao nhất / tổng điểm (0..1), undefined nếu chưa thi. */
  bestExamRatio?: number;
}

export function learnerStats(p: UserProgress, examTotal = 200): LearnerStats {
  const best = p.examAttempts.length ? Math.max(...p.examAttempts.map((a) => a.score)) / examTotal : undefined;
  return {
    completedLessons: p.completedLessonIds.length,
    readingsDone: Object.keys(p.readingResults).length,
    cards: p.cards.length,
    examsTaken: p.examAttempts.length,
    bestExamRatio: best,
  };
}

/** Nguồn đã "đến lúc dùng" theo nhãn "Dùng khi nào" của nó. */
export function isResourceReady(id: string, s: LearnerStats): boolean {
  switch (id) {
    case "cti":
      return (s.bestExamRatio ?? 0) >= 0.8;
    case "mandarinbean":
      return s.examsTaken > 0;
    case "duchinese":
      return s.readingsDone >= 3;
    case "mandarincorner":
      return s.readingsDone >= 1;
    case "zerotohero":
    case "hellochinese":
      return s.completedLessons >= 1;
    case "anki":
      return s.cards >= 20;
    case "pleco":
      return true;
    default:
      return false;
  }
}

/** Gợi ý cho một ngữ cảnh (vd vừa làm xong bài thi): nguồn khớp ngữ cảnh, ưu tiên nguồn đã "đến lúc dùng". */
export function suggestResources(all: ExternalResource[], context: ExternalResource["contexts"][number], s: LearnerStats): ExternalResource[] {
  return all
    .filter((r) => r.contexts.includes(context))
    .sort((a, b) => Number(isResourceReady(b.id, s)) - Number(isResourceReady(a.id, s)));
}
