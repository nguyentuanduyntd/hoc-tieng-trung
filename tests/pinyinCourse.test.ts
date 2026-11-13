import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PINYIN_PASS, buildPinyinQuiz, isCorrect, lessonDone, marked, nextPinyinLesson, recordPinyinLesson } from "../src/lib/pinyinCourse.ts";
import { sanitizeProgress } from "../src/lib/progress.ts";
import type { PinyinCourseFile } from "../src/types.ts";

const course: PinyinCourseFile = JSON.parse(readFileSync(new URL("../public/data/pinyin-course.json", import.meta.url), "utf8"));
const raw: { simplified: string; forms: { transcriptions: { numeric: string } }[] }[] = JSON.parse(
  readFileSync(new URL("../data/raw/complete-hsk-vocabulary/complete.json", import.meta.url), "utf8"),
);

describe("nội dung", () => {
  it("9 bài theo thứ tự: thanh điệu → thanh mẫu → vận mẫu → biến điệu → quy tắc viết", () => {
    expect(course.lessons.map((l) => l.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const titles = course.lessons.map((l) => l.title).join(" | ");
    for (const k of ["thanh điệu", "Thanh mẫu", "Vận mẫu", "Biến điệu", "Quy tắc viết"]) expect(titles).toContain(k);
  });
  it("đủ 21 thanh mẫu", () => {
    const syms = new Set(course.lessons.flatMap((l) => l.groups.flatMap((g) => g.items.map((i) => i.py))));
    for (const s of "b p m f d t n l g k h j q x zh ch sh r z c s".split(" ")) expect(syms.has(s), s).toBe(true);
  });
  it("mỗi bài có bài nghe-chọn (≥ 4 nhóm) hoặc bài chọn cách viết (≥ 5 câu)", () => {
    for (const l of course.lessons) expect(l.drills.length >= 4 || (l.spelling?.length ?? 0) >= 5, l.id).toBe(true);
  });
  it("mọi âm tiết dùng đều có chữ phát âm; chữ đó đọc đúng âm tiết ấy trong dữ liệu", () => {
    const readings = new Map<string, Set<string>>();
    for (const e of raw) {
      const chars = [...e.simplified];
      for (const f of e.forms) {
        const syl = f.transcriptions.numeric.toLowerCase().replace(/u:|ü/g, "v").split(/\s+/);
        if (syl.length === chars.length) chars.forEach((c, i) => readings.set(c, (readings.get(c) ?? new Set()).add(syl[i])));
      }
    }
    for (const l of course.lessons) {
      const all = [...l.drills.flat(), ...l.groups.flatMap((g) => g.items.flatMap((i) => i.examples))];
      for (const s of all) {
        const ch = course.sounds[s];
        expect(ch, `${l.id} ${s}`).toBeTruthy();
        const r = readings.get(ch);
        if (r) expect([...r], `${ch} phải đọc được ${s}`).toContain(s);
      }
    }
  });
  it("câu chọn cách viết: đáp án hợp lệ, phương án khác nhau", () => {
    for (const l of course.lessons)
      for (const q of l.spelling ?? []) {
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
        expect(new Set(q.options).size).toBe(q.options.length);
      }
  });
  it("pinyin hiển thị có dấu, ü đúng", () => {
    expect(marked("ma3")).toBe("mǎ");
    expect(marked("lv4")).toBe("lǜ");
    expect(marked("xue2")).toBe("xué");
  });
});

describe("bài luyện", () => {
  it("nghe-chọn: phương án là cả nhóm âm dễ nhầm, đáp án trong nhóm, không lặp âm đích", () => {
    const l = course.lessons.find((x) => x.id === "py2")!;
    const qs = buildPinyinQuiz(course, l, 8, 42);
    expect(qs).toHaveLength(8);
    const targets = qs.map((q) => (q.kind === "listen" ? q.answer : ""));
    expect(new Set(targets).size).toBe(targets.length);
    for (const q of qs) {
      if (q.kind !== "listen") continue;
      expect(l.drills.some((d) => d.length === q.options.length && d.every((s) => q.options.includes(s)))).toBe(true);
      expect(q.options).toContain(q.answer);
      expect(q.char).toBe(course.sounds[q.answer]);
      expect(isCorrect(q, q.answer)).toBe(true);
    }
  });
  it("bài chỉ có câu chọn cách viết (biến điệu) vẫn tạo được đề", () => {
    const l = course.lessons.find((x) => x.id === "py8")!;
    const qs = buildPinyinQuiz(course, l, 8, 1);
    expect(qs.length).toBe(l.spelling!.length);
    expect(qs.every((q) => q.kind === "spell")).toBe(true);
  });
  it("cùng hạt giống -> cùng đề", () => {
    const l = course.lessons[0];
    expect(buildPinyinQuiz(course, l, 8, 9)).toEqual(buildPinyinQuiz(course, l, 8, 9));
  });
});

describe("tiến độ", () => {
  it("xong bài khi ≥ 80%, giữ điểm tốt nhất, gợi ý bài tiếp theo", () => {
    let pc = recordPinyinLesson({ pinyinCourse: {} }, "py1", 0.75, "2026-11-13");
    expect(lessonDone({ pinyinCourse: pc }, "py1")).toBe(false);
    pc = recordPinyinLesson({ pinyinCourse: pc }, "py1", PINYIN_PASS, "2026-11-14");
    pc = recordPinyinLesson({ pinyinCourse: pc }, "py1", 0.5, "2026-11-15");
    expect(pc.py1).toEqual({ best: 0.8, date: "2026-11-14" });
    expect(nextPinyinLesson(course, { pinyinCourse: pc })?.id).toBe("py2");
    const all = Object.fromEntries(course.lessons.map((l) => [l.id, { best: 1, date: "x" }]));
    expect(nextPinyinLesson(course, { pinyinCourse: all })).toBeUndefined();
  });
  it("migration: tiến độ cũ không có `pinyinCourse` -> rỗng", () => {
    expect(sanitizeProgress({}).pinyinCourse).toEqual({});
    expect(sanitizeProgress({ pinyinCourse: { py1: { best: 1, date: "2026-11-13" }, py2: { best: 5, date: "x" } } }).pinyinCourse).toEqual({
      py1: { best: 1, date: "2026-11-13" },
    });
  });
});
