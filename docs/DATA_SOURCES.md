# Nguồn dữ liệu & giấy phép

| Dữ liệu | Nguồn | Giấy phép | Dùng cho | Trạng thái |
|---|---|---|---|---|
| Danh sách từ HSK 2.0 + 3.0, pinyin, nghĩa tiếng Anh | [drkameleon/complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) (file `complete.json`, tải 13/11/2026) | **MIT** — bản sao giấy phép ở `data/raw/complete-hsk-vocabulary/LICENSE` | `hsk2Level`, `hsk3Level`, `pinyin`, `pinyinNumbered`, `meaningEn` | Đang dùng |
| Nghĩa tiếng Anh (bên trong dữ liệu trên) | CC-CEDICT qua MDBG | **CC BY-SA 4.0** | `meaningEn` (chỉ để tham khảo) | Đang dùng — phải ghi công CC-CEDICT, và dữ liệu phái sinh từ `meaningEn` giữ giấy phép CC BY-SA |
| Âm Hán Việt (`hanViet`) | Dự án tự soạn | Thuộc dự án | 301 từ HSK 1 | **Bản nháp, cần duyệt** |
| Nghĩa tiếng Việt (`meaningVi`) | Dự án tự soạn (không dịch máy từ CC-CEDICT) | Thuộc dự án | 301 từ HSK 1 | **Bản nháp, cần duyệt** |
| Câu ví dụ (`examples`) | Dự án tự soạn: `data/curated/examples-hsk1.tsv` (147 câu) + câu trong bài học | Thuộc dự án | 429 câu, mọi từ HSK 1 có ví dụ | Bản nháp, cần duyệt |
| Từ loại (`pos`) | Dự án tự soạn (`data/curated/pos-hsk1.tsv`) — không dùng nhãn từ loại của dữ liệu gốc (quá nhiễu) | Thuộc dự án | 301 từ | Bản nháp, cần duyệt |
| Bài học HSK 1 (ngữ pháp, câu luyện tập) | Dự án tự soạn (`data/curated/lessons/hsk1-u01…u10.json`) | Thuộc dự án | 43 bài, 172 câu luyện + 129 ví dụ ngữ pháp | Bản nháp, cần duyệt |
| Bài đọc HSK 1 (12 bài + câu hỏi) | Dự án tự soạn (`data/curated/readings-hsk1.json`) | Thuộc dự án | Thư viện bài đọc, chế độ nghe | Bản nháp, cần duyệt |
| Đề thi thử HSK 1 (3.0) số 1–3 | Dự án tự soạn (`data/curated/exams/`), hình = emoji; chỉ theo *cấu trúc* của CTI, không chép câu mẫu | Thuộc dự án | Thi thử | Bản nháp, cần duyệt |
| Cấu trúc đề HSK 3.0 cấp 1 | 汉考国际 (CTI) “新版HSK（1-6级）考试结构与样题示例” (12/2025) + chinesetest.cn/HSK/1 — kiểm tra 13/11/2026 | — | `src/config/exams.ts` | Cấu trúc & thời lượng: đã xác minh · thang điểm, số lần phát: **chưa xác minh** |
| Thứ tự nét | [Hanzi Writer](https://github.com/chanind/hanzi-writer) 3.7 + [hanzi-writer-data](https://github.com/chanind/hanzi-writer-data) 2.0.1 (từ Make Me a Hanzi) | Hanzi Writer: **MIT**; dữ liệu nét: **Arphic Public License** — bản giấy phép đi kèm ở `public/data/strokes/ARPHICPL.TXT` | Pop-up từ điển, thẻ viết tay | Đang dùng (252 chữ, copy lúc build) |
| Thuật toán SRS | FSRS-4.5 (open-spaced-repetition), tham số mặc định | MIT (thuật toán/tham số công khai; code tự viết) | `src/lib/srs.ts` | Đang dùng |

Không scrape hay sao chép nội dung của HelloChinese, Pleco, Du Chinese hay các đề thi có bản quyền.

## Chuẩn HSK 3.0 dùng trong dữ liệu

Dữ liệu gốc có 3 bộ nhãn: `old-N` (HSK 2.0), `new-N` (chuẩn HSK 3.0 năm 2021, cấp 1 = 500 từ) và
`newest-N` (bản điều chỉnh mới nhất, cấp 1 = 294 từ). SPEC ghi HSK 3.0 cấp 1 là **300** từ, khớp với bộ `newest`,
nên `hsk3Level` lấy theo `newest-N`. Bộ `new-N` (2021) hiện **không** được dùng.

Số từ thực tế của HSK 1 so với config:

| Chuẩn | Dữ liệu | Config (`src/config/hsk.ts`) |
|---|---|---|
| HSK 3.0 cấp 1 | 294 | 300 |
| HSK 2.0 cấp 1 | 150 | 150 |

⚠️ Cả hai số trong config đều cần đối chiếu với trang chính thức https://www.chinesetest.cn (`verified: false`).

## Quy trình dữ liệu

1. Sửa `data/curated/hsk1.tsv` (cột: `hanzi`, `pinyin` khi từ có nhiều cách đọc, `hanViet`, `meaningVi`).
2. Chạy `npm run data`. Script sẽ:
   - lấy cấp HSK và nghĩa tiếng Anh từ dữ liệu gốc; bắt buộc chỉ định pinyin cho từ đa âm (了, 还, 便宜…);
   - sinh lại pinyin có dấu từ dạng số để chuẩn hóa cách tách âm tiết; nhi hóa viết dính (`yī diǎnr`);
   - đối chiếu pinyin số do ta tự sinh với dữ liệu gốc;
   - báo lỗi nếu thiếu từ HSK 1 nào hoặc dữ liệu không qua `validateWordList`, và khi đó **không** ghi file.
3. `npm test` kiểm tra lại file đã build.

## Bộ thủ

| Dữ liệu | Nguồn | Giấy phép | Dùng cho | Trạng thái |
|---|---|---|---|---|
| Danh mục 78 bộ thủ: nhóm, nghĩa, Hán Việt, số nét, mẹo nhớ (`data/curated/radicals.json`) | Dự án tự soạn | Thuộc dự án | Trang bộ thủ | Bản nháp, cần duyệt |
| Bộ thủ của từng chữ | complete-hsk-vocabulary (`radical` của mục chữ đơn) + `data/curated/char-radicals-hsk1.tsv` (46 chữ HSK 1, dự án tự điền theo cách xếp bộ của từ điển giản thể) | MIT / thuộc dự án | Chữ ví dụ, bài luyện | Đối chiếu số nét với `radStrokes`; 习 xếp bộ 乙 (từ điển khác nhau) |
| Nét của bộ trong chữ (`radStrokes`) | hanzi-writer-data (Make Me a Hanzi) | Arphic Public License | Tô đỏ bộ trong chữ, bài “ghép bộ” | — |

## Lộ trình Pinyin

| Dữ liệu | Nguồn | Giấy phép | Trạng thái |
|---|---|---|---|
| Bài giảng, so sánh với âm tiếng Việt, nhóm âm dễ nhầm, câu chọn cách viết (`data/curated/pinyin-course.json`) | Dự án tự soạn | Thuộc dự án | Bản nháp, cần duyệt |
| Chữ dùng để phát âm từng âm tiết | Chọn tự động từ complete-hsk-vocabulary (MIT) + từ vựng HSK 1 (chữ chỉ một cách đọc), 11 chữ chỉ định tay | MIT / thuộc dự án | Có test đối chiếu |

## Audio dựng sẵn

| Dữ liệu | Nguồn | Giấy phép / điều khoản | Ghi chú |
|---|---|---|---|
| MP3 giọng Microsoft Neural (`public/audio/`) | Azure AI Speech (REST chính thức, gói Free F0), đọc văn bản do dự án tự soạn | Điều khoản dịch vụ Azure; có ý kiến (chưa chính thức) rằng audio từ F0 không kèm quyền dùng thương mại — dự án phi thương mại | Chưa tạo. Xem `docs/AUDIO.md` |

## Duyệt dữ liệu

1. `npm run review:export` → mở `docs/review-hsk1.tsv` bằng Excel / Google Sheets.
2. Sửa trực tiếp cột `han_viet`, `nghia_viet` (nhiều nghĩa cách nhau dấu “;”), `tu_loai` (ghi nhãn hoặc mã, cách nhau dấu phẩy). Ghi `ok` ở cột `duyet` cho từ đã duyệt.
3. Lưu lại dạng TSV (tab-separated), rồi `npm run review:import -- --dry-run` để xem trước thay đổi, sau đó `npm run review:import` và `npm run data`.
