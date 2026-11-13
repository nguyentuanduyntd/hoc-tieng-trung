// Từ loại (SPEC 3.14) — mã gọn dùng trong dữ liệu, nhãn tiếng Việt để hiển thị.

export const POS_LABELS: Record<string, string> = {
  n: "danh từ",
  v: "động từ",
  a: "tính từ",
  d: "phó từ",
  r: "đại từ",
  m: "số từ",
  q: "lượng từ",
  p: "giới từ",
  c: "liên từ",
  u: "trợ từ",
  e: "thán từ",
  t: "từ chỉ thời gian",
  f: "từ phương vị",
  nr: "tên riêng",
  l: "cụm từ giao tiếp",
};

export const isPosCode = (c: string) => c in POS_LABELS;

export const posLabel = (c: string) => POS_LABELS[c] ?? c;

/** Tách nghĩa tiếng Việt thành từng nghĩa riêng (phân cách bằng dấu chấm phẩy). */
export function splitSenses(meaningVi: string): string[] {
  return meaningVi
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}
