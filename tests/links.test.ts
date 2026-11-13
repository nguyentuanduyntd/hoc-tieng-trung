import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkHref, extractHrefs, parseRoutes, runCheck, type LinkContext } from "../scripts/check-links.ts";

const ctx: LinkContext = {
  routes: new Set(["home", "bai-hoc", "doc", "thi-thu", "phat-am", "cai-dat"]),
  lessonIds: new Set(["hsk1-u1-l1"]),
  readingIds: new Set(["hsk1-r1"]),
  examIds: new Set(["hsk1-3.0-01"]),
  unitNumbers: new Set(["1"]),
};

describe("quét link nội bộ", () => {
  it("bắt href=\"#\" và href rỗng", () => {
    expect(checkHref("#", ctx)).toMatch(/không đi đâu/);
    expect(checkHref("", ctx)).toMatch(/rỗng/);
  });
  it("bắt route không tồn tại", () => {
    expect(checkHref("#/khong-co", ctx)).toMatch(/không tồn tại/);
    expect(checkHref("#/cai-dat", ctx)).toBeNull();
    expect(checkHref("#/", ctx)).toBeNull();
  });
  it("bắt bài học / bài đọc / đề thi / unit tĩnh không có trong dữ liệu", () => {
    expect(checkHref("#/bai-hoc/hsk1-u1-l1", ctx)).toBeNull();
    expect(checkHref("#/bai-hoc/hsk1-u9-l9", ctx)).toMatch(/bài học/);
    expect(checkHref("#/bai-hoc/thi-vuot/1", ctx)).toBeNull();
    expect(checkHref("#/bai-hoc/thi-vuot/7", ctx)).toMatch(/unit 7/);
    expect(checkHref("#/doc/hsk1-r99", ctx)).toMatch(/bài đọc/);
    expect(checkHref("#/thi-thu/khong-co", ctx)).toMatch(/đề thi/);
    expect(checkHref("#/phat-am/xyz", ctx)).toMatch(/tab phát âm/);
  });
  it("bỏ qua phần động, link ngoài, neo trong trang", () => {
    expect(checkHref("#/bai-hoc/${id}", ctx)).toBeNull();
    expect(checkHref("${esc(r.url)}", ctx)).toBeNull();
    expect(checkHref("https://example.org", ctx)).toBeNull();
    expect(checkHref("#q-${q.id}", ctx)).toBeNull();
  });
  it("link nội bộ sai dạng", () => expect(checkHref("bai-hoc", ctx)).toMatch(/phải dạng/));
  it("trích href kể cả trong template literal", () => {
    const t = 'a <a href="#/doc">x</a>\n`<a href="#/bai-hoc/${id}">` <a href=\'#\'>';
    expect(extractHrefs(t)).toEqual([
      { href: "#/doc", line: 1 },
      { href: "#/bai-hoc/${id}", line: 2 },
      { href: "#", line: 2 },
    ]);
  });
  it("đọc đúng bảng route trong main.ts", () => {
    const r = parseRoutes(readFileSync(new URL("../src/main.ts", import.meta.url), "utf8"));
    for (const k of ["home", "bai-hoc", "doc", "on-tap", "thi-thu", "cai-dat"]) expect(r.has(k), k).toBe(true);
  });
  it("toàn bộ mã nguồn hiện tại không có link hỏng", () => {
    expect(runCheck(new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"))).toEqual([]);
  });
});
