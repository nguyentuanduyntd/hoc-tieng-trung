// Cài đặt theo thiết bị (giọng đọc, tốc độ, giao diện, cỡ chữ Hán). Giọng đọc phụ thuộc máy,
// nên lưu riêng ở localStorage của trình duyệt — không nằm trong file tiến độ xuất/nhập.

export type Theme = "dark" | "light";
export type ZhSize = "normal" | "large" | "xlarge";

export interface DeviceSettings {
  /** voiceURI của giọng đã chọn; undefined = tự chọn giọng zh-CN đầu tiên. */
  voiceURI?: string;
  /** Tốc độ đọc chuẩn (1x của trình đọc = tốc độ này). */
  rate: number;
  theme: Theme;
  zhSize: ZhSize;
}

export const SETTINGS_KEY = "htt.settings.v1";
export const RATE_MIN = 0.5;
export const RATE_MAX = 1.5;

export const ZH_SCALE: Record<ZhSize, number> = { normal: 1, large: 1.2, xlarge: 1.45 };
export const ZH_SIZE_LABELS: Record<ZhSize, string> = { normal: "Bình thường", large: "Lớn", xlarge: "Rất lớn" };

export const defaultSettings = (): DeviceSettings => ({ rate: 0.85, theme: "dark", zhSize: "normal" });

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

/** Sắp giọng: giọng đã chọn đứng đầu, rồi các giọng zh-CN, rồi giọng tiếng Trung khác. */
export function orderVoices<V extends { voiceURI: string; lang: string }>(voices: V[], preferredURI?: string): V[] {
  const zh = voices.filter((v) => /^zh/i.test(v.lang) || /^cmn/i.test(v.lang));
  const rank = (v: V) => (v.voiceURI === preferredURI ? 0 : /zh[-_]CN/i.test(v.lang) || /cmn/i.test(v.lang) ? 1 : 2);
  return [...zh].sort((a, b) => rank(a) - rank(b));
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage !== "undefined" ? localStorage : undefined;
  } catch {
    return undefined;
  }
}
