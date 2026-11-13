# Hiện trạng dự án (cập nhật sau Bước D1 vòng 2 — v0.12.0, 13/11/2026)

> SPEC trong repo đã được thay bằng **v2.1** (có Mục 1b, 3.12–3.19).

## Khảo sát ban đầu (Mục 0)

SPEC giả định đã có sẵn một web học tiếng Trung (trang bài học, *Thi thử*, *xuất tiến độ*, mục *Nguồn miễn phí nên dùng kèm*).
Khi khảo sát, thư mục dự án `D:\WebApp_Study_Chinese` **trống hoàn toàn**. Tìm thêm trên máy (ổ D:, Desktop, Documents, Downloads)
và trong danh sách artifact của người dùng cũng **không có** web nào như vậy. Vì vậy dự án được **dựng mới**, giữ đúng định hướng
giao diện mô tả trong SPEC: dark theme, card bo góc, màu nhấn đỏ.

## Stack đã chọn

| Hạng mục | Lựa chọn | Lý do |
|---|---|---|
| Build | Vite 6 + TypeScript 5 (strict) | Nhẹ, không cần framework cho giai đoạn đầu |
| UI | TypeScript thuần + hash router (`#/tu-vung`) | Ít phụ thuộc; có thể chuyển sang framework sau nếu cần |
| Test | Vitest 3 | Chạy chung cấu hình với Vite |
| Lưu dữ liệu | localStorage (bọc try/catch) + xuất/nhập JSON | Chỉ có frontend, **không có backend** (SPEC mục 4) |
| Script dữ liệu | `scripts/build-vocab.ts`, chạy trực tiếp bằng Node ≥ 22.18 | Dùng chung code pinyin/validate với app |

## Cấu trúc thư mục

```
data/raw/complete-hsk-vocabulary/   dữ liệu gốc (MIT) + LICENSE
data/curated/hsk1.tsv               Hán Việt + nghĩa Việt do dự án soạn (bản nháp)
scripts/build-vocab.ts              sinh public/data/vocab/hsk1.json, dừng build nếu dữ liệu lỗi
public/data/vocab/hsk1.json         dữ liệu app tải lúc chạy
src/config/hsk.ts                   config chuẩn HSK 2.0 / 3.0 (mặc định 3.0)
src/config/resources.ts             8 nguồn miễn phí + "Dùng khi nào"
src/lib/pinyin.ts                   có dấu <-> dạng số, nhi hóa, khóa tìm kiếm
src/lib/search.ts                   tìm theo Hán tự / pinyin / pinyin số / tiếng Việt / Hán Việt
src/lib/progress.ts                 UserProgress: load/save/sanitize/xuất/nhập
src/data/validate.ts                kiểm tra hợp lệ từng từ và cả danh sách
src/types.ts                        mô hình dữ liệu (SPEC mục 4)
src/lib/srs.ts                      FSRS-4.5, hàng ôn mỗi ngày
src/lib/anki.ts                     xuất .txt cho Anki
src/lib/segment.ts, sentence.ts     tách từ, pinyin câu + biến điệu 一/不
src/state.ts                        trạng thái dùng chung
src/ui/popup.ts, strokes.ts, …      pop-up từ điển, Hanzi Writer, TTS
src/pages/review.ts                 trang Ôn tập
src/pages/lessons.ts                lộ trình + trình chạy bài + thi vượt
src/pages/pronunciation.ts          luyện phát âm & thanh điệu
src/pages/reading.ts                thư viện bài đọc + trình đọc/nghe/shadowing
src/pages/practice.ts               trang Luyện tập + game Mưa từ vựng
src/lib/pinyinGame.ts               logic game gõ pinyin (chấm, vòng chơi, tổng kết)
src/pages/exam.ts                   danh sách đề, phòng thi, kết quả
src/pages/home.ts                   dashboard trang chủ
src/pages/settings.ts               trang Cài đặt (giọng đọc, giao diện, cỡ chữ Hán, học tập, quyền riêng tư)
src/lib/settings.ts                 cài đặt theo thiết bị (localStorage riêng)
data/curated/pos-hsk1.tsv           từ loại HSK 1 (tự soạn)
src/lib/pos.ts, review.ts           nhãn từ loại; xuất/nhập bảng duyệt
scripts/export-review.ts, import-review.ts  quy trình duyệt dữ liệu
src/lib/voices.ts                   lọc / xếp hạng / gắn nhãn giọng trình duyệt, giọng người nói thứ hai, chia câu dài
src/ui/speech.ts                    module phát âm dùng chung (speak / speakAsync)
scripts/check-links.ts              quét link nội bộ (chạy trong npm test)
src/lib/dashboard.ts                nhật ký học, việc hôm nay, tiến độ theo cấp, gợi ý nguồn
src/ui/charts.ts, activity.ts       biểu đồ SVG + tooltip; đo thời gian học
src/ui/resourceHint.ts              khối gợi ý nguồn theo ngữ cảnh
src/config/exams.ts                 cấu trúc đề theo chuẩn/cấp
src/lib/exam.ts                     dựng/kiểm tra/chấm đề, câu sai -> SRS
scripts/build-exams.ts              sinh public/data/exams/hsk1.json
data/curated/exams/                 đề thi tự soạn
src/lib/readings.ts                 dựng & kiểm tra bài đọc, tiện ích shadowing
scripts/build-readings.ts           sinh public/data/readings/hsk1.json
data/curated/readings-hsk1.json     nội dung bài đọc (tự soạn)
src/lib/exercises.ts, grading.ts    sinh bài tập, chấm bài, chấm nói
src/lib/tones.ts, lessons.ts        thanh điệu & biến điệu; mở khóa bài
src/ui/speakWidget.ts, speechInput.ts  nói & chấm (nhận dạng / ghi âm)
scripts/build-lessons.ts            sinh public/data/lessons/hsk1.json
data/curated/lessons/hsk1-uNN.json  nội dung bài học, mỗi unit một file (tự soạn)
src/main.ts, src/styles.css         router + các trang còn lại
tests/                              unit test (pinyin, dữ liệu, tìm kiếm, tiến độ)
```

## Đối chiếu với SPEC mục 3

| Mục | Trạng thái | Ghi chú |
|---|---|---|
| 3.1 Dữ liệu từ vựng & từ điển nội bộ | **Đã có cho HSK 1** | 301 từ, đủ câu ví dụ (301/301), từ loại, nghĩa tách riêng; `audio` chưa có (dùng TTS) |
| 3.2 Pop-up từ điển | **Đã có** | Bấm chữ Hán ở mọi trang (danh sách từ, ví dụ, mặt sau thẻ ôn) → pop-up đầy đủ + thứ tự nét. Ô tìm kiếm ở trang Từ vựng |
| 3.3 SRS | **Đã có** | FSRS-4.5, 4 loại thẻ, giới hạn thẻ mới/ngày, trang `#/on-tap` |
| 3.4 Xuất Anki | **Đã có** | .txt Tab + header; lọc tất cả / đã học / hay sai, theo cấp. Xuất/nhập JSON giữ nguyên |
| 3.5 Lộ trình bài học | **Đã có (HSK 1 đầy đủ)** | 10 unit, 43 bài, 301/301 từ, 8 dạng bài, thi vượt, 14 checkpoint (sau mỗi 3 bài, ≥ 80%) |
| 3.6 Phát âm & thanh điệu | **Đã có** | TTS zh-CN, chấm nói (SpeechRecognition, cần đồng ý) + fallback ghi âm, luyện thanh đơn/cặp thanh, trang biến điệu |
| 3.7 Bài đọc phân cấp | **Đã có** | 12 bài HSK 1 (gắn theo unit), ruby pinyin, dịch từng câu, tô màu từ, đọc hiểu |
| 3.8 Nghe & shadowing | **Đã có** | Tốc độ 0.5–1.25x, lặp câu, trước/sau, shadowing + ghi âm, phụ đề 3 lớp. Video ngoài: chỉ dẫn link |
| 3.9 Thi thử | **Đã có (3 đề HSK 1 chuẩn 3.0)** | Cấu trúc, dạng câu, thời lượng đã đối chiếu tài liệu chính thức CTI (13/11/2026); thang điểm 200/120 và số lần phát âm thanh **chưa xác minh** (tài liệu chưa nêu) |
| 3.10 Dashboard | **Đã có** | Streak, phút học/mục tiêu, việc hôm nay, từ theo cấp, lịch sử thi thử |
| 3.11 Nguồn miễn phí | **Đã có** | 8 card + “Dùng khi nào”, cấp, “Nên dùng ngay”; gợi ý theo ngữ cảnh sau bài học / đọc / nghe / thi / ôn |

## Việc còn mở

- Âm Hán Việt và nghĩa tiếng Việt của 301 từ là **bản nháp** (`reviewStatus: "draft"`), cần người biết chữ Hán duyệt.
- Số liệu HSK trong `src/config/hsk.ts` có `verified: false` — cần đối chiếu với chinesetest.cn.
- Đề HSK 3.0 cấp 1: tài liệu chính thức của CTI chưa nêu thang điểm và số lần phát âm thanh — đang dùng 200/120 và 2 lần như đề hiện hành (ghi rõ trên trang Thi thử). Kiểm tra lại khi CTI công bố đề mẫu đầy đủ / sau kỳ thi 13/12/2026.
- Chấm nói tự động chỉ được thử bằng bộ nhận dạng giả lập (khung trình duyệt của Claude chặn micro) — cần thử với micro thật trên Chrome/Edge. Quyền riêng tư: bật chấm tự động nghĩa là âm thanh được gửi tới máy chủ của nhà cung cấp trình duyệt; web hỏi ý người học trước.
- Giọng đọc TTS phụ thuộc máy (Windows có Huihui/Kangkang/Yaoyao). Chữ đa âm đọc riêng lẻ có thể sai âm.
- Xuất Anki mới được kiểm tra bằng unit test theo đặc tả header của Anki — **chưa thử nhập vào Anki thật**.
- 116/301 từ chưa có câu ví dụ (cột ViDu trong file Anki để trống).
- Font tải từ Google Fonts (lộ IP người dùng cho Google). Nếu muốn tuyệt đối không có request ra ngoài thì tự host font.

## Tiến độ theo SPEC v2.1 (vòng 2)

| Bước | Trạng thái |
|---|---|
| A1 Giọng đọc trình duyệt (3.19) | **Xong** — lọc zh-CN chuẩn/zh-TW, Tự động, xếp hạng, optgroup, khác giới cho hội thoại, fallback giọng mất. Phần **giọng Microsoft Neural dựng sẵn** (nguồn giọng, build-audio) thuộc Bước D4 |
| A2 Thanh tab dưới đáy (< 768px) | **Xong** |
| A3 Thanh phát trình đọc trên điện thoại | **Xong** |
| A4 Quét link trong npm test | **Xong** |
| B1 Kế hoạch unit | **Xong, đã duyệt** (`docs/plan-hsk1-units.md`) |
| B2 Soạn bài + checkpoint | **Xong** — 39 bài mới, 14 checkpoint |
| B3 Câu ví dụ | **Xong** — 301/301 từ (18 từ mới có 1 câu) |
| B4 Từ loại + tách nghĩa | **Xong** (hiển thị trong thẻ từ & pop-up; trang chi tiết chữ của 3.14 chưa làm) |
| B5 File duyệt + nhập lại | **Xong** — `npm run review:export` / `review:import` |
| B6 +6 bài đọc | **Xong** — 12 bài, gắn unit |
| C1 Rà cấu trúc đề | **Xong** — theo tài liệu CTI 12/2025; 2 mục chưa xác minh được ghi rõ |
| C2 +2 đề | **Xong** — 3 đề, không trùng câu |
| D1 3.12 Game gõ pinyin | **Xong** — `#/luyen-tap/go-pinyin`, 2 chế độ, boss, từ yếu → SRS, kỷ lục |
| D2 3.13 Chép chính tả | Chưa làm |
| D3 3.16 Mễ tự cách + In PDF | Chưa làm |
| D4 3.19 Audio dựng sẵn (Azure) | Chưa làm |
| D5 3.15 Bộ thủ · 3.17 Khóa Pinyin · 3.18 XP & huy hiệu | Chưa làm |

Việc người dùng cần tự kiểm tra: nhập file xuất vào Anki thật; chấm nói bằng micro thật trên Chrome và Edge; nghe thử giọng sau Bước A trên Edge, Chrome và điện thoại.
