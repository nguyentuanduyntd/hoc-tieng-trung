// Quy trình duyệt dữ liệu HSK (SPEC B5): xuất bảng TSV cho người duyệt, nhập lại kết quả vào
// data/curated/hsk1.tsv (Hán Việt, nghĩa, trạng thái) và data/curated/pos-hsk1.tsv (từ loại).
// Hàm thuần — script ở scripts/export-review.ts, scripts/import-review.ts.

import type { Word } from "../types.ts";
import { POS_LABELS, isPosCode } from "./pos.ts";

export const REVIEW_COLUMNS = ["stt", "hanzi", "pinyin", "han_viet", "nghia_viet", "tu_loai", "vi_du", "vi_du_nghia", "trang_thai", "duyet", "ghi_chu"] as const;
type Col = (typeof REVIEW_COLUMNS)[number];

const clean = (s: string | undefined) => (s ?? "").replace(/[\t\r\n]+/g, " ").trim();

/** Bảng duyệt: một dòng mỗi từ. Cột “duyet” để trống — người duyệt ghi “ok” khi đồng ý. */
export function buildReviewTsv(words: Word[]): string {
  const rows = words.map((w, i) => {
    const ex = w.examples[0];
    const rec: Record<Col, string> = {
      stt: String(i + 1),
      hanzi: w.hanzi,
      pinyin: w.pinyin,
      han_viet: clean(w.hanViet),
      nghia_viet: clean(w.meaningVi),
      tu_loai: (w.pos ?? []).map((c) => POS_LABELS[c] ?? c).join(", "),
      vi_du: clean(ex?.zh),
      vi_du_nghia: clean(ex?.vi),
      trang_thai: w.reviewStatus === "reviewed" ? "đã duyệt" : "nháp",
      duyet: "",
      ghi_chu: "",
    };
    return REVIEW_COLUMNS.map((c) => rec[c]).join("\t");
  });
  // BOM để Excel nhận đúng UTF-8
  return "﻿" + [REVIEW_COLUMNS.join("\t"), ...rows].join("\n") + "\n";
}

export interface ReviewRow {
  line: number;
  hanzi: string;
  hanViet: string;
  meaningVi: string;
  pos: string[] | null;
  approved: boolean;
}

const APPROVE = /^(ok|x|v|✓|✔|đồng ý|dong y|duyệt|duyet|đã duyệt|da duyet|yes|y)$/i;

/** Đổi nhãn từ loại (“động từ, giới từ”) hoặc mã (“v,p”) về mã. */
export function parsePos(text: string): { codes: string[]; bad: string[] } {
  const byLabel = new Map(Object.entries(POS_LABELS).map(([k, v]) => [v.toLowerCase(), k]));
  const codes: string[] = [];
  const bad: string[] = [];
  for (const part of text.split(/[,;/]/).map((s) => s.trim().toLowerCase()).filter(Boolean)) {
    const code = isPosCode(part) ? part : byLabel.get(part);
    if (code) codes.push(code);
    else bad.push(part);
  }
  return { codes, bad };
}

export function parseReviewTsv(text: string): { rows: ReviewRow[]; errors: string[] } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const header = (lines[0] ?? "").split("\t").map((h) => h.trim().toLowerCase());
  const errors: string[] = [];
  const idx = (c: Col) => header.indexOf(c);
  for (const c of ["hanzi", "han_viet", "nghia_viet", "duyet"] as const) if (idx(c) < 0) errors.push(`thiếu cột "${c}" ở dòng tiêu đề`);
  if (errors.length) return { rows: [], errors };
  const rows: ReviewRow[] = [];
  lines.slice(1).forEach((raw, i) => {
    if (!raw.trim()) return;
    const cells = raw.split("\t");
    const get = (c: Col) => (idx(c) >= 0 ? (cells[idx(c)] ?? "").trim() : "");
    const line = i + 2;
    const hanzi = get("hanzi");
    if (!hanzi) return void errors.push(`dòng ${line}: thiếu hanzi`);
    let pos: string[] | null = null;
    if (idx("tu_loai") >= 0 && get("tu_loai")) {
      const p = parsePos(get("tu_loai"));
      if (p.bad.length) errors.push(`dòng ${line} (${hanzi}): từ loại không nhận ra: ${p.bad.join(", ")}`);
      pos = p.codes;
    }
    rows.push({ line, hanzi, hanViet: get("han_viet"), meaningVi: get("nghia_viet"), pos, approved: APPROVE.test(get("duyet")) });
  });
  return { rows, errors };
}

export interface ApplyResult {
  curated: string;
  posFile: string;
  changed: { hanzi: string; field: string; from: string; to: string }[];
  approved: number;
  errors: string[];
}

/**
 * Áp kết quả duyệt vào nội dung hsk1.tsv và pos-hsk1.tsv (giữ nguyên comment & thứ tự dòng).
 * - Sửa Hán Việt / nghĩa / từ loại: áp dụng cho mọi dòng có thay đổi.
 * - Cột “duyet” = ok → trạng thái “reviewed”; để trống → giữ trạng thái cũ.
 * - Dòng đã sửa nhưng không ghi “ok” → về “nháp” (nội dung mới chưa ai duyệt).
 */
export function applyReviewRows(curated: string, posFile: string, rows: ReviewRow[]): ApplyResult {
  const errors: string[] = [];
  const changed: ApplyResult["changed"] = [];
  const byHanzi = new Map(rows.map((r) => [r.hanzi, r]));
  const seen = new Set<string>();
  let approved = 0;

  const outCurated = curated.split(/\r?\n/).map((line) => {
    if (!line.trim() || line.startsWith("#")) return line;
    const cols = line.split("\t");
    const [hanzi, override = "", hanViet = "", meaningVi = "", status = ""] = cols;
    const r = byHanzi.get(hanzi);
    if (!r) return line;
    seen.add(hanzi);
    const nextHv = r.hanViet || hanViet;
    const nextMeaning = r.meaningVi || meaningVi;
    if ([...hanzi].length !== nextHv.split(/\s+/).filter(Boolean).length)
      errors.push(`${hanzi}: Hán Việt "${nextHv}" không khớp số chữ (${[...hanzi].length})`);
    if (!nextMeaning) errors.push(`${hanzi}: nghĩa tiếng Việt trống`);
    const edited = nextHv !== hanViet || nextMeaning !== meaningVi;
    if (nextHv !== hanViet) changed.push({ hanzi, field: "Hán Việt", from: hanViet, to: nextHv });
    if (nextMeaning !== meaningVi) changed.push({ hanzi, field: "nghĩa", from: meaningVi, to: nextMeaning });
    let nextStatus = status;
    if (r.approved) {
      nextStatus = "reviewed";
      approved++;
    } else if (edited) nextStatus = "";
    return [hanzi, override, nextHv, nextMeaning, nextStatus].join("\t").replace(/\t+$/, "");
  });
  for (const r of rows) if (!seen.has(r.hanzi)) errors.push(`dòng ${r.line}: "${r.hanzi}" không có trong hsk1.tsv`);

  const outPos = posFile.split(/\r?\n/).map((line) => {
    if (!line.trim() || line.startsWith("#")) return line;
    const [hanzi, codes = ""] = line.split("\t");
    const r = byHanzi.get(hanzi);
    if (!r?.pos) return line;
    if (!r.pos.length) {
      errors.push(`${hanzi}: từ loại trống`);
      return line;
    }
    const next = r.pos.join(",");
    if (next !== codes) changed.push({ hanzi, field: "từ loại", from: codes, to: next });
    return `${hanzi}\t${next}`;
  });

  return { curated: outCurated.join("\n"), posFile: outPos.join("\n"), changed, approved, errors };
}
