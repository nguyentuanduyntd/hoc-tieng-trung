// Module phát âm DÙNG CHUNG toàn site (SPEC 3.19): mọi chỗ phát âm gọi speak / speakAsync ở đây,
// không gọi speechSynthesis rải rác. Giọng: "Tự động" = giọng hạng cao nhất (src/lib/voices.ts),
// hoặc giọng đã chọn trong Cài đặt. Câu dài được chia nhỏ; giọng online lỗi -> tự đọc lại bằng giọng trên máy.

import { partnerVoice, rankVoices, resolvePrimary, splitForTts, voiceForGender, type Gender, type VoiceInfo } from "../lib/voices.ts";
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

/** Đã nhận được danh sách giọng từ trình duyệt chưa. */
export const voicesLoaded = () => allVoices.length > 0;

/** Giọng tiếng Trung dùng được, đã lọc & xếp hạng theo cài đặt hiện tại. */
export function rankedVoices(): VoiceInfo<SpeechSynthesisVoice>[] {
  return rankVoices(allVoices, { showDialects: state.settings.showDialects });
}

export function primaryVoice(): VoiceInfo<SpeechSynthesisVoice> | undefined {
  return resolvePrimary(rankedVoices(), state.settings.voiceURI);
}

/** Giọng đã lưu không còn trên trình duyệt này (đổi máy / đổi trình duyệt / tắt phương ngữ). */
export function savedVoiceMissing(): boolean {
  const uri = state.settings.voiceURI;
  return !!uri && voicesLoaded() && !rankedVoices().some((x) => x.voice.voiceURI === uri);
}

export const hasZhVoice = () => ttsSupported() && rankedVoices().length > 0;
/** Tốc độ đọc chuẩn theo Cài đặt. */
export const baseRate = () => state.settings.rate;

export interface VoicePick {
  /** "partner" = người nói thứ hai trong hội thoại (giọng khác giới). */
  role?: "primary" | "partner";
  /** Giới tính người nói (hội thoại đề thi 男/女). */
  gender?: Gender;
}

function pickVoice(p: VoicePick = {}): SpeechSynthesisVoice | undefined {
  const ranked = rankedVoices();
  const primary = resolvePrimary(ranked, state.settings.voiceURI);
  if (p.gender) return voiceForGender(ranked, primary, p.gender)?.voice;
  if (p.role === "partner") return (partnerVoice(ranked, primary) ?? primary)?.voice;
  return primary?.voice;
}

/** Giọng trên máy tốt nhất (dự phòng khi giọng online lỗi / mất mạng). */
function offlineFallback(): SpeechSynthesisVoice | undefined {
  return rankedVoices().find((x) => !x.online)?.voice;
}

function makeUtterance(text: string, rate: number, voice: SpeechSynthesisVoice | undefined) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice?.lang ?? "zh-CN";
  if (voice) u.voice = voice;
  u.rate = rate;
  return u;
}

export interface SpeakHandle {
  /** Thời lượng đọc thực tế (ms); reject nếu bị hủy hoặc lỗi. */
  done: Promise<number>;
  cancel(): void;
}

/**
 * Đọc một đoạn và chờ đọc xong. Câu dài được chia theo dấu câu và đọc nối tiếp.
 * Giọng online lỗi (mất mạng…) -> đọc lại đoạn đó bằng giọng trên máy.
 */
export function speakAsync(text: string, opts: VoicePick & { rate?: number; fallbackMs?: number } = {}): SpeakHandle {
  if (!ttsSupported()) return { done: Promise.reject(new Error("no-tts")), cancel() {} };
  const rate = opts.rate ?? baseRate();
  const voice = pickVoice(opts);
  const chunks = splitForTts(text);
  let cancelled = false;
  let timer: number | undefined;
  speechSynthesis.cancel();

  const sayChunk = (chunk: string, v: SpeechSynthesisVoice | undefined, retried: boolean): Promise<void> =>
    new Promise((resolve, reject) => {
      const u = makeUtterance(chunk, rate, v);
      u.onend = () => (cancelled ? reject(new Error("cancelled")) : resolve());
      u.onerror = (e) => {
        if (cancelled || e.error === "interrupted" || e.error === "canceled") return reject(new Error("cancelled"));
        const fb = offlineFallback();
        if (!retried && fb && fb !== v) sayChunk(chunk, fb, true).then(resolve, reject);
        else reject(new Error(e.error));
      };
      speechSynthesis.speak(u);
    });

  const done = (async () => {
    const start = performance.now();
    const work = (async () => {
      for (const c of chunks) {
        if (cancelled) throw new Error("cancelled");
        await sayChunk(c, voice, false);
      }
    })();
    // một số trình duyệt không bắn onend -> tự kết thúc sau thời gian ước lượng × 3
    const guard = opts.fallbackMs
      ? new Promise<void>((resolve) => {
          timer = window.setTimeout(resolve, opts.fallbackMs! * 3);
        })
      : null;
    await (guard ? Promise.race([work, guard]) : work);
    window.clearTimeout(timer);
    if (cancelled) throw new Error("cancelled");
    return guard && performance.now() - start >= opts.fallbackMs! * 3 ? opts.fallbackMs! : performance.now() - start;
  })();
  done.catch(() => {});
  return {
    done,
    cancel() {
      cancelled = true;
      window.clearTimeout(timer);
      speechSynthesis.cancel();
    },
  };
}

/** Đọc ngay (hủy câu đang đọc). `rate` mặc định = tốc độ trong Cài đặt. */
export function speak(text: string, rate = baseRate(), pick: VoicePick = {}) {
  if (!ttsSupported()) return;
  speakAsync(text, { rate, ...pick });
}

/** Đọc chậm hơn tốc độ chuẩn (nút 🐢). */
export const speakSlow = (text: string) => speak(text, Math.max(0.3, baseRate() * 0.65));

/** Đọc thử bằng một giọng cụ thể (trang Cài đặt). */
export function speakWithVoice(text: string, voiceURI: string | undefined, rate = baseRate()) {
  if (!ttsSupported()) return;
  const ranked = rankedVoices();
  const v = (voiceURI && ranked.find((x) => x.voice.voiceURI === voiceURI)) || resolvePrimary(ranked);
  speechSynthesis.cancel();
  for (const c of splitForTts(text)) speechSynthesis.speak(makeUtterance(c, rate, v?.voice));
}

export function stopSpeaking() {
  if (ttsSupported()) speechSynthesis.cancel();
}
