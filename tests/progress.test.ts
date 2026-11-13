import { describe, expect, it } from "vitest";
import {
  STORAGE_KEY,
  defaultProgress,
  exportProgressJson,
  importProgressJson,
  loadProgress,
  markActive,
  saveProgress,
  sanitizeProgress,
} from "../src/lib/progress.ts";

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

describe("tiến độ", () => {
  it("mặc định chuẩn 3.0, 10 thẻ mới/ngày", () => {
    const p = defaultProgress();
    expect(p.hskStandard).toBe("3.0");
    expect(p.newCardsPerDay).toBe(10);
  });

  it("lưu rồi đọc lại", () => {
    const s = memoryStorage();
    const p = { ...defaultProgress(), streak: 4, bestStreak: 4, hskStandard: "2.0" as const };
    expect(saveProgress(p, s)).toBe(true);
    expect(loadProgress(s)).toEqual(p);
  });

  it("storage hỏng hoặc ném lỗi -> mặc định, không crash", () => {
    expect(loadProgress({ getItem: () => "{oops" })).toEqual(defaultProgress());
    expect(loadProgress({ getItem: () => { throw new Error("blocked"); } })).toEqual(defaultProgress());
    expect(saveProgress(defaultProgress(), { setItem: () => { throw new Error("quota"); } })).toBe(false);
    expect(saveProgress(defaultProgress(), undefined)).toBe(false);
  });

  it("sanitize loại bỏ giá trị sai kiểu", () => {
    const p = sanitizeProgress({ hskStandard: "4.0", streak: -3, completedLessonIds: ["a", 1], cards: [null, { wordId: "x" }, { id: "x::zh-vi", wordId: "x", cardType: "zh-vi", due: "2026-11-13T00:00:00Z", stability: 0, difficulty: 0, reps: 0, lapses: 0 }] });
    expect(p.hskStandard).toBe("3.0");
    expect(p.streak).toBe(0);
    expect(p.completedLessonIds).toEqual(["a"]);
    expect(p.cards).toHaveLength(1);
  });

  it("xuất/nhập JSON giữ nguyên dữ liệu", () => {
    const p = { ...defaultProgress(), completedLessonIds: ["hsk1-u1-l1"] };
    expect(importProgressJson(exportProgressJson(p))).toEqual(p);
    expect(importProgressJson(JSON.stringify(p))).toEqual(p);
    expect(() => importProgressJson("không phải json")).toThrow();
  });

  it("dùng khóa storage có phiên bản", () => expect(STORAGE_KEY).toMatch(/v1$/));

  it("streak: ngày liên tiếp +1, bỏ ngày thì về 1, cùng ngày giữ nguyên", () => {
    let p = markActive(defaultProgress(), "2026-11-12");
    expect(p.streak).toBe(1);
    p = markActive(p, "2026-11-13");
    expect(p.streak).toBe(2);
    expect(markActive(p, "2026-11-13")).toBe(p);
    expect(markActive(p, "2026-11-15").streak).toBe(1);
    expect(markActive({ ...p, lastActiveDate: "2026-11-30", streak: 5 }, "2026-12-01").streak).toBe(6);
  });

  it("loại thẻ không hợp lệ bị bỏ, mặc định 2 loại", () => {
    expect(defaultProgress().srsCardTypes).toEqual(["zh-vi", "vi-zh"]);
    expect(sanitizeProgress({ srsCardTypes: ["write", "x", "write"] }).srsCardTypes).toEqual(["write"]);
  });
});
