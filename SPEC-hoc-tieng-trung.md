# SPEC: Nâng cấp web học tiếng Trung (đúc kết từ 8 nguồn miễn phí)

> Tài liệu này dành cho **Claude Code**. Đọc hết trước khi code. Mục tiêu là đưa những điểm mạnh của các app/kênh miễn phí phổ biến vào web hiện có, để người học (người Việt, bắt đầu từ HSK 1) học được trọn vòng ngay trên web, còn các nguồn ngoài chỉ để bổ trợ.

---

## 0. Việc phải làm trước tiên

1. **Đọc repo hiện có**: stack, cấu trúc thư mục, cách lưu dữ liệu (localStorage / backend?), các trang đang có (đã có ít nhất: trang bài học, *Thi thử*, *xuất tiến độ*, mục *Nguồn miễn phí nên dùng kèm*).
2. **Không viết lại từ đầu.** Mở rộng trên code sẵn có, giữ nguyên style UI (dark theme, card bo góc, màu nhấn đỏ).
3. Viết một đoạn ngắn `docs/CURRENT_STATE.md` ghi lại những gì đã có, rồi đối chiếu với mục 3 bên dưới để biết phần nào **đã có / cần sửa / cần làm mới**.
4. Có chỗ nào chưa rõ (ví dụ nguồn dữ liệu, có backend hay không) thì **hỏi lại** thay vì tự đoán.

---

## 1. Đúc kết: mỗi nguồn dạy ta điều gì

| Nguồn | Điểm mạnh cốt lõi | Bài học rút ra cho web |
|---|---|---|
| **HelloChinese** | Lộ trình bài nhỏ, có thứ tự; nhiều dạng bài tập xen kẽ; nhận dạng giọng nói; gamification (streak, XP) | Lộ trình Unit → Lesson 5–10 phút, bài tập trộn nhiều dạng, chấm phát âm, streak |
| **Pleco** | Từ điển tra nhanh, viết tay/camera, thứ tự nét, flashcard | Bấm vào bất kỳ chữ nào → pop-up từ điển (pinyin, nghĩa, Hán Việt, nét viết), 1 chạm thêm vào ôn tập |
| **Du Chinese** | Bài đọc ngắn theo cấp độ, có audio, chạm từng từ để dịch, bật/tắt pinyin | Thư viện bài đọc phân cấp HSK, tách từ, bật/tắt pinyin & bản dịch, audio từng câu |
| **Chinese Zero to Hero** | Giảng HSK theo từng bài, có hệ thống ngữ pháp | Mỗi bài có mục **Ngữ pháp** rõ ràng: cấu trúc → ví dụ → bài tập |
| **Mandarin Corner** | Nghe chậm, nội dung thật, phụ đề pinyin | Chế độ nghe: chỉnh tốc độ, phát lại từng câu, *shadowing*, phụ đề 3 lớp (Hán tự / pinyin / tiếng Việt) |
| **Chinese Testing International (CTI)** | Cấu trúc đề chính thức, đề mẫu kèm audio | Thi thử mô phỏng đúng cấu trúc và thời gian; dẫn link sang đề mẫu chính thức |
| **Mandarin Bean** | Làm đề trực tuyến, chấm ngay | Chấm điểm tức thì, xem lại câu sai, câu sai tự động vào hàng ôn |
| **Anki** | Lặp lại ngắt quãng (SRS) | Hệ SRS có sẵn trên web + xuất file nhập thẳng vào Anki |

### Nguyên tắc học chung (rút ra từ cả 8 nguồn)

- **Input dễ hiểu trước, output sau**: nghe/đọc nội dung chỉ hơi khó hơn trình độ một chút.
- **Gợi nhớ chủ động + SRS**: không chỉ xem lại, phải tự nhớ ra rồi mới lật đáp án.
- **Vòng ngắn, đều đặn**: bài 5–10 phút, có mục tiêu mỗi ngày.
- **Thanh điệu là ưu tiên số 1** ở giai đoạn đầu.
- **Mọi thứ nối với nhau**: từ gặp trong bài đọc, đề thi hay bài nghe đều thêm được vào SRS bằng 1 chạm.
- **Lợi thế của người Việt**: hiển thị **âm Hán Việt** giúp nhớ chữ và nghĩa nhanh hơn rất nhiều. Đây là điểm khác biệt so với các app quốc tế.

---

## 2. Bối cảnh HSK (quan trọng, cần cấu hình được)

- **HSK 3.0** có 9 cấp (Sơ cấp 1–3, Trung cấp 4–6, Cao cấp 7–9). Theo thông tin công bố, **kỳ thi HSK 3.0 chính thức đầu tiên (HSK 1–6) dự kiến ngày 13/12/2026**, và kỳ HSK 2.0 cuối cùng trên toàn cầu là 07/11/2026.
- Số từ tích lũy theo HSK 3.0 (so với HSK 2.0): HSK1 300 (150) · HSK2 500 (300) · HSK3 1.000 (600) · HSK4 2.000 (1.200) · HSK5 3.600 (2.500) · HSK6 5.400 (5.000) · HSK7–9 11.000.
- HSK 3.0 yêu cầu **viết tay chữ Hán ngay từ các cấp đầu**, và có **thi nói từ HSK 3**.
- ⚠️ Các con số trên lấy từ nguồn tổng hợp bên thứ ba. **Phải đối chiếu với trang chính thức chinesetest.cn** trước khi chốt dữ liệu.

**Yêu cầu kỹ thuật:** tách chuẩn HSK thành config (`hskStandard: "3.0" | "2.0"`), **mặc định 3.0**. Mỗi từ lưu cấp của cả hai chuẩn nếu có. Không hard-code số từ hay cấu trúc đề trong component.

---

## 3. Tính năng cần làm (theo độ ưu tiên)

### P0 – Nền tảng

#### 3.1 Dữ liệu từ vựng & từ điển nội bộ
- Mỗi mục từ gồm: `hanzi`, `pinyin` (có dấu), `pinyinNumbered`, `hanViet`, `meaningVi`, `meaningEn?`, `hsk2Level?`, `hsk3Level?`, `examples[]`, `audio?`.
- Gợi ý nguồn dữ liệu mở (**kiểm tra giấy phép trước khi dùng** và ghi vào `docs/DATA_SOURCES.md`):
  - Danh sách từ HSK 2.0 + 3.0: repo `drkameleon/complete-hsk-vocabulary` (GitHub).
  - Từ điển gốc: CC-CEDICT (CC BY-SA, nghĩa tiếng Anh, cần dịch/biên tập sang tiếng Việt).
  - Thứ tự nét: thư viện **Hanzi Writer** (dữ liệu từ Make Me a Hanzi).
  - Âm Hán Việt: cần một bộ dữ liệu có giấy phép phù hợp. **Hỏi lại người dùng** nếu chưa tìm được.
- **Không** scrape hay sao chép nội dung của HelloChinese, Pleco, Du Chinese hay đề thi có bản quyền.

#### 3.2 Pop-up từ điển (kiểu Pleco)
- Bấm/chạm vào bất kỳ từ tiếng Trung nào trên toàn site → pop-up gồm: Hán tự lớn, pinyin, Hán Việt, nghĩa Việt, cấp HSK, nút 🔊 phát âm, hoạt ảnh thứ tự nét, nút **+ Thêm vào ôn tập**.
- Văn bản phải được **tách từ** sẵn trong dữ liệu (không tách theo từng ký tự).
- Ô tìm kiếm: nhận Hán tự, pinyin có dấu, pinyin số (`ni3hao3`), hoặc tiếng Việt.

#### 3.3 Hệ SRS (kiểu Anki)
- Thuật toán: FSRS (ưu tiên) hoặc SM-2. Đặt trong module riêng có unit test.
- Loại thẻ: Hán tự → nghĩa · Nghĩa → Hán tự · Nghe → Hán tự · Viết tay (dùng quiz mode của Hanzi Writer).
- Hàng ôn mỗi ngày: giới hạn số thẻ mới/ngày (mặc định 10), hiển thị số thẻ đến hạn trên trang chủ.
- Nút chấm: *Quên / Khó / Được / Dễ*.

#### 3.4 Xuất sang Anki
- Xuất file `.txt` phân cách bằng Tab, có header để Anki tự nhận dạng:
  ```
  #separator:Tab
  #html:true
  #deck:HocTiengTrung::HSK1
  #columns:Hanzi	Pinyin	HanViet	NghiaViet	ViDu	Tags
  #tags column:6
  你好	nǐ hǎo	nhĩ hảo	xin chào	你好，老师！	hsk1 bai1
  ```
- Có tùy chọn: chỉ xuất từ đã học / từ sai nhiều / theo cấp HSK.
- Giữ chức năng **xuất/nhập tiến độ JSON** (sao lưu) nếu đã có.

### P1 – Học có lộ trình

#### 3.5 Lộ trình bài học (kiểu HelloChinese + Zero to Hero)
- Cấu trúc: `Cấp HSK → Unit → Lesson`. Mỗi lesson 5–10 phút, mở khóa tuần tự nhưng cho phép "thi vượt".
- Mỗi lesson gồm: **Từ mới** (5–8 từ) → **Ngữ pháp** (1 điểm: cấu trúc, 3 ví dụ, giải thích tiếng Việt) → **Bài tập trộn** → **Tổng kết** (từ mới tự vào SRS).
- Dạng bài tập (tối thiểu): chọn nghĩa, chọn Hán tự theo audio, ghép cặp, sắp xếp từ thành câu, điền từ, chọn thanh điệu, viết chữ theo nét, nói theo câu mẫu.

#### 3.6 Luyện phát âm & thanh điệu
- Phát âm mẫu: Web Speech API `speechSynthesis` giọng `zh-CN` (fallback: file audio nếu có).
- Chấm nói: `SpeechRecognition` `lang="zh-CN"` → so sánh với câu đích, tô màu chữ đúng/sai. **Chỉ chạy trên một số trình duyệt** (chủ yếu Chrome/Edge), nên phải phát hiện hỗ trợ và có fallback: ghi âm (`MediaRecorder`) → nghe lại song song với mẫu → tự chấm.
- Bài luyện thanh điệu: nghe → chọn thanh (1–4, nhẹ); luyện **cặp thanh** (vd 2-3, 3-3 biến điệu); có trang giải thích quy tắc biến điệu của 不 và 一.

#### 3.7 Thư viện bài đọc phân cấp (kiểu Du Chinese)
- Bài đọc ngắn (80–300 chữ) gắn cấp HSK, chỉ dùng từ trong cấp đó + ≤ 5% từ mới.
- Thanh công cụ: bật/tắt pinyin (trên chữ, dùng `<ruby>`), bật/tắt dịch từng câu, phát audio từng câu hoặc cả bài, tô màu từ *đã thuộc / đang học / mới*.
- Cuối bài: 3–5 câu hỏi đọc hiểu.
- Nội dung bài đọc do dự án tự soạn (có thể nhờ AI soạn rồi người duyệt), lưu dạng JSON/Markdown đã tách từ.

#### 3.8 Chế độ nghe & shadowing (kiểu Mandarin Corner)
- Áp dụng cho bài đọc và hội thoại: chỉnh tốc độ 0.5x–1.25x, lặp từng câu, nút "câu trước / câu sau".
- **Shadowing**: phát câu → tạm dừng bằng độ dài câu → người học nói theo (tùy chọn ghi âm).
- Phụ đề 3 lớp bật/tắt độc lập: Hán tự / pinyin / tiếng Việt.
- Video YouTube bên ngoài: chỉ **nhúng iframe chính thức hoặc dẫn link**, không tải về.

### P1 – Thi thử

#### 3.9 Thi thử HSK (kiểu CTI + Mandarin Bean)
- Engine đề thi đọc cấu trúc từ config theo chuẩn và cấp (phần, số câu, thời gian, dạng câu). Lấy cấu trúc HSK 3.0 từ trang CTI rồi điền vào config.
- Có: đồng hồ đếm ngược, audio phần nghe chỉ phát theo luật của đề, nộp bài → **chấm ngay**, điểm từng phần, xem lại câu sai kèm giải thích.
- **Câu sai tự động đưa từ liên quan vào SRS.**
- Câu hỏi do dự án tự soạn. Sau khi làm xong, hiện nút dẫn sang đề mẫu chính thức trên CTI và Mandarin Bean.

### P2 – Động lực & tiện ích

#### 3.10 Dashboard tiến độ
- Streak, số phút học hôm nay, mục tiêu ngày, số từ đã thuộc theo cấp HSK (thanh tiến độ so với tổng số từ của cấp), lịch sử điểm thi thử.
- Gợi ý "hôm nay nên làm gì": ôn SRS đến hạn → bài học tiếp theo → 1 bài đọc.

#### 3.11 Mục "Nguồn miễn phí nên dùng kèm" (đã có, nâng cấp)
- Giữ 8 card hiện tại. Thêm vào mỗi card: nhãn **"Dùng khi nào"** (vd Pleco: *khi gặp chữ lạ ngoài web*; CTI: *sau khi đạt ≥ 80% thi thử*) và cấp độ phù hợp.
- Hiển thị gợi ý theo ngữ cảnh: xong bài thi thử → gợi ý CTI/Mandarin Bean; xong bài nghe → gợi ý Mandarin Corner.

---

## 4. Mô hình dữ liệu gợi ý (TypeScript)

```ts
type HskStandard = "2.0" | "3.0";

interface Word {
  id: string; hanzi: string; pinyin: string; pinyinNumbered: string;
  hanViet?: string; meaningVi: string; meaningEn?: string;
  hsk2Level?: number; hsk3Level?: number;
  examples: { zh: string; pinyin: string; vi: string }[];
  audioUrl?: string;
}

interface Lesson {
  id: string; hskLevel: number; unit: number; order: number; title: string;
  newWordIds: string[];
  grammar?: { pattern: string; explanationVi: string; examples: Word["examples"] };
  exercises: Exercise[];
}

type ExerciseType = "choose-meaning" | "listen-choose-hanzi" | "match-pairs"
  | "order-words" | "fill-blank" | "choose-tone" | "write-stroke" | "speak";

interface Exercise { id: string; type: ExerciseType; prompt: unknown; answer: unknown }

interface Reading {
  id: string; hskLevel: number; title: string;
  sentences: { tokens: { text: string; wordId?: string }[]; vi: string; audioUrl?: string }[];
  questions: Exercise[];
}

interface SrsCard {
  id: string; wordId: string; cardType: "zh-vi" | "vi-zh" | "audio-zh" | "write";
  due: string; stability: number; difficulty: number; reps: number; lapses: number; lastReview?: string;
}

interface UserProgress {
  hskStandard: HskStandard; dailyGoalMinutes: number; newCardsPerDay: number;
  streak: number; lastActiveDate: string;
  completedLessonIds: string[]; cards: SrsCard[];
  examAttempts: { examId: string; date: string; score: number; sectionScores: Record<string, number> }[];
}
```

Nếu web hiện chỉ có frontend: lưu `UserProgress` vào localStorage (bọc try/catch) + xuất/nhập JSON. Không thêm backend khi chưa được yêu cầu.

---

## 5. Kế hoạch triển khai theo giai đoạn

Mỗi giai đoạn kết thúc bằng: chạy được, có test cho logic, cập nhật `CHANGELOG.md`, rồi **dừng lại báo cáo** trước khi sang giai đoạn sau.

| Giai đoạn | Nội dung | Hoàn thành khi |
|---|---|---|
| **1** | Mục 0 + dữ liệu từ HSK 1 (3.1) + config chuẩn HSK | Có `CURRENT_STATE.md`, `DATA_SOURCES.md`; dữ liệu HSK1 load được và đã kiểm tra hợp lệ |
| **2** | Pop-up từ điển (3.2) + SRS (3.3) + xuất Anki (3.4) | Bấm từ bất kỳ → pop-up; ôn thẻ chạy đúng lịch; file xuất nhập được vào Anki không lỗi |
| **3** | Lộ trình bài học HSK 1 (3.5) + phát âm (3.6) | Học hết ít nhất 1 unit HSK 1 đầu-cuối; chấm nói có fallback khi trình duyệt không hỗ trợ |
| **4** | Bài đọc (3.7) + nghe/shadowing (3.8) | ≥ 5 bài đọc HSK 1, đủ công cụ pinyin/dịch/audio/tốc độ |
| **5** | Thi thử theo config (3.9) | 1 đề HSK 1 chuẩn 3.0 hoàn chỉnh, chấm điểm, câu sai vào SRS |
| **6** | Dashboard (3.10) + nâng cấp mục nguồn (3.11) | Trang chủ hiện việc cần làm hôm nay, streak, tiến độ theo cấp |

---

## 6. Yêu cầu chung

- Giao diện tiếng Việt; font hiển thị chữ Hán rõ (vd `Noto Sans SC`), cỡ chữ Hán ≥ 1.25 lần chữ Latin.
- Responsive, dùng tốt trên điện thoại (người học hay ôn trên mobile).
- Truy cập tốt: điều khiển bằng bàn phím được (phím số để chọn đáp án, Space để lật thẻ / phát audio).
- Không có tracking hay gửi dữ liệu người học ra ngoài.
- Test: unit test cho SRS, chấm điểm thi, tách/khớp pinyin, xuất Anki.

---

## 7. Prompt khởi động (dán vào Claude Code)

```
Đọc file SPEC-hoc-tieng-trung.md ở thư mục gốc. Bắt đầu với Mục 0: khảo sát repo,
viết docs/CURRENT_STATE.md và đối chiếu với Mục 3 (đã có / cần sửa / cần làm mới).
Sau đó làm Giai đoạn 1 trong Mục 5. Dừng lại báo cáo khi xong giai đoạn 1.
Chỗ nào chưa rõ (nguồn dữ liệu Hán Việt, có backend hay không...) thì hỏi tôi trước.
```
