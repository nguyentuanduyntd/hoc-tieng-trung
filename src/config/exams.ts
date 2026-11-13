// Cấu trúc đề thi theo chuẩn & cấp (SPEC 3.9). Engine thi thử chỉ đọc cấu trúc từ đây —
// không hard-code số câu / thời gian trong component.
//
// HSK 3.0 cấp 1 — đối chiếu ngày 13/11/2026 với tài liệu chính thức của 汉考国际 (CTI):
// “新版HSK（1-6级）考试结构与样题示例”, phát hành 12/2025, áp dụng 07/2026 (cấu trúc phần, số câu,
// dạng câu, thời lượng). Tài liệu KHÔNG nêu thang điểm và số lần phát âm thanh — các mục đó vẫn theo
// trang HSK 1 hiện hành trên chinesetest.cn và đánh dấu chưa xác minh (xem `verified`, `sources`).

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
  /**
   * Bảng phương án dùng chung cho cả phần (A–F): 5 câu cùng chọn trong một bảng 6 phương án,
   * mỗi phương án dùng tối đa một lần (như đề chính thức).
   */
  shared?: boolean;
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
  /** Mục nào đã đối chiếu được với tài liệu chính thức. */
  verified: { structure: boolean; timing: boolean; scoring: boolean; audioPlays: boolean };
  notes: string[];
  /** Nguồn đã đối chiếu (ghi rõ ngày). */
  sources: { label: string; url: string; checkedAt: string; covers: string }[];
  officialLinks: { label: string; url: string }[];
}

/** Tất cả mục đã xác minh. */
export const fullyVerified = (c: ExamConfig) => Object.values(c.verified).every(Boolean);

const OFFICIAL_LINKS = [
  { label: "Đề mẫu chính thức trên CTI (chinesetest.cn)", url: "https://www.chinesetest.cn" },
  { label: "Làm thêm đề trên Mandarin Bean", url: "https://mandarinbean.com" },
];

/** HSK 2.0 cấp 1: nghe ~15 phút + 3 phút điền phiếu (chinesetest.cn). */
const LISTEN_HSK1_V2: ListeningTiming = {
  mode: "audio-paced",
  playsPerItem: 2,
  gapMs: 1500,
  answerSeconds: 10,
  reviewSeconds: 180,
  nominalMinutes: 15,
};

/** HSK 3.0 cấp 1: nghe ~12 phút (tổng thời gian đã gồm điền phiếu). Số lần phát chưa được nêu -> giữ 2 lần như HSK 1 hiện hành. */
const LISTEN_HSK1_V3: ListeningTiming = {
  mode: "audio-paced",
  playsPerItem: 2,
  gapMs: 1200,
  answerSeconds: 8,
  reviewSeconds: 60,
  nominalMinutes: 12,
};

const CTI_NEW_STRUCTURE = {
  label: "汉考国际 – 新版HSK（1-6级）考试结构与样题示例 (phát hành 12/2025, áp dụng 07/2026)",
  url: "https://s3.eu-central-1.amazonaws.com/konfuzius-institut-heidelberg.de/wp-content/uploads/2026/02/19110129/%E6%96%B0%E7%89%88HSK%EF%BC%881-6%E7%BA%A7%EF%BC%89%E8%80%83%E8%AF%95%E7%BB%93%E6%9E%84%E4%B8%8E%E6%A0%B7%E9%A2%98%E7%A4%BA%E4%BE%8B.pdf",
  checkedAt: "2026-11-13",
  covers: "cấu trúc 4+4 phần, số câu, dạng câu, thời lượng (nghe ~12 phút, đọc 20 phút, tổng ~40 phút)",
};
const CTI_HSK1_PAGE = {
  label: "chinesetest.cn – HSK 1 (đề hiện hành)",
  url: "https://www.chinesetest.cn/HSK/1",
  checkedAt: "2026-11-13",
  covers: "thang điểm 200, đạt từ 120 (áp dụng cho đề hiện hành, chưa nêu cho đề mới)",
};

export const EXAM_CONFIGS: ExamConfig[] = [
  {
    standard: "3.0",
    level: 1,
    totalScore: 200,
    passScore: 120,
    showPinyin: true,
    verified: { structure: true, timing: true, scoring: false, audioPlays: false },
    notes: [
      "Cấu trúc, dạng câu và thời lượng theo tài liệu chính thức của CTI (đối chiếu 13/11/2026): 40 câu — Nghe 20 câu (~12 phút), Đọc 20 câu (20 phút), không có phần viết.",
      "Thang điểm 200 / đạt 120 và việc mỗi câu nghe phát 2 lần lấy theo đề HSK 1 hiện hành — tài liệu đề mới chưa nêu.",
      "Kỳ thi HSK 3.0 chính thức đầu tiên dự kiến 13/12/2026.",
    ],
    sources: [CTI_NEW_STRUCTURE, CTI_HSK1_PAGE],
    officialLinks: OFFICIAL_LINKS,
    sections: [
      {
        id: "listening",
        title: "Nghe",
        scoreMax: 100,
        timing: LISTEN_HSK1_V3,
        parts: [
          { id: "L1", title: "Phần 1", instructionsVi: "Nghe cụm từ, chọn hình đúng (A, B hoặc C).", kind: "choose-picture", count: 5, optionCount: 3 },
          { id: "L2", title: "Phần 2", instructionsVi: "Nghe câu hỏi, chọn câu trả lời phù hợp.", kind: "choose-text", count: 5, optionCount: 3 },
          { id: "L3", title: "Phần 3", instructionsVi: "Nghe đoạn hội thoại ngắn, chọn hình phù hợp trong bảng A–F.", kind: "choose-picture", count: 5, optionCount: 6, shared: true },
          { id: "L4", title: "Phần 4", instructionsVi: "Nghe câu và câu hỏi, chọn đáp án đúng.", kind: "choose-text", count: 5, optionCount: 3 },
        ],
      },
      {
        id: "reading",
        title: "Đọc",
        scoreMax: 100,
        timing: { mode: "countdown", minutes: 20 },
        parts: [
          { id: "R1", title: "Phần 1", instructionsVi: "Đọc câu, chọn hình phù hợp trong bảng A–F.", kind: "choose-picture", count: 5, optionCount: 6, shared: true },
          { id: "R2", title: "Phần 2", instructionsVi: "Chọn câu trả lời phù hợp (A–F) cho mỗi câu.", kind: "choose-text", count: 5, optionCount: 6, shared: true },
          { id: "R3", title: "Phần 3", instructionsVi: "Chọn từ thích hợp (A–F) điền vào chỗ trống.", kind: "fill-blank", count: 5, optionCount: 6, shared: true },
          { id: "R4", title: "Phần 4", instructionsVi: "Đọc câu và câu hỏi (★), chọn đáp án đúng.", kind: "choose-text", count: 5, optionCount: 3 },
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
    verified: { structure: true, timing: true, scoring: true, audioPlays: true },
    notes: [
      "40 câu, khoảng 40 phút: Nghe 20 câu (~15 phút, mỗi câu nghe 2 lần) + 3 phút điền phiếu, Đọc 20 câu (17 phút).",
      "Chưa có đề HSK 2.0 trong dự án; cấu trúc giữ ở đây để engine dùng chung.",
    ],
    sources: [{ ...CTI_HSK1_PAGE, covers: "cấu trúc, thời lượng, thang điểm của đề HSK 1 hiện hành" }],
    officialLinks: OFFICIAL_LINKS,
    sections: [
      {
        id: "listening",
        title: "Nghe",
        scoreMax: 100,
        timing: LISTEN_HSK1_V2,
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
