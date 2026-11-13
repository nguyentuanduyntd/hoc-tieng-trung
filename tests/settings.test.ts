import { describe, expect, it } from "vitest";
import { SETTINGS_KEY, clampRate, defaultSettings, loadSettings, sanitizeSettings, saveSettings } from "../src/lib/settings.ts";

describe("cài đặt thiết bị", () => {
  it("mặc định: tối, chữ bình thường, tốc độ 0.85, ẩn phương ngữ", () => {
    expect(defaultSettings()).toEqual({ rate: 0.85, theme: "dark", zhSize: "normal", showDialects: false });
  });
  it("giới hạn tốc độ 0.5–1.5, làm tròn 2 chữ số", () => {
    expect(clampRate(0.2)).toBe(0.5);
    expect(clampRate(3)).toBe(1.5);
    expect(clampRate("0.876")).toBe(0.88);
    expect(clampRate("abc")).toBe(0.85);
  });
  it("loại giá trị sai", () => {
    expect(sanitizeSettings({ theme: "blue", zhSize: "huge", rate: 9, voiceURI: "" })).toEqual({ rate: 1.5, theme: "dark", zhSize: "normal", showDialects: false });
    expect(sanitizeSettings({ theme: "light", zhSize: "xlarge", voiceURI: "v1" })).toEqual({ voiceURI: "v1", rate: 0.85, theme: "light", zhSize: "xlarge", showDialects: false });
  });
  it("migration: cài đặt v0.7 (chưa có showDialects) đọc được, mặc định ẩn phương ngữ", () => {
    expect(sanitizeSettings({ rate: 1, theme: "light", zhSize: "large", voiceURI: "v" }).showDialects).toBe(false);
    expect(sanitizeSettings({ showDialects: true }).showDialects).toBe(true);
  });
  it("lưu rồi đọc lại; storage lỗi không làm hỏng", () => {
    const m = new Map<string, string>();
    const st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    const s = { ...defaultSettings(), theme: "light" as const, rate: 1 };
    expect(saveSettings(s, st)).toBe(true);
    expect(m.has(SETTINGS_KEY)).toBe(true);
    expect(loadSettings(st)).toEqual(s);
    expect(loadSettings({ getItem: () => "{x" })).toEqual(defaultSettings());
    expect(saveSettings(s, { setItem: () => { throw new Error("quota"); } })).toBe(false);
  });
});
