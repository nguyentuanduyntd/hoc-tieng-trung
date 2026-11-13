// Quét link nội bộ (SPEC mục 6 "Test link chết"): fail nếu có href="#" / href rỗng, route không tồn tại,
// hoặc link tĩnh trỏ tới bài học / bài đọc / đề thi không có trong dữ liệu.
// Chạy: node scripts/check-links.ts   (đã gắn vào `npm test`)

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface LinkIssue {
  file: string;
  line: number;
  href: string;
  problem: string;
}

export interface LinkContext {
  routes: Set<string>;
  lessonIds: Set<string>;
  readingIds: Set<string>;
  examIds: Set<string>;
  unitNumbers: Set<string>;
}

/** Lấy tên route từ khối `const routes: Record<string, Route> = { ... }` trong src/main.ts. */
export function parseRoutes(mainTs: string): Set<string> {
  const start = mainTs.indexOf("const routes: Record<string, Route> = {");
  if (start < 0) throw new Error("Không tìm thấy bảng routes trong src/main.ts");
  const out = new Set<string>();
  let depth = 0;
  for (const line of mainTs.slice(start).split("\n")) {
    if (depth === 1) {
      const m = /^\s*"?([\w-]+)"?\s*:/.exec(line);
      if (m) out.add(m[1]);
    }
    for (const ch of line) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    if (depth === 0 && out.size) break;
  }
  return out;
}

/** Kiểm tra một href. Trả về mô tả lỗi hoặc null. Phần động (${…}) không kiểm tra được thì bỏ qua. */
export function checkHref(href: string, ctx: LinkContext): string | null {
  if (href === "" ) return "href rỗng";
  if (href === "#") return 'href="#" (link không đi đâu)';
  if (/^(https?:|mailto:|tel:|blob:|data:)/.test(href)) return null;
  if (href.startsWith("${")) return null; // toàn bộ href là biểu thức (vd link ngoài từ config)
  if (href.startsWith("#q-")) return null; // neo trong trang (bảng số câu đề thi)
  if (!href.startsWith("#/")) return `link nội bộ phải dạng "#/route" (đang là "${href}")`;
  const path = href.slice(2).split("?")[0];
  const [head, ...rest] = path.split("/");
  if (head.includes("${")) return null;
  if (head !== "" && !ctx.routes.has(head)) return `route "${head}" không tồn tại`;
  const param = rest.join("/");
  if (!param || param.includes("${")) return null;
  if (head === "bai-hoc") {
    const skip = /^thi-vuot\/(\d+)$/.exec(param);
    if (skip) return ctx.unitNumbers.has(skip[1]) ? null : `unit ${skip[1]} không tồn tại`;
    return ctx.lessonIds.has(param) ? null : `bài học "${param}" không tồn tại`;
  }
  if (head === "doc") return ctx.readingIds.has(param) ? null : `bài đọc "${param}" không tồn tại`;
  if (head === "thi-thu") return ctx.examIds.has(param) ? null : `đề thi "${param}" không tồn tại`;
  if (head === "phat-am") return ["thanh", "cap", "bien-dieu", "noi"].includes(param) ? null : `tab phát âm "${param}" không tồn tại`;
  return null;
}

/** Tìm mọi href="…" (kể cả trong template literal) trong một file. */
export function extractHrefs(text: string): { href: string; line: number }[] {
  const out: { href: string; line: number }[] = [];
  const re = /href=(\\?["'])((?:(?!\1)[^\n])*?)\1/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const line = text.slice(0, m.index).split("\n").length;
    out.push({ href: m[2], line });
  }
  return out;
}

function walk(dir: string, exts: RegExp): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p, exts) : exts.test(f) ? [p] : [];
  });
}

export function runCheck(root: string): LinkIssue[] {
  const json = (p: string) => JSON.parse(readFileSync(resolve(root, p), "utf8"));
  const lessons = json("public/data/lessons/hsk1.json");
  const ctx: LinkContext = {
    routes: parseRoutes(readFileSync(resolve(root, "src/main.ts"), "utf8")),
    lessonIds: new Set(lessons.lessons.map((l: { id: string }) => l.id)),
    unitNumbers: new Set(lessons.units.map((u: { unit: number }) => String(u.unit))),
    readingIds: new Set(json("public/data/readings/hsk1.json").readings.map((r: { id: string }) => r.id)),
    examIds: new Set(json("public/data/exams/hsk1.json").exams.map((e: { id: string }) => e.id)),
  };
  const files = [resolve(root, "index.html"), ...walk(resolve(root, "src"), /\.(ts|html)$/)];
  const issues: LinkIssue[] = [];
  for (const f of files) {
    for (const { href, line } of extractHrefs(readFileSync(f, "utf8"))) {
      const problem = checkHref(href, ctx);
      if (problem) issues.push({ file: relative(root, f).replace(/\\/g, "/"), line, href, problem });
    }
  }
  return issues;
}

// Chạy trực tiếp
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const issues = runCheck(root);
  if (issues.length) {
    console.error(`✗ ${issues.length} link nội bộ lỗi:`);
    for (const i of issues) console.error(`  ${i.file}:${i.line}  ${i.href}  — ${i.problem}`);
    process.exit(1);
  }
  console.log("✓ Link nội bộ hợp lệ");
}
