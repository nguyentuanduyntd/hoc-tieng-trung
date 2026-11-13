# Changelog

## [0.8.0] — 2026-11-13 — Bước A: sửa lỗi (giọng đọc, menu điện thoại, thanh phát, link)

### Sửa
- **Giọng đọc (SPEC 3.19, phần giọng trình duyệt)** — `src/lib/voices.ts` (thay `orderVoices`):
  - Mặc định chỉ giữ zh-CN chuẩn và zh-TW. Quảng Đông (zh-HK, yue) và phương ngữ (`zh-CN-liaoning`, `zh-CN-shaanxi`… — trước đây bị regex `/zh[-_]CN/` nhận nhầm là zh-CN) ẩn sau công tắc “Hiện giọng Quảng Đông / phương ngữ” kèm cảnh báo.
  - Xếp hạng: Microsoft Online (Natural) zh-CN → Huihui/Yaoyao/Kangkang → Google 普通话 → zh-CN khác → zh-TW. Thêm lựa chọn **Tự động** (mặc định) = giọng hạng cao nhất.
  - Hội thoại: người nói thứ hai dùng giọng **khác giới** tốt nhất (ưu tiên cặp 晓晓 + 云希), không bao giờ là Quảng Đông/phương ngữ; đề thi chọn giọng theo 男/女.
  - Dropdown chia `<optgroup>` (Đề xuất · Microsoft Natural (cần mạng) · Giọng cài trên máy · Phổ thông Đài Loan), tên gọn kiểu `晓晓 · Nữ · Natural · cần mạng`, nút ▶ Nghe thử (`你好！欢迎你学习中文。`), gợi ý mở bằng Edge khi không có giọng Natural.
  - Giọng đã lưu không còn (đổi máy/trình duyệt) → tự về Tự động, báo nhẹ (chờ danh sách giọng ổn định 3 giây vì Edge nạp giọng Natural muộn).
  - Module phát âm dùng chung: câu dài chia theo dấu câu; giọng online lỗi/mất mạng → đọc lại bằng giọng trên máy.
  - Test với đúng 20 giọng Edge (zh-CN, zh-TW, zh-HK, zh-CN-liaoning, zh-CN-shaanxi, local + Online Natural).
- **Menu trên điện thoại** (< 768px): thay menu cuộn ngang bằng **thanh tab dưới đáy** (Trang chủ · Bài học · Ôn tập + số thẻ đến hạn · Bài đọc · Thêm). “Thêm” mở danh sách còn lại (Từ vựng, Phát âm, Thi thử, Nguồn, Tiến độ, Cài đặt), đóng bằng Esc / bấm ra ngoài. Desktop giữ nguyên.
- **Thanh phát trình đọc trên điện thoại**: các nút xuống dòng (không còn nút Shadowing bị cắt), thanh nằm trên thanh tab, nội dung chừa đúng chiều cao thanh phát (đo bằng ResizeObserver) nên không che dòng cuối.
- Chuẩn hóa xuống dòng LF cho toàn repo + `.gitattributes` (trước đó `core.autocrlf` làm file lẫn CRLF/LF).

### Thêm
- `scripts/check-links.ts` trong `npm test`: fail nếu có `href="#"`/rỗng, route không tồn tại, hoặc link tĩnh tới bài học/bài đọc/đề thi không có trong dữ liệu.
- Cài đặt thiết bị thêm `showDialects` (migration: bản cũ chưa có → mặc định ẩn). Thông báo nhẹ (`src/ui/toast.ts`).
- Test: 215 (+18 giọng đọc, +8 link, +1 migration).

## [0.7.0] — 2026-11-13 — Trang Cài đặt

### Thêm
- **Trang Cài đặt** (`#/cai-dat`, `src/pages/settings.ts`):
  - **Giọng đọc**: chọn trong các giọng tiếng Trung có sẵn của trình duyệt/hệ điều hành (giọng zh-CN xếp trước), tốc độ 0.5–1.5, nút 🔊 Thử. Giọng & tốc độ này dùng cho mọi nút 🔊, bài học, ôn tập, bài đọc (1x = tốc độ đã chọn), thi thử; hội thoại vẫn dùng giọng khác cho người nói thứ hai. Hướng dẫn cài giọng khi máy chưa có.
  - **Giao diện**: ☀️ Sáng / 🌙 Tối (bảng màu sáng riêng; màu biểu đồ đã kiểm tra trên nền sáng). Áp dụng trước khi vẽ trang để không nháy màu.
  - **Cỡ chữ Hán**: Bình thường / Lớn / Rất lớn (×1 / ×1.2 / ×1.45) cho từ vựng, thẻ ôn, bài đọc, bài tập, đề thi; chữ tiếng Việt giữ nguyên; có ô xem trước.
  - **Học tập** (chuyển từ trang Tiến độ sang): chuẩn HSK, mục tiêu phút/ngày, thẻ mới/ngày, loại thẻ ôn.
  - **Quyền riêng tư**: bật/tắt chấm nói tự động (trước đây đồng ý rồi thì không tắt được).
  - Khôi phục cài đặt giao diện & giọng đọc mặc định.
- `src/lib/settings.ts`: cài đặt theo thiết bị (localStorage riêng `htt.settings.v1`, không nằm trong file sao lưu tiến độ), có test.

### Sửa
- Danh sách listener được duyệt trên bản sao (tránh lặp vô hạn khi listener tự đăng ký lại).
- Thu gọn khoảng cách menu để vừa mục “Cài đặt”.

## [0.6.0] — 2026-11-13 — Giai đoạn 6: dashboard + nâng cấp mục nguồn

### Thêm
- **Trang chủ = dashboard** (`src/pages/home.ts`): streak, số phút học hôm nay / mục tiêu ngày, **“Hôm nay nên làm gì”** theo thứ tự SPEC (ôn SRS đến hạn → bài học tiếp theo → 1 bài đọc, đánh dấu bước đã xong và nút “Bắt đầu” cho bước kế tiếp), biểu đồ phút học 7 ngày (đường mục tiêu), **từ vựng theo cấp HSK** (đã thuộc / đang học so với số từ của cấp theo chuẩn đang chọn), lịch sử điểm thi thử (đường điểm đạt), nguồn bổ trợ nên dùng bây giờ.
- **Nhật ký học theo ngày** (`UserProgress.studyLog`, giữ 120 ngày): giây học, số thẻ ôn, bài học, bài đọc, bài thi. Thời gian học chỉ tính khi đang ở trang học, tab đang hiển thị và có thao tác trong 60 giây (hoặc đang phát âm) — `src/ui/activity.ts`.
- **Biểu đồ** không thư viện ngoài (`src/ui/charts.ts`): cột ≤ 24px bo đầu, lưới mảnh, nhãn giá trị chọn lọc, tooltip khi rê chuột / focus bàn phím, luôn có “Xem dạng bảng”. Màu hai chuỗi (#e5484d, #4a90e2) đã qua bộ kiểm tra màu (độ sáng, mù màu, tương phản trên nền tối).
- **Gợi ý nguồn theo ngữ cảnh** (`src/ui/resourceHint.ts`): sau bài học (HelloChinese, Zero to Hero), bài đọc/nghe (Du Chinese, Mandarin Corner), thi thử (CTI, Mandarin Bean), xong ôn tập (Anki), trang từ vựng (Pleco). Nhãn **“Nên dùng ngay”** theo tiến độ, đúng nhãn “Dùng khi nào” (vd CTI chỉ khi thi thử ≥ 80%).
- **Trang nguồn**: giữ 8 card, thêm “Nên dùng ngay” và ngữ cảnh gợi ý (“sau khi thi thử”, …).
- Cài đặt mục tiêu phút/ngày ở trang Tiến độ. Test: 184.

## [0.5.0] — 2026-11-13 — Giai đoạn 5: thi thử theo config

### Thêm
- **Cấu trúc đề theo chuẩn & cấp** (`src/config/exams.ts`): phần thi, phần, dạng câu, số câu, số phương án, thời gian, luật phát âm thanh, thang điểm, điểm đạt, link đề mẫu chính thức. Có HSK 3.0 cấp 1 và HSK 2.0 cấp 1. Cờ `verified: false` + ghi chú nguồn — **chưa đối chiếu được đề mẫu chính thức HSK 3.0 trên chinesetest.cn**.
- **Đề HSK 1 chuẩn 3.0 số 1** (40 câu, tự soạn, `data/curated/exams/hsk1-3.0-01.json`): Nghe 4 phần (Đúng/Sai theo hình, chọn hình, nghe câu hỏi chọn câu trả lời, hội thoại + câu hỏi), Đọc 4 phần (Đúng/Sai theo hình, chọn hình, điền từ, đọc câu + câu hỏi). Hình minh họa bằng emoji. Mỗi câu có từ khóa liên quan và giải thích tiếng Việt.
- **Engine** (`src/lib/exam.ts` + `scripts/build-exams.ts`): dựng đề, kiểm tra đề khớp config (số câu/phần, dạng câu, số phương án, đáp án hợp lệ, chữ ngoài từ điển, từ khóa, phần Đúng/Sai phải có cả hai đáp án), chấm điểm từng phần (thang 100/phần), đạt/không đạt, câu sai -> từ liên quan vào SRS (từ chưa có thẻ: tạo thẻ; từ đã học: đến hạn ngay).
- **Phòng thi** (`#/thi-thu/<id>`): phần Nghe tự chạy — mỗi câu phát 2 lần, không nghe lại, 10 giây chọn đáp án rồi tự chuyển; hội thoại giọng nam/nữ khác nhau; 3 phút xem lại phần Nghe; phần Đọc đếm ngược 17 phút, hết giờ tự nộp; bảng số câu; cảnh báo câu chưa làm khi nộp. Đề in pinyin trên chữ (cấp 1).
- **Kết quả**: tổng điểm /200, điểm từng phần, đạt/không đạt, xem lại từng câu (lời thoại + nghe lại + giải thích, lọc câu sai), link sang đề mẫu CTI và Mandarin Bean. Lịch sử điểm lưu trong `examAttempts`.
- Test: 168.

## [0.4.0] — 2026-11-13 — Giai đoạn 4: bài đọc phân cấp + nghe/shadowing

### Thêm
- **6 bài đọc HSK 1** tự soạn (3 bài văn, 3 hội thoại), 83–94 chữ Hán mỗi bài, 0% từ ngoài cấp, 3–4 câu hỏi đọc hiểu (`data/curated/readings-hsk1.json` → `scripts/build-readings.ts`). Build báo lỗi nếu bài ngoài khoảng 80–300 chữ, > 5% từ ngoài cấp, chữ ngoài từ điển, hội thoại thiếu người nói, câu hỏi sai.
- **Thư viện** (`#/doc`) và **trình đọc** (`#/doc/<id>`): pinyin trên chữ bằng `<ruby>` (có biến điệu 一/不), dịch cả bài hoặc từng câu (nút VI), tô màu từ *mới / đang học / đã thuộc* theo SRS (đã thuộc = mọi thẻ có độ ổn định ≥ 21 ngày), bấm từ mở pop-up, nút “thêm các từ chưa học trong bài vào ôn tập”, câu hỏi đọc hiểu chấm ngay và lưu kết quả.
- **Chế độ nghe**: phát từng câu hoặc cả bài (tô sáng câu đang đọc), tốc độ 0.5x–1.25x, ⏮/⏭, lặp câu, hội thoại dùng giọng khác nhau cho từng người nói (nếu máy có ≥ 2 giọng zh-CN).
- **Shadowing**: phát câu → tạm dừng bằng độ dài câu đo được × 1,2 (tối thiểu 1,2 s) để nói theo; tùy chọn ghi âm trong lúc dừng (bản ghi chỉ ở trên máy, nghe lại ngay dưới câu).
- **Phụ đề 3 lớp** bật/tắt độc lập: Hán tự / pinyin / tiếng Việt (tắt Hán tự để luyện nghe).
- Phím tắt: Space phát/dừng, ←/→ câu trước/sau, R lặp câu, P pinyin, T dịch. Cài đặt hiển thị nhớ theo máy (localStorage).
- Dẫn link Du Chinese, Mandarin Corner (YouTube) — chỉ link, không nhúng/tải video.
- `UserProgress.readingResults`; `src/lib/readings.ts`; `wordStatuses` trong `srs.ts`; `speakAsync` (đo thời lượng, chọn giọng). Test: 147.

### Sửa
- Pinyin câu: 一 trước 百/千 đọc yì (一百 yìbǎi); lời dẫn trong ngoặc kép không còn dư dấu cách và được viết hoa.

## [0.3.0] — 2026-11-13 — Giai đoạn 3: lộ trình bài học HSK 1 + phát âm

### Thêm
- **Lộ trình** (`#/bai-hoc`): Cấp HSK → Unit → Lesson; mở khóa tuần tự, **thi vượt** cả unit (đạt ≥ 80% → hoàn thành mọi bài, từ vào ôn tập). Unit 1 “Chào hỏi & giới thiệu” gồm 4 bài, 29 từ (`data/curated/lessons-hsk1.json`, tự soạn).
- **Trình chạy bài** (`#/bai-hoc/<id>`): Từ mới → Ngữ pháp (cấu trúc, giải thích tiếng Việt, 3 ví dụ) → Bài tập trộn → Tổng kết (từ mới tự vào SRS). Câu sai được hỏi lại ở cuối bài. Phím 1–4 / Enter / Space.
- **8 dạng bài tập**: chọn nghĩa, nghe chọn Hán tự, ghép cặp, sắp xếp câu, điền từ, chọn thanh điệu, viết chữ theo nét (Hanzi Writer, có hoạt ảnh mẫu), nói theo câu mẫu. Sinh tự động lúc build (`scripts/build-lessons.ts`, `src/lib/exercises.ts`, có seed); phương án nhiễu loại từ đồng âm (他/她) và từ thay thế được (đại từ, `notOptions`).
- **Chấm nói** (`src/ui/speakWidget.ts`): `SpeechRecognition` zh-CN → so khớp LCS theo chữ, tô màu chữ đúng/sai, chấp nhận chữ đồng âm. Cần người học **đồng ý** trước (âm thanh gửi tới máy chủ nhận dạng của trình duyệt). Fallback: ghi âm `MediaRecorder` (chỉ lưu cục bộ) → nghe lại song song với mẫu → tự chấm; không có micro → tự chấm. Có nút bỏ qua (không tính điểm).
- **Luyện phát âm** (`#/phat-am`): thanh đơn (nghe → chọn thanh), cặp thanh (gồm thanh nhẹ, hiện cách đọc thực tế khi có biến điệu), trang quy tắc biến điệu 3-3 / 不 / 一 / thanh nhẹ có ví dụ phát âm, nói theo câu ví dụ.
- `src/lib/tones.ts` (tách thanh, biến điệu), `src/lib/grading.ts` (chấm bài, chấm nói), `src/lib/lessons.ts` (mở khóa, thi vượt, kiểm tra dữ liệu bài học).
- Trang chủ: thẻ “Bài tiếp theo”. Menu thêm “Bài học”, “Phát âm”.
- Test: 129.

### Sửa
- Viền đỏ (outline focus của `main`) hiện ngang màn hình sau khi chuyển trang.

## [0.2.0] — 2026-11-13 — Giai đoạn 2: pop-up từ điển, SRS, xuất Anki

### Thêm
- **Pop-up từ điển** (`src/ui/popup.ts`): bấm/chạm hoặc Enter/Space vào bất kỳ chữ Hán có `data-word-id` trên toàn site → Hán tự lớn, pinyin (có dấu + dạng số), Hán Việt, nghĩa Việt/Anh, cấp HSK theo 2 chuẩn, Hán Việt từng chữ, hoạt ảnh thứ tự nét, câu ví dụ (bấm được từng từ), 🔊, **+ Thêm vào ôn tập**. Esc / bấm ra ngoài để đóng.
- **Thứ tự nét**: Hanzi Writer (MIT); dữ liệu nét của 252 chữ HSK 1 copy sẵn vào `public/data/strokes/` lúc build — không gọi CDN.
- **Tách từ** (`src/lib/segment.ts`, forward maximum matching) và **pinyin câu** có biến điệu 一/不 (`src/lib/sentence.ts`).
- **70 câu ví dụ** HSK 1 tự soạn (`data/curated/examples-hsk1.tsv`), tách từ sẵn lúc build; build báo lỗi nếu câu dùng chữ ngoài HSK 1. 185/301 từ có ví dụ.
- **SRS FSRS-4.5** (`src/lib/srs.ts`): 4 loại thẻ (Hán tự→nghĩa, Nghĩa→Hán tự, Nghe→Hán tự, Viết tay), nút Quên/Khó/Được/Dễ có hiện khoảng cách, giới hạn thẻ mới/ngày (mặc định 10), thẻ "anh em" cùng từ để sang ngày sau, thẻ Quên hỏi lại sau 1 phút trong phiên.
- **Trang Ôn tập** (`#/on-tap`): phím Space lật thẻ / phát lại, 1–4 chấm điểm; thẻ viết tay dùng quiz của Hanzi Writer và gợi ý điểm theo số nét sai. Số thẻ đến hạn hiện trên trang chủ và trên menu.
- **Xuất Anki** (`src/lib/anki.ts`, trang Tiến độ): file .txt phân cách Tab, header `#separator/#html/#deck/#columns/#tags column`; lọc theo cấp, tất cả / chỉ từ đã học / từ hay sai.
- Cài đặt: số thẻ mới/ngày, loại thẻ tạo khi thêm từ. Streak cập nhật khi ôn.
- Nút "+ Thêm cả cấp vào ôn tập" ở trang Từ vựng.
- Test: 99 (thêm SRS, Anki, tách từ, biến điệu, streak).

### Thay đổi
- `UserProgress` thêm `srsCardTypes`; `SrsCard` thêm `firstReview`. Dữ liệu cũ vẫn đọc được (trường thiếu lấy mặc định), thẻ sai định dạng bị bỏ khi nhập.
- `main.ts` tách thành `state.ts`, `ui/*`, `pages/review.ts`.

## [0.1.0] — 2026-11-13 — Giai đoạn 1: nền tảng dữ liệu

### Thêm
- Khung dự án Vite + TypeScript + Vitest, chỉ có frontend.
- `src/config/hsk.ts`: config chuẩn HSK (`"3.0"` mặc định, `"2.0"`), số từ tích lũy theo cấp, ghi chú kỳ thi, cờ `verified`.
- Dữ liệu HSK 1: 301 từ (HSK 3.0 cấp 1 ∪ HSK 2.0 cấp 1) gồm pinyin, pinyin số, âm Hán Việt, nghĩa Việt, nghĩa Anh và cấp theo cả hai chuẩn.
- `scripts/build-vocab.ts` (`npm run data`): sinh và kiểm tra dữ liệu, dừng nếu có lỗi.
- `src/lib/pinyin.ts`: chuyển pinyin có dấu ↔ dạng số (có nhi hóa, ü/v/u:), khóa tìm kiếm.
- `src/lib/search.ts`: tìm bằng Hán tự, pinyin có dấu, pinyin số (`ni3hao3`), pinyin không dấu, tiếng Việt (có hoặc không dấu), Hán Việt.
- `src/lib/progress.ts`: `UserProgress` lưu localStorage (try/catch), xuất/nhập JSON có làm sạch dữ liệu.
- Giao diện: Trang chủ, Từ vựng (tìm kiếm, nút 🔊 TTS zh-CN, phím `/`), Nguồn miễn phí (8 card có "Dùng khi nào"), Tiến độ (xuất/nhập JSON).
- Tài liệu: `docs/CURRENT_STATE.md`, `docs/DATA_SOURCES.md`.
- 56 unit test: pinyin, validate, config, dữ liệu đã build, tìm kiếm, tiến độ.
