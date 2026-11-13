// 8 nguồn miễn phí nên dùng kèm (SPEC mục 1 & 3.11). Chỉ dẫn link, không sao chép nội dung.

export interface ExternalResource {
  id: string;
  name: string;
  url: string;
  strength: string;
  whenToUse: string;
  levels: string;
  /** Ngữ cảnh gợi ý (dùng ở các giai đoạn sau). */
  contexts: ("lesson" | "reading" | "listening" | "exam" | "srs" | "dictionary")[];
}

export const RESOURCES: ExternalResource[] = [
  {
    id: "hellochinese",
    name: "HelloChinese",
    url: "https://www.hellochinese.cc",
    strength: "Lộ trình bài nhỏ, bài tập xen kẽ, nhận dạng giọng nói, streak.",
    whenToUse: "Khi muốn thêm bài luyện ngắn trên điện thoại ngoài giờ học trên web.",
    levels: "HSK 1–3",
    contexts: ["lesson"],
  },
  {
    id: "pleco",
    name: "Pleco",
    url: "https://www.pleco.com",
    strength: "Từ điển tra nhanh, viết tay/camera, thứ tự nét.",
    whenToUse: "Khi gặp chữ lạ ngoài web (biển hiệu, sách, tin nhắn).",
    levels: "Mọi cấp",
    contexts: ["dictionary"],
  },
  {
    id: "duchinese",
    name: "Du Chinese",
    url: "https://www.duchinese.net",
    strength: "Bài đọc ngắn theo cấp độ, có audio, chạm từng từ để dịch.",
    whenToUse: "Sau khi đọc hết bài đọc cùng cấp trên web, muốn đọc thêm.",
    levels: "HSK 1–6",
    contexts: ["reading"],
  },
  {
    id: "zerotohero",
    name: "Chinese Zero to Hero",
    url: "https://www.chinesezerotohero.com",
    strength: "Giảng HSK theo từng bài, hệ thống ngữ pháp rõ ràng.",
    whenToUse: "Khi một điểm ngữ pháp trong bài học còn chưa chắc, cần nghe giảng thêm.",
    levels: "HSK 1–6",
    contexts: ["lesson"],
  },
  {
    id: "mandarincorner",
    name: "Mandarin Corner",
    url: "https://www.youtube.com/@MandarinCorner2",
    strength: "Nghe chậm, nội dung thật, phụ đề pinyin.",
    whenToUse: "Sau khi xong bài nghe/shadowing trên web, muốn nghe nội dung thật.",
    levels: "HSK 2 trở lên",
    contexts: ["listening"],
  },
  {
    id: "cti",
    name: "Chinese Testing International (CTI)",
    url: "https://www.chinesetest.cn",
    strength: "Cấu trúc đề chính thức, đề mẫu kèm audio, đăng ký thi.",
    whenToUse: "Sau khi đạt ≥ 80% thi thử trên web.",
    levels: "Mọi cấp",
    contexts: ["exam"],
  },
  {
    id: "mandarinbean",
    name: "Mandarin Bean",
    url: "https://mandarinbean.com",
    strength: "Làm đề trực tuyến, chấm điểm ngay.",
    whenToUse: "Sau khi làm xong thi thử trên web, muốn luyện thêm đề.",
    levels: "HSK 1–6",
    contexts: ["exam", "reading"],
  },
  {
    id: "anki",
    name: "Anki",
    url: "https://apps.ankiweb.net",
    strength: "Lặp lại ngắt quãng (SRS) trên mọi thiết bị.",
    whenToUse: "Khi muốn ôn thẻ ngoài web — nhập file xuất từ trang Tiến độ.",
    levels: "Mọi cấp",
    contexts: ["srs"],
  },
];
