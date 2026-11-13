// Phát âm mẫu bằng Web Speech API (chạy hoàn toàn trên máy người dùng).
// Giọng và tốc độ chuẩn lấy từ Cài đặt (state.settings).

import { orderVoices } from "../lib/settings.ts";
import { state } from "../state.ts";

export const ttsSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

let allVoices: SpeechSynthesisVoice[] = [];
const listeners = new Set<() => void>();

function refreshVoices() {
  allVoices = speechSynthesis.getVoices();
  // duyệt trên bản sao: listener có thể tự hủy/đăng ký lại (Set.forEach sẽ duyệt cả phần tử mới thêm -> lặp vô hạn)
  [...listeners].forEach((fn) => fn());
}
if (ttsSupported()) {
  refreshVoices();
  speechSynthesis.addEventListener?.("voiceschanged", refreshVoices);
}

/** Báo khi danh sách giọng thay đổi (trình duyệt nạp giọng không đồng bộ). */
export function onVoicesChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Các giọng tiếng Trung, giọng đã chọn trong Cài đặt đứng đầu. */
export function zhVoices(): SpeechSynthesisVoice[] {
  return orderVoices(allVoices, state.settings.voiceURI);
}

export const hasZhVoice = () => ttsSupported() && zhVoices().length > 0;
export const zhVoiceCount = () => zhVoices().length;
/** Tốc độ đọc chuẩn theo Cài đặt. */
export const baseRate = () => state.settings.rate;

function utterance(text: string, rate: number, voiceIndex: number) {
  const u = new SpeechSynthesisUtterance(text);
  const vs = zhVoices();
  const v = vs.length ? vs[voiceIndex % vs.length] : undefined;
  u.lang = v?.lang ?? "zh-CN";
  if (v) u.voice = v;
  u.rate = rate;
  return u;
}

/** Đọc ngay (hủy câu đang đọc). `rate` mặc định = tốc độ trong Cài đặt. */
export function speak(text: string, rate = baseRate()) {
  if (!ttsSupported()) return;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance(text, rate, 0));
}

/** Đọc chậm hơn tốc độ chuẩn (nút 🐢). */
export const speakSlow = (text: string) => speak(text, Math.max(0.3, baseRate() * 0.65));

export interface SpeakHandle {
  /** Thời lượng đọc thực tế (ms); reject nếu bị hủy hoặc lỗi. */
  done: Promise<number>;
  cancel(): void;
}

/**
 * Đọc một câu và chờ đọc xong. `rate` mặc định = tốc độ chuẩn; `voiceIndex` 0 = giọng đã chọn,
 * 1, 2… = các giọng tiếng Trung khác (phân biệt người nói trong hội thoại).
 */
export function speakAsync(text: string, opts: { rate?: number; voiceIndex?: number; fallbackMs?: number } = {}): SpeakHandle {
  if (!ttsSupported()) return { done: Promise.reject(new Error("no-tts")), cancel() {} };
  const u = utterance(text, opts.rate ?? baseRate(), opts.voiceIndex ?? 0);
  let cancelled = false;
  let timer: number | undefined;
  const done = new Promise<number>((resolve, reject) => {
    let start = performance.now();
    u.onstart = () => (start = performance.now());
    u.onend = () => {
      window.clearTimeout(timer);
      cancelled ? reject(new Error("cancelled")) : resolve(performance.now() - start);
    };
    u.onerror = (e) => {
      window.clearTimeout(timer);
      reject(new Error(e.error));
    };
    // một số trình duyệt không bắn onend -> tự kết thúc sau thời gian ước lượng × 3
    if (opts.fallbackMs) timer = window.setTimeout(() => resolve(opts.fallbackMs!), opts.fallbackMs * 3);
  });
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  return {
    done,
    cancel() {
      cancelled = true;
      window.clearTimeout(timer);
      speechSynthesis.cancel();
    },
  };
}

export function stopSpeaking() {
  if (ttsSupported()) speechSynthesis.cancel();
}
