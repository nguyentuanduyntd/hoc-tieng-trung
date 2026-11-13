# Changelog

## [0.16.0] — 2026-11-13 — Bước D5a: Bộ thủ (SPEC 3.15)

### Thêm
- **Bộ thủ** (`#/luyen-tap/bo-thu`, thẻ mới trong Luyện tập): **78 bộ thủ** thông dụng, chia **7 nhóm chủ đề** — Con người, Thiên nhiên, Động vật, Hành động, Phương hướng & nơi chốn, Đồ vật, Nét & biểu tượng. Mỗi nhóm có thanh tiến độ (số bộ đã thuộc).
- Trang từng bộ (`/bo-thu/<bộ>`):
  - Hình gốc + biến thể (水 → 氵, 人 → 亻, 言 → 讠…) với số nét từng dạng.
  - Nghĩa, Hán Việt, hoạt ảnh thứ tự nét, **mẹo nhớ** (dự án tự viết).
  - 3–12 **chữ ví dụ**: chữ HSK 1 trước (★), **tô đỏ phần bộ thủ trong chữ**. Bấm chữ HSK 1 thì mở pop-up từ điển, chữ khác thì mở bảng luyện viết.
  - Nút “Luyện bộ này” và “Luyện viết bộ”.
- Bài luyện (`/bo-thu/luyen`, `/luyen/<nhóm>`, `/luyen/<bộ>`), phím 1–4 và Enter:
  - **Nhận diện bộ trong chữ**: 4 lựa chọn; nhiễu ưu tiên cùng nhóm và không lấy phần khác của chữ.
  - **Ghép bộ thành chữ**: bộ + phần còn lại của chữ (vẽ từ dữ liệu nét) → chọn chữ; nhiễu gồm chữ cùng bộ.
  - Nút **🎲 Luyện ngẫu nhiên**.
  - Một bộ được tính “đã thuộc” khi luyện riêng bộ đó đạt ≥ 80% (cần ≥ 2 câu về bộ).
- Dữ liệu `public/data/radicals.json` (`scripts/build-radicals.ts`, nằm trong `npm run data`):
  - Bộ thủ của chữ lấy từ complete-hsk-vocabulary (MIT); 46 chữ HSK 1 không có mục chữ đơn được bổ sung ở `data/curated/char-radicals-hsk1.tsv`.
  - Danh mục và mẹo nhớ ở `data/curated/radicals.json`.
  - Build báo lỗi khi ví dụ bổ sung mâu thuẫn với nguồn, hoặc thiếu dữ liệu nét.
  - Chép thêm dữ liệu nét cho hình bộ thủ và chữ ví dụ.
- Test: 315 (gồm: số nét bộ của 186 chữ HSK 1 khớp `radStrokes` của dữ liệu nét).

### Thay đổi
- Tiến độ thêm `radicals` (điểm luyện tốt nhất theo bộ). **Migration**: dữ liệu cũ → rỗng.
- `glyphSvg` hỗ trợ tô một số nét (`highlight`) hoặc chỉ vẽ một số nét (`only`).

## [0.15.0] — 2026-11-13 — Bước D4: audio dựng sẵn giọng Microsoft Neural (SPEC 3.19, nguồn A)

### Thêm
- `scripts/build-audio.ts` (`npm run audio`): gọi **Azure AI Speech REST, gói Free F0** để tạo MP3 cho 2 giọng (nữ `zh-CN-XiaoxiaoNeural`, nam `zh-CN-YunxiNeural` — cấu hình ở `src/config/audio.ts`). Nội dung:
  - Văn bản lấy từ: từ vựng, câu ví dụ, câu luyện nói và ngữ pháp, bài đọc / chính tả, phần Nghe của đề thi, câu nghe thử. Văn bản trùng chỉ tạo một lần.
  - File `public/audio/<giọng>/<hash>.mp3` + `public/audio/manifest.json`. Tên file băm theo giọng + nội dung, chỉ tạo file mới hoặc file đã đổi. Có `--dry-run`, `--level`, `--voice`, `--limit`, `--prune`.
  - SSML tối thiểu: không dùng `<prosody>`; chỉ dùng `<phoneme alphabet="sapi">` cho từ một chữ đa âm (了, 还, 都…) theo pinyin trong dữ liệu.
  - In số ký tự tính phí: chữ Hán = 2, thẻ phụ cũng tính, theo tài liệu Azure.
  - Tự giãn nhịp theo giới hạn F0 (20 yêu cầu/phút); thử lại khi gặp 429/5xx; dừng ngay khi key sai.
  - Key **chỉ** lấy từ biến môi trường `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION` hoặc `.env` (đã gitignore). Có `.env.example`. Hướng dẫn: `docs/AUDIO.md`.
- Cài đặt → Giọng đọc:
  - **Nguồn giọng:** Tự động / Microsoft Neural (dựng sẵn) / Chỉ giọng trình duyệt.
  - Chọn **Giọng Microsoft Neural** (晓晓 Nữ / 云希 Nam) + ▶ Nghe thử.
  - Dòng trạng thái cho biết có bao nhiêu từ / câu dựng sẵn.
- Module `speech.ts`: `speak` / `speakAsync` phát file dựng sẵn nếu có, tốc độ bằng `playbackRate` (giữ cao độ). Hội thoại: người thứ hai dùng giọng còn lại; đề thi 男/女 theo giới tính. File lỗi hoặc thiếu → giọng trình duyệt (chỉ một lần).

### Thay đổi
- Cài đặt thiết bị thêm `voiceSource`, `neuralVoice`. **Migration**: cài đặt cũ → Tự động, giọng nữ.
- Test: 302 (gồm kiểm tra `src/` không chứa key / endpoint Azure, `.env` bị gitignore, không dùng `edge-tts`).

### Chưa chạy
- Chưa gọi Azure lần nào. `--dry-run` HSK 1: 861 văn bản → 1.722 file (2 giọng) ≈ **21.948 ký tự tính phí ≈ 4,4% hạn mức F0/tháng**, khoảng 91 phút. Chờ duyệt rồi mới chạy thật.

## [0.14.0] — 2026-11-13 — Bước D3: bảng luyện viết Mễ tự cách + In PDF luyện viết (SPEC 3.16, 3.14)

### Thêm
- **Bảng luyện viết** (`#/luyen-tap/viet`, `/viet/<bài>`, `/viet/chu/<chữ>`): ô Mễ tự cách (khung + chữ thập + hai đường chéo), Hanzi Writer quiz chấm từng nét, dùng được chuột / cảm ứng / bút (`touch-action: none`).
  - 3 chế độ: **Tô theo** (hiện chữ mờ, sai 1 lần là gợi ý), **Có gợi ý** (không chữ mờ; sai 2 lần hoặc 💡 Nét tiếp), **Tự do** (không gợi ý).
  - Báo lỗi cụ thể: **sai thứ tự** (“đó là nét 3, cần viết nét 2 trước” — so nét vừa vẽ với đường giữa từng nét của chữ), **ngược hướng**, hoặc sai hình / vị trí.
  - Nút Viết lại, ▶ Xem nét (hoạt ảnh rồi viết tiếp), 🔊; bảng thông tin: pinyin, Hán Việt, nghĩa, số nét, từ có chữ này. Dải chữ đánh dấu chữ đã viết (xanh = không sai).
  - Chọn chữ: cả HSK 1 (252 chữ), từng bài học, hoặc tự gõ chữ.
- **Phiếu in luyện viết** (`#/luyen-tap/in/<bài>`, `/in/chu/<chữ>`): mỗi chữ có pinyin · Hán Việt, số nét, dải **thứ tự nét** (nét mới tô đỏ), dòng ô Mễ tự cách gồm 1 ô mẫu + ô chữ mờ để tô + ô trống. Tùy chọn số dòng / số ô mờ / ẩn pinyin / ẩn thứ tự nét. Nút **In / Lưu PDF** (A4, ẩn menu khi in, luôn nền trắng kể cả giao diện tối). Chữ vẽ bằng dữ liệu nét có sẵn (không phụ thuộc font máy).
- Nút **✍️ Luyện viết chữ của bài** và **🖨 In PDF luyện viết** ở bước Từ mới của mỗi bài học; nút **🖌 Luyện viết** trong pop-up từ điển.
- Logic thuần trong `src/lib/writing.ts` (chẩn đoán nét sai, chọn chữ, SVG chữ / lưới, bố cục phiếu) — 9 test.
- Test: 290.

## [0.13.0] — 2026-11-13 — Bước D2: chép chính tả (SPEC 3.13)

### Thêm
- **Chép chính tả** (`#/luyen-tap/chinh-ta`, thẻ mới trong trang Luyện tập): 12 bài HSK 1 = 12 bài đọc / hội thoại tự soạn (115 câu).
  - Danh sách lọc theo **cấp HSK** và trạng thái **Xong / Đang học / Chưa học** (kèm số bài); bài đang học hiện số câu đã đạt.
  - Mỗi câu: 🔊 Nghe, 🐢 Chậm (0,6× tốc độ cài đặt), 💡 Gợi ý (mở dần từng âm tiết / chữ từ đầu câu, mỗi gợi ý trừ điểm tương ứng). Hội thoại dùng giọng khác nhau cho hai người nói như trình đọc.
  - Gõ lại bằng **Pinyin** (có/không cách, không dấu, số thanh hoặc dấu thanh; `ü` = `v` = `u:`) hoặc **Chữ Hán** qua bộ gõ của máy.
  - Chấm từng âm tiết / chữ (căn hàng kiểu Levenshtein, ưu tiên giữ nhiều chỗ khớp nhất): **đúng · sai thanh** (chỉ khi có gõ thanh; 一/不 biến điệu thanh nào cũng được) **· đồng âm** (vd 他/她/它 — nghe không phân biệt được, vẫn tính đúng) **· sai · thiếu**, cộng phần **gõ thừa**. Mỗi ô có chữ đích + chữ bạn gõ / ✓ / —, không chỉ dựa vào màu.
  - Sau khi kiểm tra hiện câu gốc có pinyin + nghĩa tiếng Việt, bấm từ để mở từ điển. Câu đạt ≥ 80% là xong; dải số câu tô màu đã đạt / đã thử.
- Logic chấm thuần trong `src/lib/dictation.ts` — 16 test (gồm: gõ lại đúng mọi câu của 12 bài đều đạt 100%).

### Thay đổi
- Tiến độ thêm `dictation` (điểm tốt nhất từng câu). **Migration**: dữ liệu cũ không có trường này được gán rỗng; giá trị sai bị bỏ.
- Test: 281.

## [0.12.0] — 2026-11-13 — Bước D1: game gõ pinyin “Mưa từ vựng” (SPEC 3.12)

### Thêm
- Trang **Luyện tập** (`#/luyen-tap`, có trong menu và mục “Thêm” trên điện thoại) và game **Mưa từ vựng** (`#/luyen-tap/go-pinyin`):
  - Thẻ rơi xuống, hiện **nghĩa tiếng Việt** (chế độ chữ) hoặc **phát âm** (chế độ nghe; Enter khi ô trống / nút 🔊 để nghe lại). Gõ pinyin + Enter để bắn; trúng thì thẻ nổ, hiện Hán tự + pinyin và đọc to.
  - Chấp nhận pinyin không dấu, có/không cách, `ü` = `v` = `u:`. Gõ kèm thanh đúng (số `ni3hao3` hoặc dấu `nǐ hǎo`; thanh nhẹ gõ 5 hay bỏ trống đều được) → **×2 điểm**. Thẻ có nhiều từ cùng nghĩa (哪儿/哪里, 星期日/星期天…) chấp nhận từ nào cũng được.
  - Nhanh dần theo số từ đã bắn; chế độ chữ tăng dần tới 3 thẻ cùng lúc. Cứ 5 thẻ có 1 **boss** (từ nhiều âm tiết nhất, ×3 điểm). 3 mạng; thẻ chạm đáy mất 1 mạng. Hết mạng hiện điểm + bảng từ gõ sai.
  - Chọn nhóm từ: cả HSK 1 / từng bài học / **chỉ từ yếu** (từng gõ sai trong game hoặc từng quên khi ôn tập).
  - Từ sai (chạm đáy hoặc gõ sai) tích lũy **≥ 2 lần** tự vào ôn tập SRS. Kỷ lục cá nhân lưu riêng cho từng chế độ.
  - `requestAnimationFrame`, tự tạm dừng khi tab bị ẩn; `Esc` / nút ⏸ để tạm dừng.
- Logic game thuần trong `src/lib/pinyinGame.ts` (chấm pinyin, vòng chơi, tổng kết) — 17 test.

### Thay đổi
- Tiến độ thêm `gameRecords` và `wordMisses`. **Migration**: dữ liệu cũ không có hai trường này được gán rỗng khi đọc; giá trị sai kiểu bị bỏ.
- Menu desktop ở màn hình 768–1099px xuống dòng thay vì cuộn ngang làm khuất mục cuối.
- Test: 265.

## [0.11.0] — 2026-11-13 — Bước C: cấu trúc đề HSK 1 (3.0) theo tài liệu chính thức + 3 đề thi thử

### Thay đổi
- **C1 – Đối chiếu cấu trúc đề** với tài liệu chính thức của 汉考国际 (CTI) “新版HSK（1-6级）考试结构与样题示例” (12/2025, áp dụng 07/2026) và trang HSK 1 trên chinesetest.cn, kiểm tra ngày 13/11/2026. Cấu trúc cũ (tổng hợp từ nguồn bên thứ ba) sai ở nhiều phần, nay theo đúng tài liệu:
  - Nghe 20 câu (~12 phút): P1 nghe cụm từ chọn 1/3 hình · P2 nghe câu hỏi chọn câu trả lời · P3 nghe hội thoại chọn hình trong **bảng chung A–F** · P4 nghe câu + câu hỏi chọn 1/3.
  - Đọc 20 câu (20 phút): P1 đọc câu chọn hình trong bảng A–F · P2 ghép câu hỏi ↔ câu trả lời (A–F) · P3 chọn từ (A–F) điền chỗ trống · P4 đọc câu + câu hỏi ★ chọn 1/3. Không còn dạng Đúng/Sai.
  - `ExamConfig.verified` tách theo mục (`structure`, `timing`, `scoring`, `audioPlays`) + `sources` (nguồn, phạm vi, ngày kiểm tra). Tài liệu mới **không nêu** thang điểm và số lần phát âm thanh → vẫn dùng 200/120 và 2 lần như đề hiện hành, đánh dấu ⚠️ *chưa xác minh* trên trang Thi thử.
- Engine đề: dạng phần **bảng phương án chung** (`shared`, spec `{ bank, items }`); kiểm tra mỗi câu cùng bảng, không trùng đáp án; phần 3 phương án không được dồn đáp án vào một vị trí.
- Phòng thi: phần Nghe có bảng chung hiện cả 6 hình để chọn (phím 1–6 / A–F); phần Đọc và lúc xem lại phần Nghe hiện bảng một lần ở đầu phần, mỗi câu chỉ có nút A–F; màn kết quả hiện đủ bảng và tô đáp án đúng.

### Thêm
- **C2 – 2 đề mới** (`hsk1-3.0-02`, `hsk1-3.0-03`) — tổng 3 đề, đề 1 viết lại theo cấu trúc mới. Chỉ dùng từ HSK 1; test bảo đảm không câu nào (và không câu nghe/đọc nào) lặp giữa các đề.
- Test: 248.

## [0.10.0] — 2026-11-13 — Bước B3–B6: ví dụ, từ loại, quy trình duyệt, 12 bài đọc

### Thêm
- **B3 – Câu ví dụ cho mọi từ: 301/301** (trước: 185/301). Nguồn ví dụ của từ điển gồm câu soạn riêng (`examples-hsk1.tsv`, +77 câu mới) và toàn bộ câu luyện tập + ví dụ ngữ pháp của 43 bài học (429 câu). Mỗi từ lấy tối đa 2 câu, ưu tiên câu từ điển → câu của chính bài dạy từ đó → câu ngắn.
- **B4 – Từ loại & tách nghĩa (SPEC 3.14)**: `data/curated/pos-hsk1.tsv` (dự án tự soạn, 15 mã: danh từ, động từ, tính từ, phó từ, đại từ, số từ, lượng từ, giới từ, liên từ, trợ từ, thán từ, từ chỉ thời gian, từ phương vị, tên riêng, cụm từ giao tiếp) — không dùng nhãn từ loại của dữ liệu gốc vì quá nhiễu. `Word.pos`, `Word.senses` (tách nghĩa theo “;”). Thẻ từ hiện từ loại + các nghĩa; pop-up hiện nhãn từ loại và danh sách nghĩa đánh số. Build báo lỗi nếu từ nào thiếu từ loại.
- **B5 – Quy trình duyệt dữ liệu**: `npm run review:export` → `docs/review-hsk1.tsv` (stt, hanzi, pinyin, Hán Việt, nghĩa, từ loại, ví dụ, trạng thái, cột “duyet”, ghi chú; có BOM để mở bằng Excel). `npm run review:import [-- --dry-run]` đọc lại: áp sửa Hán Việt / nghĩa / từ loại, cột “duyet” = ok → `reviewed` (cột 5 của `hsk1.tsv`), sửa mà không “ok” → về nháp; kiểm tra số âm Hán Việt và từ loại trước khi ghi. Từ đã duyệt không còn nhãn “nháp” trong pop-up.
- **B6 – 12 bài đọc HSK 1** (+6: 今天几号, 我的学校, 看病, 我的房间, 去北京, 打电话), 82–103 chữ, 0% từ ngoài cấp. Mỗi bài gắn `unit` cùng chủ đề; thư viện sắp theo unit, lộ trình hiện “📖 Bài đọc cùng chủ đề” ở đầu mỗi unit.
- Test: 231.

## [0.9.0] — 2026-11-13 — Bước B1–B2: lộ trình HSK 1 đầy đủ + checkpoint

### Thêm
- **Lộ trình HSK 1 đầy đủ: 10 unit · 43 bài · 301/301 từ** (kế hoạch đã duyệt: `docs/plan-hsk1-units.md`). Mỗi từ dạy đúng một lần; mỗi bài 5–8 từ + 1 điểm ngữ pháp (giải thích tiếng Việt, 3 ví dụ) + 4 câu luyện tập + 2 câu nói theo. 39 bài mới cho Unit 2–10 (số đếm & ngày tháng, thời gian, gia đình, ăn uống, mua sắm, nơi chốn, trường học & công việc, đi lại, sức khỏe & giải trí) — dự án tự soạn, chỉ dùng từ HSK 1.
- Nội dung bài học tách thành mỗi unit một file: `data/curated/lessons/hsk1-u01.json` … `hsk1-u10.json`.
- **Checkpoint ôn tập sau mỗi 3 bài** (SPEC 3.5 v2), đánh số liên tục qua các unit (bài 3, 6, …, 42 → 14 checkpoint): ~12 câu trộn từ và câu của 3 bài trước (chọn nghĩa, nghe chọn chữ, chọn thanh, ghép cặp, điền từ, sắp xếp câu). Đạt ≥ 80% mới mở bài tiếp theo; chưa đạt thì gợi ý 3 bài cần ôn + nút **↻ Làm lại**. Hiện trong lộ trình ngay sau bài cuối; thi vượt unit cũng đánh dấu các checkpoint của unit đó.
- Lộ trình đánh số bài liên tục (1–43); tiêu đề bài hiện “Unit · Bài”.

### Thay đổi
- Phương án nhiễu bài điền từ loại thêm các nhóm thay thế được cho nhau (这儿/这里, 块/元, 能/可以/会, 很/非常/太/真, 一些/有些/有的…). Bài thiếu từ một chữ có thanh thì bài chọn thanh lấy từ đã học trước.
- Migration: người đã học xong bài 4 trước khi có checkpoint vẫn giữ bài 4 và mở được bài 5 (checkpoint 1 chỉ hiện là “Tiếp theo”).
- Test: 221.

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
