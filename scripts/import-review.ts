// Nhập kết quả duyệt từ docs/review-hsk1.tsv (hoặc đường dẫn khác) vào data/curated/hsk1.tsv + pos-hsk1.tsv.
// Chạy: npm run review:import [-- <file.tsv>] [-- --dry-run]
// Sau khi nhập: npm run data (build lại) — từ đã duyệt sẽ không còn nhãn "nháp".

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyReviewRows, parseReviewTsv } from "../src/lib/review.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const input = resolve(root, args.find((a) => !a.startsWith("--")) ?? "docs/review-hsk1.tsv");
const CURATED = resolve(root, "data/curated/hsk1.tsv");
const POS = resolve(root, "data/curated/pos-hsk1.tsv");

const { rows, errors: parseErrors } = parseReviewTsv(readFileSync(input, "utf8"));
const res = applyReviewRows(readFileSync(CURATED, "utf8"), readFileSync(POS, "utf8"), rows);
const errors = [...parseErrors, ...res.errors];
if (errors.length) {
  console.error(`✗ ${errors.length} lỗi — chưa ghi gì:\n  ` + errors.join("\n  "));
  process.exit(1);
}
for (const c of res.changed) console.log(`  ${c.hanzi} · ${c.field}: "${c.from}" → "${c.to}"`);
console.log(`${dryRun ? "(chạy thử) " : ""}✓ ${rows.length} dòng, ${res.changed.length} thay đổi, ${res.approved} từ được đánh dấu đã duyệt.`);
if (!dryRun) {
  writeFileSync(CURATED, res.curated, "utf8");
  writeFileSync(POS, res.posFile, "utf8");
  console.log("  Đã ghi data/curated/hsk1.tsv và pos-hsk1.tsv. Chạy `npm run data` để build lại.");
}
