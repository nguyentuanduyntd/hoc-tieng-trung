// Cấu hình audio dựng sẵn bằng Azure AI Speech (SPEC 3.19, nguồn A). Đổi tên giọng ở đây là đủ:
// script dựng audio và phía client cùng đọc cấu hình này.

export type NeuralVoiceKey = "female" | "male";

export interface NeuralVoice {
  /** Thư mục con trong public/audio/. */
  dir: string;
  /** Tên giọng Azure. */
  name: string;
  label: string;
}

export const NEURAL_VOICES: Record<NeuralVoiceKey, NeuralVoice> = {
  female: { dir: "xiaoxiao", name: "zh-CN-XiaoxiaoNeural", label: "晓晓 Xiaoxiao · Nữ" },
  male: { dir: "yunxi", name: "zh-CN-YunxiNeural", label: "云希 Yunxi · Nam" },
};

/** Định dạng đầu ra (REST header X-Microsoft-OutputFormat). */
export const AUDIO_OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";

/** Câu mẫu của nút “Nghe thử”. */
export const SAMPLE_SENTENCE = "你好！欢迎你学习中文。";

/** Hạn mức miễn phí gói F0 cho giọng Neural (ký tự tính phí / tháng) — theo trang giá Azure. */
export const F0_MONTHLY_CHARS = 500_000;
/** Gói F0: tối đa 20 yêu cầu tổng hợp giọng nói mỗi 60 giây (không điều chỉnh được). */
export const F0_REQUESTS_PER_MINUTE = 20;

export const AUDIO_MANIFEST_PATH = "audio/manifest.json";
