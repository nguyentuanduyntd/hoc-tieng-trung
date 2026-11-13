// Tiện ích pinyin: chuyển đổi có dấu <-> dạng số, chuẩn hóa để tìm kiếm.
// Quy ước dạng số: thanh 1–4, thanh nhẹ = 5, ü giữ nguyên "ü" (nhận thêm "v" / "u:" khi nhập),
// nhi hóa viết dính: "diǎnr" <-> "dian3r".

const MARKS: Record<string, string[]> = {
  a: ["ā", "á", "ǎ", "à"],
  e: ["ē", "é", "ě", "è"],
  i: ["ī", "í", "ǐ", "ì"],
  o: ["ō", "ó", "ǒ", "ò"],
  u: ["ū", "ú", "ǔ", "ù"],
  ü: ["ǖ", "ǘ", "ǚ", "ǜ"],
};

/** Ký tự có dấu -> [nguyên âm gốc, thanh]. */
const MARKED_TO_BASE: Record<string, [string, number]> = {};
for (const [base, list] of Object.entries(MARKS)) {
  list.forEach((m, i) => {
    MARKED_TO_BASE[m] = [base, i + 1];
    MARKED_TO_BASE[m.toUpperCase()] = [base.toUpperCase(), i + 1];
  });
}

const VOWELS = "aeiouü";

function normalizeU(s: string): string {
  return s.replace(/u:/gi, (m) => (m[0] === "U" ? "Ü" : "ü")).replace(/v/g, "ü").replace(/V/g, "Ü");
}

/** Đặt dấu thanh cho một âm tiết không dấu (vd "hao", 3 -> "hǎo"). */
export function applyTone(syllable: string, tone: number): string {
  const s = normalizeU(syllable);
  if (tone < 1 || tone > 4) return s;
  const lower = s.toLowerCase();
  let idx = lower.indexOf("a");
  if (idx < 0) idx = lower.indexOf("e");
  if (idx < 0) idx = lower.indexOf("ou");
  if (idx < 0) {
    for (let i = lower.length - 1; i >= 0; i--) {
      if (VOWELS.includes(lower[i])) {
        idx = i;
        break;
      }
    }
  }
  if (idx < 0) return s; // không có nguyên âm (vd "m", "ng", "r")
  const ch = s[idx];
  const base = ch.toLowerCase();
  let marked = MARKS[base][tone - 1];
  if (ch !== base) marked = marked.toUpperCase();
  return s.slice(0, idx) + marked + s.slice(idx + 1);
}

const NUMBERED_SYLLABLE = /([a-zA-ZüÜ:]+?)([1-5])(r(?![aeiouü]))?/g;

/** Tách chuỗi pinyin số liền hoặc có dấu cách thành các âm tiết: "ni3hao3" -> ["ni3","hao3"]. */
export function splitNumbered(input: string): string[] {
  const out: string[] = [];
  for (const chunk of input.trim().split(/[\s'’]+/)) {
    if (!chunk) continue;
    if (!/[1-5]/.test(chunk)) {
      out.push(chunk);
      continue;
    }
    const re = new RegExp(NUMBERED_SYLLABLE.source, "g");
    let m: RegExpExecArray | null;
    let last = 0;
    while ((m = re.exec(chunk))) {
      if (m.index > last) out.push(chunk.slice(last, m.index));
      out.push(m[0]);
      last = re.lastIndex;
    }
    if (last < chunk.length) out.push(chunk.slice(last));
  }
  return out;
}

/** "ni3 hao3" | "ni3hao3" | "nv3" | "dian3r" -> "nǐ hǎo" | "nǚ" | "diǎnr". */
export function numberedToMarked(input: string): string {
  return splitNumbered(input)
    .map((syl) => {
      const m = /^([a-zA-ZüÜ:]+?)([1-5])(r?)$/.exec(syl);
      if (!m) return normalizeU(syl);
      return applyTone(m[1], Number(m[2])) + m[3];
    })
    .join(" ");
}

/** Tách một âm tiết có dấu thành [gốc không dấu, thanh (5 nếu không dấu)]. */
export function parseMarkedSyllable(syllable: string): [string, number] {
  let tone = 5;
  let base = "";
  for (const ch of syllable) {
    const hit = MARKED_TO_BASE[ch];
    if (hit) {
      base += hit[0];
      tone = hit[1];
    } else base += ch;
  }
  return [base, tone];
}

/** "nǐ hǎo" -> "ni3 hao3"; "bà ba" -> "ba4 ba5"; "diǎnr" -> "dian3r". */
export function markedToNumbered(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((syl) => {
      const [base, tone] = parseMarkedSyllable(syl);
      // nhi hóa: "diǎnr" -> "dian3r" (nhưng "ér"/"er" là âm tiết riêng)
      if (base.length > 2 && /r$/i.test(base) && base.toLowerCase() !== "er") {
        return base.slice(0, -1) + tone + "r";
      }
      return base + tone;
    })
    .join(" ");
}

/** Bỏ dấu thanh: "nǚ hǎo" -> "nü hao". */
export function stripTones(input: string): string {
  let out = "";
  for (const ch of input) out += MARKED_TO_BASE[ch]?.[0] ?? ch;
  return out;
}

/** Số âm tiết pinyin (nhi hóa "diǎnr" tính là 1). */
export function syllableCount(pinyin: string): number {
  return pinyin.trim().split(/\s+/).filter(Boolean).length;
}

/** Khóa tìm kiếm bỏ dấu, bỏ khoảng trắng, ü -> v, chữ thường: "nǚ ér" -> "nver". */
export function toneless(input: string): string {
  return stripTones(normalizeU(input).toLowerCase()).replace(/ü/g, "v").replace(/[\s'’]+/g, "");
}

/** Khóa tìm kiếm dạng số không khoảng trắng: "nǚ ér" -> "nv3er2". */
export function numberedKey(numbered: string): string {
  return normalizeU(numbered.toLowerCase()).replace(/ü/g, "v").replace(/[\s'’]+/g, "");
}

export function hasToneMarks(input: string): boolean {
  for (const ch of input) if (MARKED_TO_BASE[ch]) return true;
  return false;
}

/** Ký tự có phải chữ Hán (CJK Unified Ideographs + mở rộng A) không. */
export function isHanzi(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return (c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf) || (c >= 0x20000 && c <= 0x2a6df);
}
