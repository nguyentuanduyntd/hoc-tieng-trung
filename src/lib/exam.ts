// Engine thi thử: dựng đề từ dữ liệu soạn sẵn, kiểm tra đề theo config, chấm điểm, câu sai -> ôn tập.

import type { ExamConfig, ExamPartConfig } from "../config/exams.ts";
import type { Exam, ExamOption, ExamQuestion, ExamSentence, SrsCard, Word } from "../types.ts";
import { unknownHanzi, type Segmenter } from "./segment.ts";
import { sentencePinyin, tokenPinyins } from "./sentence.ts";
import { addWordCards, markWordForReview, type CardType } from "./srs.ts";

// ---------- Dựng đề (lúc build) ----------

export interface QuestionSpec {
  audio?: (string | { speaker?: string; zh: string })[];
  text?: string;
  question?: string;
  picture?: string;
  options?: string[];
  answer: number | boolean;
  keyWords: string[];
  explanationVi: string;
}

export interface ExamSpec {
  id: string;
  standard: Exam["standard"];
  level: number;
  title: string;
  /** Mỗi phần: danh sách câu, hoặc { bank, items } khi phần dùng bảng phương án chung A–F. */
  parts: Record<string, QuestionSpec[] | SharedPartSpec>;
}

/** Phần dùng chung một bảng phương án (hình hoặc chữ); `answer` của từng câu là chỉ số trong bảng. */
export interface SharedPartSpec {
  bank: string[];
  items: QuestionSpec[];
}

export const JUDGE_OPTIONS: ExamOption[] = [{ label: "✓ Đúng" }, { label: "✗ Sai" }];

export function buildExam(
  spec: ExamSpec,
  config: ExamConfig,
  seg: Segmenter,
  byId: Map<string, Word>,
  byHanzi: Map<string, Word>,
): { exam: Exam; errors: string[] } {
  const errors: string[] = [];
  const pinyinOf = (id: string) => byId.get(id)?.pinyin;
  const sentence = (zh: string, where: string): ExamSentence => {
    const tokens = seg.segment(zh);
    const unk = unknownHanzi(tokens);
    if (unk.length) errors.push(`${where}: "${zh}" có chữ ngoài từ điển: ${unk.join(", ")}`);
    return { zh, tokens, tokenPinyin: tokenPinyins(tokens, pinyinOf), pinyin: sentencePinyin(tokens, pinyinOf) };
  };
  let number = 0;
  const knownParts = new Set(config.sections.flatMap((s) => s.parts.map((p) => p.id)));
  for (const pid of Object.keys(spec.parts)) if (!knownParts.has(pid)) errors.push(`${spec.id}: phần ${pid} không có trong cấu trúc đề`);

  const sections = config.sections.map((sec) => ({
    id: sec.id,
    parts: sec.parts.map((pc) => {
      const raw = spec.parts[pc.id] ?? [];
      const bank = Array.isArray(raw) ? undefined : raw.bank;
      const qs = Array.isArray(raw) ? raw : raw.items;
      if (pc.shared && !bank) errors.push(`${spec.id} ${pc.id}: phần này cần bảng phương án chung { bank, items }`);
      if (!pc.shared && bank) errors.push(`${spec.id} ${pc.id}: phần này không dùng bảng chung`);
      const toOption = (o: string, where: string): ExamOption => (pc.kind === "choose-picture" ? { picture: o } : { text: sentence(o, where) });
      const bankOptions = bank?.map((o) => toOption(o, `${spec.id} ${pc.id} (bảng)`));
      return {
        id: pc.id,
        questions: qs.map((q, i): ExamQuestion => {
          const where = `${spec.id} ${pc.id}#${i + 1}`;
          const options: ExamOption[] =
            pc.kind === "judge-picture" ? JUDGE_OPTIONS : bankOptions ?? (q.options ?? []).map((o) => toOption(o, where));
          const keyWordIds = q.keyWords.map((h) => {
            const w = byHanzi.get(h);
            if (!w) errors.push(`${where}: từ khóa "${h}" không có trong từ điển`);
            return w?.id ?? "";
          });
          return {
            id: `${spec.id}-${pc.id}-${i + 1}`,
            number: ++number,
            partId: pc.id,
            kind: pc.kind,
            ...(q.audio
              ? { audio: q.audio.map((a) => (typeof a === "string" ? { line: sentence(a, where) } : { speaker: a.speaker, line: sentence(a.zh, where) })) }
              : {}),
            ...(q.text !== undefined ? { text: sentence(q.text, where) } : {}),
            ...(q.question ? { question: sentence(q.question, where) } : {}),
            ...(q.picture ? { picture: q.picture } : {}),
            options,
            // judge-picture: Đúng = 0, Sai = 1
            answer: typeof q.answer === "boolean" ? (q.answer ? 0 : 1) : q.answer,
            keyWordIds: keyWordIds.filter(Boolean),
            explanationVi: q.explanationVi,
          };
        }),
      };
    }),
  }));
  const exam: Exam = { id: spec.id, standard: spec.standard, level: spec.level, title: spec.title, sections };
  errors.push(...validateExam(exam, config));
  return { exam, errors };
}

// ---------- Kiểm tra đề theo config ----------

export function validateExam(exam: Exam, config: ExamConfig): string[] {
  const e: string[] = [];
  if (exam.standard !== config.standard || exam.level !== config.level) e.push(`${exam.id}: chuẩn/cấp không khớp config`);
  if (exam.sections.length !== config.sections.length) e.push(`${exam.id}: số phần thi khác config`);
  const ids = new Set<string>();
  config.sections.forEach((sc, si) => {
    const s = exam.sections[si];
    if (!s || s.id !== sc.id) return void e.push(`${exam.id}: thiếu phần thi ${sc.id}`);
    sc.parts.forEach((pc, pi) => {
      const p = s.parts[pi];
      if (!p || p.id !== pc.id) return void e.push(`${exam.id}: thiếu ${pc.id}`);
      if (p.questions.length !== pc.count) e.push(`${exam.id} ${pc.id}: cần ${pc.count} câu (đang có ${p.questions.length})`);
      for (const q of p.questions) e.push(...validateQuestion(q, pc, sc.id === "listening"));
      if (pc.kind === "judge-picture") {
        const answers = new Set(p.questions.map((q) => q.answer));
        if (answers.size < 2) e.push(`${exam.id} ${pc.id}: phần Đúng/Sai cần có cả câu đúng và câu sai`);
      }
      if (pc.shared) {
        // bảng chung: mọi câu cùng một bảng, mỗi phương án dùng tối đa một lần
        const key = (q: ExamQuestion) => q.options.map((o) => o.picture ?? o.text?.zh ?? o.label).join("|");
        if (new Set(p.questions.map(key)).size > 1) e.push(`${exam.id} ${pc.id}: các câu phải dùng chung một bảng phương án`);
        const answers = p.questions.map((q) => q.answer);
        if (new Set(answers).size !== answers.length) e.push(`${exam.id} ${pc.id}: hai câu trùng đáp án trong bảng chung`);
      } else if (pc.optionCount === 3 && p.questions.length >= 5) {
        const pos = new Set(p.questions.map((q) => q.answer));
        if (pos.size < 2) e.push(`${exam.id} ${pc.id}: đáp án dồn vào một vị trí`);
      }
    });
  });
  for (const q of allQuestions(exam)) {
    if (ids.has(q.id)) e.push(`${q.id}: id trùng`);
    ids.add(q.id);
  }
  const nums = allQuestions(exam).map((q) => q.number);
  if (nums.some((n, i) => n !== i + 1)) e.push(`${exam.id}: số thứ tự câu không liên tục`);
  return e;
}

export function validateQuestion(q: ExamQuestion, pc: ExamPartConfig, listening: boolean): string[] {
  const e: string[] = [];
  if (q.kind !== pc.kind) e.push(`${q.id}: dạng câu ${q.kind} ≠ config ${pc.kind}`);
  if (q.options.length !== pc.optionCount) e.push(`${q.id}: cần ${pc.optionCount} phương án (có ${q.options.length})`);
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) e.push(`${q.id}: đáp án ngoài phạm vi`);
  if (listening && !q.audio?.length) e.push(`${q.id}: câu nghe thiếu lời đọc`);
  if (!listening && !q.text) e.push(`${q.id}: câu đọc thiếu văn bản`);
  if ((q.kind === "judge-picture") && !q.picture) e.push(`${q.id}: thiếu hình`);
  if (q.kind === "choose-picture" && q.options.some((o) => !o.picture)) e.push(`${q.id}: phương án phải là hình`);
  if ((q.kind === "choose-text" || q.kind === "fill-blank") && q.options.some((o) => !o.text)) e.push(`${q.id}: phương án phải là chữ`);
  if (q.kind === "fill-blank" && !q.text?.zh.includes("＿")) e.push(`${q.id}: câu điền từ thiếu chỗ trống ＿`);
  const keys = q.options.map((o) => o.picture ?? o.text?.zh ?? o.label);
  if (new Set(keys).size !== keys.length) e.push(`${q.id}: phương án bị trùng`);
  if (!q.keyWordIds.length) e.push(`${q.id}: thiếu từ khóa liên quan`);
  if (!q.explanationVi.trim()) e.push(`${q.id}: thiếu giải thích`);
  return e;
}

export const allQuestions = (exam: Exam): ExamQuestion[] => exam.sections.flatMap((s) => s.parts.flatMap((p) => p.questions));

// ---------- Chấm điểm ----------

export interface SectionResult {
  id: string;
  correct: number;
  total: number;
  score: number;
  scoreMax: number;
}

export interface ExamResult {
  sections: SectionResult[];
  total: number;
  totalMax: number;
  passed: boolean;
  wrongIds: string[];
  unansweredIds: string[];
}

/** `answers`: questionId -> chỉ số phương án đã chọn (thiếu = bỏ trống, tính sai). */
export function scoreExam(exam: Exam, config: ExamConfig, answers: Record<string, number>): ExamResult {
  const wrongIds: string[] = [];
  const unansweredIds: string[] = [];
  const sections = exam.sections.map((s) => {
    const sc = config.sections.find((x) => x.id === s.id)!;
    const qs = s.parts.flatMap((p) => p.questions);
    let correct = 0;
    for (const q of qs) {
      const a = answers[q.id];
      if (a === undefined) unansweredIds.push(q.id);
      if (a === q.answer) correct++;
      else wrongIds.push(q.id);
    }
    return { id: s.id, correct, total: qs.length, score: qs.length ? Math.round((correct / qs.length) * sc.scoreMax) : 0, scoreMax: sc.scoreMax };
  });
  const total = sections.reduce((n, s) => n + s.score, 0);
  return { sections, total, totalMax: config.totalScore, passed: total >= config.passScore, wrongIds, unansweredIds };
}

/** Từ liên quan tới các câu sai (không trùng). */
export function wrongWordIds(exam: Exam, wrongIds: string[]): string[] {
  const wrong = new Set(wrongIds);
  return [...new Set(allQuestions(exam).filter((q) => wrong.has(q.id)).flatMap((q) => q.keyWordIds))];
}

/** Câu sai -> từ liên quan vào SRS: từ chưa có thẻ thì tạo thẻ mới, từ đã học thì đưa về "đến hạn ngay". */
export function applyWrongToSrs(cards: SrsCard[], wordIds: string[], types: CardType[], now: Date): SrsCard[] {
  let out = cards;
  wordIds.forEach((id, i) => {
    const has = out.some((c) => c.wordId === id);
    out = has ? markWordForReview(out, id, now) : addWordCards(out, id, types, new Date(now.getTime() + i));
  });
  return out;
}

// ---------- Đồng hồ ----------

/** Định dạng mm:ss từ số ms còn lại (không âm). */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
