// Audio dựng sẵn (SPEC 3.19, nguồn A) — phần thuần, dùng chung cho scripts/build-audio.ts và client.
// Mỗi đoạn văn cần đọc -> SSML -> băm -> file audio/<giọng>/<hash>.mp3; manifest ánh xạ văn bản -> hash.

import type { NeuralVoiceKey } from "../config/audio.ts";
import type { ExamsFile, LessonsFile, ReadingsFile, VocabFile } from "../types.ts";
import { isHanzi } from "./pinyin.ts";

export type AudioKind = "word" | "example" | "lesson" | "reading" | "exam" | "sample";

export interface AudioItem {
  /** Văn bản đúng như client truyền vào speak() — cũng là khóa trong manifest. */
  text: string;
  kind: AudioKind;
  /** Pinyin số (vd "le5") — chỉ đặt cho từ một chữ đa âm, để đọc đúng âm của từ trong từ điển. */
  pinyinNumbered?: string;
}

export interface AudioManifest {
  version: 1;
  /** Tên giọng Azure theo khóa (để biết file được tạo bằng giọng nào). */
  voices: Partial<Record<NeuralVoiceKey, string>>;
  /** văn bản -> { female: hash, male: hash } */
  items: Record<string, Partial<Record<NeuralVoiceKey, string>>>;
}

/** Chữ đa âm thường gặp ở cấp thấp — từ một chữ chứa chúng được đọc theo pinyin trong dữ liệu (thẻ <phoneme>). */
export const POLYPHONES = new Set([..."了行还都得的地觉好要只会长中大少和便着看重为发乐教数种没空几差当"]);

/** Khóa manifest: bỏ khoảng trắng đầu/cuối. */
export const audioKey = (text: string) => text.trim();

/** Gom mọi đoạn cần đọc từ dữ liệu đã build; bỏ trùng (từ đứng riêng được ưu tiên). */
export function collectAudioItems(d: { vocab?: VocabFile; lessons?: LessonsFile; readings?: ReadingsFile; exams?: ExamsFile; sample?: string }): AudioItem[] {
  const out = new Map<string, AudioItem>();
  const add = (text: string | undefined, kind: AudioKind, pinyinNumbered?: string) => {
    const key = text ? audioKey(text) : "";
    if (!key || ![...key].some(isHanzi) || out.has(key)) return;
    out.set(key, { text: key, kind, ...(pinyinNumbered ? { pinyinNumbered } : {}) });
  };
  for (const w of d.vocab?.words ?? []) add(w.hanzi, "word", [...w.hanzi].length === 1 && POLYPHONES.has(w.hanzi) ? w.pinyinNumbered : undefined);
  for (const w of d.vocab?.words ?? []) for (const e of w.examples) add(e.zh, "example");
  for (const l of d.lessons?.lessons ?? []) {
    for (const e of l.grammar?.examples ?? []) add(e.zh, "lesson");
    for (const ex of l.exercises) if (ex.type === "speak") add((ex.prompt as { sentence?: { zh: string } }).sentence?.zh, "lesson");
  }
  for (const r of d.readings?.readings ?? []) for (const s of r.sentences) add(s.zh, "reading");
  for (const x of d.exams?.exams ?? [])
    for (const sec of x.sections) {
      if (sec.id !== "listening") continue;
      for (const p of sec.parts)
        for (const q of p.questions) {
          for (const a of q.audio ?? []) add(a.line.zh, "exam");
          add(q.question?.zh, "exam");
        }
    }
  add(d.sample, "sample");
  return [...out.values()];
}

const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "ni3 hao3" -> "ni 3 - hao 3"; "dian3r" -> "dian r 3"; "nü3" / "nv3" -> "nv 3" (bảng âm SAPI zh-CN của Azure). */
export function toSapi(numbered: string): string {
  return numbered
    .trim()
    .toLowerCase()
    .replace(/ü|u:/g, "v")
    .split(/\s+/)
    .map((syl) => {
      const m = /^([a-z]+?)([1-5])(r?)$/.exec(syl);
      if (!m) return syl;
      return m[3] ? `${m[1]} r ${m[2]}` : `${m[1]} ${m[2]}`;
    })
    .join(" - ");
}

/** Phần thân bên trong <voice> — phần này (kể cả thẻ phụ như <phoneme>) bị tính phí. */
export function ssmlBody(item: AudioItem): string {
  const t = xmlEscape(item.text);
  return item.pinyinNumbered ? `<phoneme alphabet="sapi" ph="${toSapi(item.pinyinNumbered)}">${t}</phoneme>` : t;
}

/** SSML đầy đủ — chỉ bọc tối thiểu (không chỉnh tốc độ: client dùng playbackRate). */
export function ssmlFor(item: AudioItem, voiceName: string): string {
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><voice name="${voiceName}">${ssmlBody(item)}</voice></speak>`;
}

/**
 * Ước lượng ký tự tính phí theo tài liệu Azure: chữ Hán (CJK) tính 2, mọi ký tự khác (chữ, dấu câu,
 * khoảng trắng, thẻ phụ) tính 1; phần bọc <speak>/<voice> không tính.
 */
export function billableChars(body: string): number {
  let n = 0;
  for (const ch of body) n += isHanzi(ch) || /[\u3000-\u303f\uff00-\uffef]/.test(ch) ? 2 : 1;
  return n;
}

/** Tên file ổn định theo nội dung + giọng: đổi chữ, đổi pinyin hay đổi giọng đều ra file mới. */
export async function audioHash(voiceName: string, body: string): Promise<string> {
  const data = new TextEncoder().encode(`${voiceName}\n${body}`);
  const buf = await crypto.subtle.digest("SHA-1", data);
  return [...new Uint8Array(buf)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Chọn file trong manifest: giọng yêu cầu trước, không có thì giọng còn lại. */
export function pickAudio(m: AudioManifest | null, text: string, want: NeuralVoiceKey): { voice: NeuralVoiceKey; hash: string } | null {
  const e = m?.items[audioKey(text)];
  if (!e) return null;
  const other: NeuralVoiceKey = want === "female" ? "male" : "female";
  if (e[want]) return { voice: want, hash: e[want]! };
  if (e[other]) return { voice: other, hash: e[other]! };
  return null;
}
