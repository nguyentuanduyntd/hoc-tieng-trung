// Mô hình dữ liệu dùng chung (theo SPEC mục 4).

export type HskStandard = "2.0" | "3.0";

export interface Example {
  zh: string;
  pinyin: string;
  vi: string;
  /** Câu đã tách từ sẵn; token có `wordId` bấm được để mở pop-up từ điển. */
  tokens?: { text: string; wordId?: string }[];
}

export interface Word {
  /** Định danh ổn định: `${hanzi}_${pinyinNumbered không dấu cách}` — vd "你好_ni3hao3". */
  id: string;
  hanzi: string;
  /** Pinyin có dấu thanh, cách nhau theo âm tiết — vd "nǐ hǎo". */
  pinyin: string;
  /** Pinyin dạng số — vd "ni3 hao3"; thanh nhẹ = 5; nhi hóa: "dian3r". */
  pinyinNumbered: string;
  hanViet?: string;
  meaningVi: string;
  meaningEn?: string;
  /** Cấp theo HSK 2.0 (1–6). */
  hsk2Level?: number;
  /** Cấp theo HSK 3.0 (1–7; 7 = HSK 7–9). */
  hsk3Level?: number;
  examples: Example[];
  audioUrl?: string;
  /** "draft" = dữ liệu tiếng Việt do dự án tự soạn, chưa có người duyệt. */
  reviewStatus?: "draft" | "reviewed";
}

export interface VocabFile {
  meta: {
    generatedAt: string;
    description: string;
    sources: string[];
    count: number;
  };
  words: Word[];
}

export type ExerciseType =
  | "choose-meaning"
  | "listen-choose-hanzi"
  | "match-pairs"
  | "order-words"
  | "fill-blank"
  | "choose-tone"
  | "write-stroke"
  | "speak"
  | "comprehension";

export type Tok = { text: string; wordId?: string };

/** Câu dùng trong bài tập (đã tách từ, có pinyin). */
export interface SentenceRef {
  zh: string;
  pinyin: string;
  vi: string;
  tokens: Tok[];
}

/** Bài tập — `prompt` / `answer` cụ thể theo từng dạng (SPEC mục 4, đã làm rõ kiểu). */
export type Exercise =
  | { id: string; type: "choose-meaning"; prompt: { wordId: string; options: string[] }; answer: string }
  | { id: string; type: "listen-choose-hanzi"; prompt: { wordId: string; options: string[] }; answer: string }
  | { id: string; type: "match-pairs"; prompt: { wordIds: string[] }; answer: string[] }
  | { id: string; type: "order-words"; prompt: { sentence: SentenceRef; tiles: string[] }; answer: string[] }
  | {
      id: string;
      type: "fill-blank";
      prompt: { sentence: SentenceRef; blankIndex: number; options: string[] };
      answer: string;
    }
  | {
      id: string;
      type: "choose-tone";
      prompt: { wordId: string; syllable: string; toneless: string };
      answer: number;
    }
  | { id: string; type: "write-stroke"; prompt: { wordId: string; char: string }; answer: string }
  | { id: string; type: "speak"; prompt: { sentence: SentenceRef }; answer: string }
  /** Câu hỏi đọc hiểu: chọn 1 trong các phương án (tiếng Việt). */
  | { id: string; type: "comprehension"; prompt: { question: string; options: string[] }; answer: number };

export interface Lesson {
  id: string;
  hskLevel: number;
  unit: number;
  order: number;
  title: string;
  newWordIds: string[];
  grammar?: { pattern: string; explanationVi: string; examples: Example[] };
  exercises: Exercise[];
}

export interface Unit {
  hskLevel: number;
  unit: number;
  title: string;
  lessonIds: string[];
  /** Bài "thi vượt": đạt ≥ passRatio thì mở/hoàn thành cả unit. */
  skipTest: Exercise[];
  passRatio: number;
}

export interface LessonsFile {
  meta: { generatedAt: string; description: string };
  units: Unit[];
  lessons: Lesson[];
}

export interface ReadingSentence {
  zh: string;
  tokens: Tok[];
  /** Pinyin từng token (cùng độ dài với tokens; dấu câu = ""), đã áp dụng biến điệu 一/不. */
  tokenPinyin: string[];
  pinyin: string;
  vi: string;
  /** Người nói (hội thoại), khóa trong Reading.speakers. */
  speaker?: string;
  audioUrl?: string;
}

export interface Reading {
  id: string;
  hskLevel: number;
  title: string;
  titleZh?: string;
  kind: "text" | "dialogue";
  speakers?: Record<string, string>;
  sentences: ReadingSentence[];
  questions: Exercise[];
  /** Số chữ Hán, số từ (token có nghĩa), tỷ lệ từ ngoài cấp. */
  stats: { hanzi: number; words: number; outOfLevelRatio: number };
}

export interface ReadingsFile {
  meta: { generatedAt: string; description: string };
  readings: Reading[];
}

export interface SrsCard {
  id: string;
  wordId: string;
  cardType: "zh-vi" | "vi-zh" | "audio-zh" | "write";
  due: string;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  lastReview?: string;
  /** Lần ôn đầu tiên — để giới hạn số thẻ mới mỗi ngày. */
  firstReview?: string;
}

/** Câu (đã tách từ) dùng trong đề thi. */
export interface ExamSentence {
  zh: string;
  pinyin: string;
  tokens: Tok[];
  tokenPinyin: string[];
}

export interface ExamOption {
  text?: ExamSentence;
  /** Hình minh họa (emoji). */
  picture?: string;
  /** Nhãn cố định (vd "✓ Đúng" / "✗ Sai"). */
  label?: string;
}

export interface ExamQuestion {
  id: string;
  /** Số thứ tự câu trong đề (1..N). */
  number: number;
  partId: string;
  kind: "judge-picture" | "choose-picture" | "choose-text" | "fill-blank";
  /** Lời trong file nghe (phần Nghe). */
  audio?: { speaker?: string; line: ExamSentence }[];
  /** Văn bản đề (phần Đọc). */
  text?: ExamSentence;
  /** Câu hỏi (đọc lên ở phần Nghe, in ra ở phần Đọc). */
  question?: ExamSentence;
  picture?: string;
  options: ExamOption[];
  answer: number;
  keyWordIds: string[];
  explanationVi: string;
}

export interface Exam {
  id: string;
  standard: HskStandard;
  level: number;
  title: string;
  sections: { id: string; parts: { id: string; questions: ExamQuestion[] }[] }[];
}

export interface ExamsFile {
  meta: { generatedAt: string; description: string };
  exams: Exam[];
}

export interface ExamAttempt {
  examId: string;
  date: string;
  score: number;
  sectionScores: Record<string, number>;
}

export interface UserProgress {
  version: 1;
  hskStandard: HskStandard;
  dailyGoalMinutes: number;
  newCardsPerDay: number;
  /** Loại thẻ tạo ra khi thêm một từ vào ôn tập. */
  srsCardTypes: SrsCard["cardType"][];
  /** Người học đã đồng ý dùng nhận dạng giọng nói của trình duyệt (âm thanh có thể gửi tới máy chủ nhận dạng). */
  speechRecognitionConsent: boolean;
  streak: number;
  lastActiveDate: string;
  completedLessonIds: string[];
  cards: SrsCard[];
  examAttempts: ExamAttempt[];
  /** Kết quả bài đọc: điểm đọc hiểu (0..1) lần gần nhất. */
  readingResults: Record<string, { score: number; date: string }>;
  /** Nhật ký học theo ngày (YYYY-MM-DD) — giữ 120 ngày gần nhất. */
  studyLog: Record<string, DayLog>;
}

export interface DayLog {
  /** Số giây học thực sự (trang học đang mở, có tương tác hoặc đang phát âm). */
  seconds: number;
  reviews: number;
  lessons: number;
  readings: number;
  exams: number;
}
