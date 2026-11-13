// Nói & chấm: SpeechRecognition (chủ yếu Chrome/Edge) hoặc fallback ghi âm bằng MediaRecorder.
// Lưu ý quyền riêng tư: Chrome/Edge gửi âm thanh tới máy chủ nhận dạng của nhà cung cấp trình duyệt,
// nên chỉ bật khi người học đồng ý (UserProgress.speechRecognitionConsent). Bản ghi âm fallback chỉ
// nằm trong bộ nhớ trình duyệt, không tải lên đâu.

type RecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

function recognitionCtor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const recognitionSupported = () => typeof window !== "undefined" && !!recognitionCtor();
export const recorderSupported = () =>
  typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

export interface RecognizeHandle {
  /** Danh sách phương án nhận dạng (tốt nhất trước). */
  result: Promise<string[]>;
  stop(): void;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Trình duyệt chưa cho phép dùng micro.",
  "service-not-allowed": "Trình duyệt không cho dùng dịch vụ nhận dạng giọng nói.",
  "no-speech": "Không nghe thấy tiếng nói — thử lại gần micro hơn.",
  network: "Không kết nối được dịch vụ nhận dạng (cần mạng).",
  "audio-capture": "Không tìm thấy micro.",
  aborted: "Đã dừng.",
};

export function recognizeOnce(timeoutMs = 8000): RecognizeHandle {
  const Ctor = recognitionCtor();
  if (!Ctor) return { result: Promise.reject(new Error("Trình duyệt không hỗ trợ nhận dạng giọng nói.")), stop() {} };
  const rec = new Ctor();
  rec.lang = "zh-CN";
  rec.interimResults = false;
  rec.maxAlternatives = 5;
  rec.continuous = false;
  let timer: number | undefined;
  const result = new Promise<string[]>((resolve, reject) => {
    let got: string[] | null = null;
    rec.onresult = (e) => {
      const alts = e.results[0];
      got = Array.from({ length: alts.length }, (_, i) => alts[i].transcript);
    };
    rec.onerror = (e) => reject(new Error(ERRORS[e.error] ?? `Lỗi nhận dạng: ${e.error}`));
    rec.onend = () => {
      window.clearTimeout(timer);
      if (got) resolve(got);
      else reject(new Error(ERRORS["no-speech"]));
    };
    try {
      rec.start();
    } catch (err) {
      reject(err as Error);
    }
    timer = window.setTimeout(() => rec.stop(), timeoutMs);
  });
  return { result, stop: () => rec.stop() };
}

export interface Recording {
  url: string;
  durationMs: number;
}

export interface RecorderHandle {
  result: Promise<Recording>;
  stop(): void;
}

/** Ghi âm tối đa `maxMs`; bản ghi chỉ là blob URL cục bộ. */
export function recordOnce(maxMs = 8000): RecorderHandle {
  let stopFn = () => {};
  const result = (async () => {
    if (!recorderSupported()) throw new Error("Trình duyệt không hỗ trợ ghi âm.");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      throw new Error("Không mở được micro (chưa cấp quyền?).");
    }
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    const started = performance.now();
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise<Recording>((resolve) => {
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        resolve({ url: URL.createObjectURL(new Blob(chunks, { type: rec.mimeType })), durationMs: performance.now() - started });
      };
    });
    stopFn = () => rec.state !== "inactive" && rec.stop();
    rec.start();
    window.setTimeout(stopFn, maxMs);
    return done;
  })();
  return { result, stop: () => stopFn() };
}
