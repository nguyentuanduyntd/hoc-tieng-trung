// Xuất bảng duyệt dữ liệu HSK 1: docs/review-hsk1.tsv (mở bằng Excel / Google Sheets / LibreOffice).
// Chạy: npm run review:export   (sau npm run data)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildReviewTsv } from "../src/lib/review.ts";
import type { VocabFile } from "../src/types.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vocab: VocabFile = JSON.parse(readFileSync(resolve(root, "public/data/vocab/hsk1.json"), "utf8"));
const OUT = resolve(root, "docs/review-hsk1.tsv");
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, buildReviewTsv(vocab.words), "utf8");
const drafts = vocab.words.filter((w) => w.reviewStatus !== "reviewed").length;
console.log(`✓ ${vocab.words.length} từ (${drafts} bản nháp) -> ${OUT}`);
console.log(`  Sửa trực tiếp cột han_viet / nghia_viet / tu_loai nếu cần; ghi "ok" ở cột duyet cho từ đã duyệt; rồi chạy: npm run review:import`);
