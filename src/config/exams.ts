// Cấu trúc đề thi theo chuẩn & cấp (SPEC 3.9). Engine thi thử chỉ đọc cấu trúc từ đây —
// không hard-code số câu / thời gian trong component.
//
// ⚠️ HSK 3.0 cấp 1: CTI chưa công bố đầy đủ đề mẫu theo định dạng mới (tại thời điểm 13/11/2026).
// Cấu trúc dưới đây tổng hợp từ nguồn bên thứ ba (40 câu, nghe 20 + đọc 20, có 2 dạng mới) và
// thời lượng/thang điểm của HSK 2.0 cấp 1. Phải đối chiếu với https://www.chinesetest.cn trước khi chốt.

import type { HskStandard } from "../types.ts";

/** Dạng câu hỏi đề thi. */
export type ExamQuestionKind =
  | "judge-picture" // đúng/sai so với hình
  | "choose-picture" // chọn hình đúng
  | "choose-text" // chọn câu trả lời (chữ)
  | "fill-blank"; // chọn từ điền vào chỗ trống

export interface ExamPartConfig {
  id: string;
  title: string;
  instructionsVi: string;
  kind: ExamQuestionKind;
  count: number;
  /** Số phương án (judge-picture luôn là 2: Đúng/Sai). */
  optionCount: number;
}

export interface ListeningTiming {
  mode: "audio-paced";
  /** Mỗi câu phát mấy lần. */
  playsPerItem: number;
  /** Nghỉ giữa hai lần phát (ms). */
  gapMs: number;
  /** Thời gian chọn đáp án sau lần phát cuối (giây). */
  answerSeconds: number;
  /** Thời gian xem lại/sửa đáp án phần nghe sau khi hết phần nghe (giây; 0 = không có). */
  reviewSeconds: number;
  /** Thời lượng danh nghĩa theo đề chính thức (phút) — để hiển thị. */
  nominalMinutes: number;
}

export interface TimedSection {
  mode: "countdown";
  minutes: number;
}

export interface ExamSectionConfig {
  id: "listening" | "reading" | "writing";
  title: string;
  scoreMax: number;
  timing: ListeningTiming | TimedSection;
  parts: ExamPartConfig[];
}

export interface ExamConfig {
  standard: HskStandard;
  level: number;
  totalScore: number;
  passScore: number;
  /** Đề cấp thấp in pinyin trên chữ Hán. */
  showPinyin: boolean;
  sections: ExamSectionConfig[];
  verified: boolean;
  notes: string[];
  officialLinks: { label: string; url: string }[];
}

const OFFICIAL_LINKS = [
  { label: "Đề mẫu chính thức trên CTI (chinesetest.cn)", url: "https://www.chinesetest.cn" },
  { label: "Làm thêm đề trên Mandarin Bean", url: "https://mandarinbean.com" },
];

const LISTEN_HSK1: ListeningTiming = {
  mode: "audio-paced",
  playsPerItem: 2,
  gapMs: 1500,
  answerSeconds: 10,
  reviewSeconds: 180,
  nominalMinutes: 15,
};

export const EXAM_CONFIGS: ExamConfig[] = [
  {
    standard: "3.0",
    level: 1,
    totalScore: 200,
    passScore: 120,
    showPinyin: true,
    verified: false,
    notes: [
      "40 câu: Nghe 20 câu (4 phần × 5), Đọc 20 câu (4 phần × 5); không có phần viết, không thi nói.",
      "Dạng mới so với HSK 2.0: Nghe phần 3 (nghe câu hỏi, chọn câu trả lời) và Đọc phần 4 (đọc câu + câu hỏi, chọn 1 trong 3).",
      "Thời lượng (nghe ~15 phút, đọc 17 phút) và thang điểm 200 / đạt 120 lấy theo HSK 2.0 cấp 1 — chưa có xác nhận cho HSK 3.0.",
    ],
    officialLinks: OFFICIAL_LINKS,
    sections: [
      {
        id: "listening",
        title: "Nghe",
        scoreMax: 100,
        timing: LISTEN_HSK1,
        parts: [
          { id: "L1", title: "Phần 1", instructionsVi: "Nghe cụm từ, xem hình và chọn Đúng (✓) hoặc Sai (✗).", kind: "judge-picture", count: 5, optionCount: 2 },
          { id: "L2", title: "Phần 2", instructionsVi: "Nghe câu, chọn hình phù hợp.", kind: "choose-picture", count: 5, optionCount: 3 },
          { id: "L3", title: "Phần 3", instructionsVi: "Nghe câu hỏi, chọn câu trả lời phù hợp.", kind: "choose-text", count: 5, optionCount: 3 },
          { id: "L4", title: "Phần 4", instructionsVi: "Nghe đoạn hội thoại và câu hỏi, chọn đáp án đúng.", kind: "choose-text", count: 5, optionCount: 3 },
        ],
      },
      {
        id: "reading",
        title: "Đọc",
        scoreMax: 100,
        timing: { mode: "countdown", minutes: 17 },
        parts: [
          { id: "R1", title: "Phần 1", instructionsVi: "Xem hình và từ, chọn Đúng (✓) hoặc Sai (✗).", kind: "judge-picture", count: 5, optionCount: 2 },
          { id: "R2", title: "Phần 2", instructionsVi: "Đọc câu, chọn hình phù hợp.", kind: "choose-picture", count: 5, optionCount: 3 },
          { id: "R3", title: "Phần 3", instructionsVi: "Chọn từ thích hợp điền vào chỗ trống.", kind: "fill-blank", count: 5, optionCount: 3 },
          { id: "R4", title: "Phần 4", instructionsVi: "Đọc câu và câu hỏi, chọn đáp án đúng.", kind: "choose-text", count: 5, optionCount: 3 },
        ],
      },
    ],
  },
  {
    standard: "2.0",
    level: 1,
    totalScore: 200,
    passScore: 120,
    showPinyin: true,
    verified: false,
    notes: [
      "40 câu, khoảng 40 phút: Nghe 20 câu (~15 phút, mỗi câu nghe 2 lần) + 3 phút điền phiếu, Đọc 20 câu (17 phút).",
      "Chưa có đề HSK 2.0 trong dự án; cấu trúc giữ ở đây để engine dùng chung.",
    ],
    officialLinks: OFFICIAL_LINKS,
    sections: [
      {
        id: "listening",
        title: "Nghe",
        scoreMax: 100,
        timing: LISTEN_HSK1,
        parts: [
          { id: "L1", title: "Phần 1", instructionsVi: "Nghe cụm từ, chọn Đúng/Sai so với hình.", kind: "judge-picture", count: 5, optionCount: 2 },
          { id: "L2", title: "Phần 2", instructionsVi: "Nghe câu, chọn hình phù hợp.", kind: "choose-picture", count: 5, optionCount: 3 },
          { id: "L3", title: "Phần 3", instructionsVi: "Nghe hội thoại, chọn hình phù hợp.", kind: "choose-picture", count: 5, optionCount: 3 },
          { id: "L4", title: "Phần 4", instructionsVi: "Nghe câu và câu hỏi, chọn đáp án.", kind: "choose-text", count: 5, optionCount: 3 },
        ],
      },
      {
        id: "reading",
        title: "Đọc",
        scoreMax: 100,
        timing: { mode: "countdown", minutes: 17 },
        parts: [
          { id: "R1", title: "Phần 1", instructionsVi: "Xem hình và từ, chọn Đúng/Sai.", kind: "judge-picture", count: 5, optionCount: 2 },
          { id: "R2", title: "Phần 2", instructionsVi: "Đọc câu, chọn hình phù hợp.", kind: "choose-picture", count: 5, optionCount: 3 },
          { id: "R3", title: "Phần 3", instructionsVi: "Chọn câu trả lời phù hợp với câu hỏi.", kind: "choose-text", count: 5, optionCount: 3 },
          { id: "R4", title: "Phần 4", instructionsVi: "Chọn từ điền vào chỗ trống.", kind: "fill-blank", count: 5, optionCount: 3 },
        ],
      },
    ],
  },
];

export function getExamConfig(standard: HskStandard, level: number): ExamConfig | undefined {
  return EXAM_CONFIGS.find((c) => c.standard === standard && c.level === level);
}

export const isListening = (t: ExamSectionConfig["timing"]): t is ListeningTiming => t.mode === "audio-paced";
