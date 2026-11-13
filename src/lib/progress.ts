// Lưu tiến độ người học vào localStorage (bọc try/catch) + xuất/nhập JSON để sao lưu.
// Không gửi dữ liệu ra ngoài.

import { DEFAULT_HSK_STANDARD, isHskStandard } from "../config/hsk.ts";
import type { SrsCard, UserProgress } from "../types.ts";

export const STORAGE_KEY = "htt.progress.v1";

export function defaultProgress(): UserProgress {
  return {
    version: 1,
    hskStandard: DEFAULT_HSK_STANDARD,
    dailyGoalMinutes: 10,
    newCardsPerDay: 10,
    srsCardTypes: ["zh-vi", "vi-zh"],
    speechRecognitionConsent: false,
    streak: 0,
    lastActiveDate: "",
    completedLessonIds: [],
    cards: [],
    examAttempts: [],
    readingResults: {},
    studyLog: {},
    gameRecords: {},
    wordMisses: {},
  };
}

/** Ghép dữ liệu không tin cậy (từ storage / file nhập) với mặc định; bỏ trường sai kiểu. */
export function sanitizeProgress(input: unknown): UserProgress {
  const d = defaultProgress();
  if (!input || typeof input !== "object") return d;
  const o = input as Record<string, unknown>;
  const num = (v: unknown, fallback: number, min = 0) =>
    typeof v === "number" && Number.isFinite(v) && v >= min ? v : fallback;
  return {
    version: 1,
    hskStandard: isHskStandard(o.hskStandard) ? o.hskStandard : d.hskStandard,
    dailyGoalMinutes: num(o.dailyGoalMinutes, d.dailyGoalMinutes, 1),
    newCardsPerDay: num(o.newCardsPerDay, d.newCardsPerDay),
    streak: num(o.streak, 0),
    lastActiveDate: typeof o.lastActiveDate === "string" ? o.lastActiveDate : "",
    completedLessonIds: Array.isArray(o.completedLessonIds)
      ? o.completedLessonIds.filter((x): x is string => typeof x === "string")
      : [],
    srsCardTypes: Array.isArray(o.srsCardTypes)
      ? [...new Set(o.srsCardTypes.filter((t): t is CardType => CARD_TYPES.includes(t as CardType)))]
      : d.srsCardTypes,
    speechRecognitionConsent: o.speechRecognitionConsent === true,
    cards: Array.isArray(o.cards) ? o.cards.filter(isValidCard) : [],
    examAttempts: Array.isArray(o.examAttempts) ? (o.examAttempts as UserProgress["examAttempts"]) : [],
    readingResults: sanitizeResults(o.readingResults),
    studyLog: sanitizeStudyLog(o.studyLog),
    // thêm ở v0.12.0 — dữ liệu cũ không có: mặc định rỗng
    gameRecords: sanitizeResultsBy(o.gameRecords, (x) => typeof x.score === "number" && Number.isFinite(x.score) && x.score >= 0),
    wordMisses: sanitizeCounts(o.wordMisses),
  };
}

function sanitizeResultsBy(v: unknown, ok: (x: { score: number }) => boolean): Record<string, { score: number; date: string }> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, { score: number; date: string }> = {};
  for (const [k, r] of Object.entries(v as Record<string, unknown>)) {
    const x = r as { score?: unknown; date?: unknown };
    if (x && typeof x.date === "string" && typeof x.score === "number" && ok(x as { score: number })) out[k] = { score: x.score, date: x.date };
  }
  return out;
}

function sanitizeCounts(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>).filter((e): e is [string, number] => typeof e[1] === "number" && Number.isInteger(e[1]) && e[1] > 0),
  );
}

function sanitizeResults(v: unknown): UserProgress["readingResults"] {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: UserProgress["readingResults"] = {};
  for (const [k, r] of Object.entries(v as Record<string, unknown>)) {
    const x = r as { score?: unknown; date?: unknown };
    if (x && typeof x.score === "number" && x.score >= 0 && x.score <= 1 && typeof x.date === "string") out[k] = { score: x.score, date: x.date };
  }
  return out;
}

export const STUDY_LOG_DAYS = 120;

function sanitizeStudyLog(v: unknown): UserProgress["studyLog"] {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : 0);
  const entries = Object.entries(v as Record<string, unknown>)
    .filter(([k, d]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && d && typeof d === "object")
    .map(([k, d]) => {
      const x = d as Record<string, unknown>;
      return [k, { seconds: n(x.seconds), reviews: n(x.reviews), lessons: n(x.lessons), readings: n(x.readings), exams: n(x.exams) }] as const;
    })
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, STUDY_LOG_DAYS);
  return Object.fromEntries(entries);
}

type CardType = SrsCard["cardType"];
const CARD_TYPES: CardType[] = ["zh-vi", "vi-zh", "audio-zh", "write"];

function isValidCard(c: unknown): c is SrsCard {
  if (!c || typeof c !== "object") return false;
  const x = c as Record<string, unknown>;
  const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  return (
    typeof x.id === "string" &&
    typeof x.wordId === "string" &&
    CARD_TYPES.includes(x.cardType as CardType) &&
    typeof x.due === "string" &&
    !Number.isNaN(Date.parse(x.due)) &&
    finite(x.stability) &&
    finite(x.difficulty) &&
    finite(x.reps) &&
    finite(x.lapses)
  );
}

/** Ghi nhận một ngày có học: cập nhật streak (liên tiếp +1, bỏ một ngày trở lên thì về 1). */
export function markActive(p: UserProgress, today: string): UserProgress {
  if (p.lastActiveDate === today) return p;
  const prev = new Date(today + "T00:00:00");
  prev.setDate(prev.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yesterday = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-${pad(prev.getDate())}`;
  return { ...p, streak: p.lastActiveDate === yesterday ? p.streak + 1 : 1, lastActiveDate: today };
}

export function loadProgress(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): UserProgress {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    return raw ? sanitizeProgress(JSON.parse(raw)) : defaultProgress();
  } catch {
    return defaultProgress();
  }
}

/** Trả về false nếu không lưu được (chế độ riêng tư, bị chặn...). */
export function saveProgress(p: UserProgress, storage: Pick<Storage, "setItem"> | undefined = safeStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

export function exportProgressJson(p: UserProgress): string {
  return JSON.stringify({ app: "hoc-tieng-trung", exportedAt: new Date().toISOString(), progress: p }, null, 2);
}

/** Nhận cả file xuất của app ({ progress }) lẫn object UserProgress trần. Ném lỗi nếu không phải JSON. */
export function importProgressJson(text: string): UserProgress {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  return sanitizeProgress(parsed && typeof parsed === "object" && "progress" in parsed ? parsed.progress : parsed);
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage !== "undefined" ? localStorage : undefined;
  } catch {
    return undefined;
  }
}
