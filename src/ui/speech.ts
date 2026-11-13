// Phát âm mẫu bằng Web Speech API (chạy hoàn toàn trên máy người dùng).

export const ttsSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Các giọng zh-CN có trên máy (giọng đầu tiên là mặc định). */
let zhVoices: SpeechSynthesisVoice[] = [];
function pickVoices() {
  const voices = speechSynthesis.getVoices();
  const cn = voices.filter((v) => /zh[-_]CN/i.test(v.lang));
  zhVoices = cn.length ? cn : voices.filter((v) => /^zh/i.test(v.lang) && !/HK|TW/i.test(v.lang));
}
if (ttsSupported()) {
  pickVoices();
  speechSynthesis.addEventListener?.("voiceschanged", pickVoices);
}

export const hasZhVoice = () => ttsSupported() && zhVoices.length > 0;
export const zhVoiceCount = () => zhVoices.length;

function utterance(text: string, rate: number, voiceIndex: number) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-CN";
  const v = zhVoices.length ? zhVoices[voiceIndex % zhVoices.length] : undefined;
  if (v) u.voice = v;
  u.rate = rate;
  return u;
}

export function speak(text: string, rate = 0.85) {
  if (!ttsSupported()) return;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance(text, rate, 0));
}

export interface SpeakHandle {
  /** Thời lượng đọc thực tế (ms); reject nếu bị hủy hoặc lỗi. */
  done: Promise<number>;
  cancel(): void;
}

/** Đọc một câu và chờ đọc xong. `voiceIndex` để phân biệt người nói trong hội thoại. */
export function speakAsync(text: string, opts: { rate?: number; voiceIndex?: number; fallbackMs?: number } = {}): SpeakHandle {
  if (!ttsSupported()) return { done: Promise.reject(new Error("no-tts")), cancel() {} };
  const u = utterance(text, opts.rate ?? 1, opts.voiceIndex ?? 0);
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
