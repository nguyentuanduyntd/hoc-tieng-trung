// Cài đặt theo thiết bị (giọng đọc, tốc độ, giao diện, cỡ chữ Hán). Giọng đọc phụ thuộc máy,
// nên lưu riêng ở localStorage của trình duyệt — không nằm trong file tiến độ xuất/nhập.

export type Theme = "dark" | "light";
export type ZhSize = "normal" | "large" | "xlarge";

export interface DeviceSettings {
  /** voiceURI của giọng đã chọn; undefined = "Tự động" (giọng hạng cao nhất, xem src/lib/voices.ts). */
  voiceURI?: string;
  /** Tốc độ đọc chuẩn (1x của trình đọc = tốc độ này). */
  rate: number;
  theme: Theme;
  zhSize: ZhSize;
  /** Hiện cả giọng Quảng Đông & phương ngữ trong danh sách (mặc định ẩn). */
  showDialects: boolean;
}

export const SETTINGS_KEY = "htt.settings.v1";
export const RATE_MIN = 0.5;
export const RATE_MAX = 1.5;

export const ZH_SCALE: Record<ZhSize, number> = { normal: 1, large: 1.2, xlarge: 1.45 };
export const ZH_SIZE_LABELS: Record<ZhSize, string> = { normal: "Bình thường", large: "Lớn", xlarge: "Rất lớn" };

export const defaultSettings = (): DeviceSettings => ({ rate: 0.85, theme: "dark", zhSize: "normal", showDialects: false });

export function clampRate(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return defaultSettings().rate;
  return Math.round(Math.min(RATE_MAX, Math.max(RATE_MIN, n)) * 100) / 100;
}

export function sanitizeSettings(input: unknown): DeviceSettings {
  const d = defaultSettings();
  if (!input || typeof input !== "object") return d;
  const o = input as Record<string, unknown>;
  return {
    ...(typeof o.voiceURI === "string" && o.voiceURI ? { voiceURI: o.voiceURI } : {}),
    rate: o.rate === undefined ? d.rate : clampRate(o.rate),
    theme: o.theme === "light" || o.theme === "dark" ? o.theme : d.theme,
    zhSize: o.zhSize === "large" || o.zhSize === "xlarge" || o.zhSize === "normal" ? o.zhSize : d.zhSize,
    // migration: cài đặt v0.7 chưa có trường này -> mặc định ẩn phương ngữ
    showDialects: o.showDialects === true,
  };
}

export function loadSettings(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): DeviceSettings {
  try {
    const raw = storage?.getItem(SETTINGS_KEY);
    return raw ? sanitizeSettings(JSON.parse(raw)) : defaultSettings();
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(s: DeviceSettings, storage: Pick<Storage, "setItem"> | undefined = safeStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(SETTINGS_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage !== "undefined" ? localStorage : undefined;
  } catch {
    return undefined;
  }
}
