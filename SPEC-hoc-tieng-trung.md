# SPEC v2: Nâng cấp web học tiếng Trung

> Tài liệu này dành cho **Claude Code**. Đọc hết trước khi code. Mục tiêu là đưa những điểm mạnh của các app/kênh miễn phí phổ biến (Mục 1) và các ý tưởng tham khảo từ **hihsk.com** (Mục 1b) vào web hiện có, để người học (người Việt, bắt đầu từ HSK 1) học được trọn vòng ngay trên web, còn các nguồn ngoài chỉ để bổ trợ.
>
> **v2 (13/11/2026):** thêm Mục 1b, các tính năng 3.12–3.18, cập nhật mô hình dữ liệu, kế hoạch triển khai và prompt khởi động.
> **v2.1:** thêm 3.19 Cài đặt giọng đọc (giọng Microsoft Neural miễn phí), giai đoạn 1b và prompt riêng cho phần giọng đọc.

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

## 1b. Ý tưởng tham khảo từ hihsk.com

hihsk.com là nền tảng học HSK tiếng Việt lớn (giáo trình HSK 2.0 + 3.0, game, chính tả, bộ thủ, thi thử, có app và gói VIP). Dùng nó làm **chuẩn so sánh**: học cách tổ chức và các dạng luyện tập, rồi làm tốt hơn ở những chỗ nó còn yếu.

> ⚠️ **Chỉ tham khảo ý tưởng.** Không sao chép nội dung, hình ảnh, giao diện, tên gọi riêng hay code của hihsk.com. Mọi nội dung đều tự soạn, giao diện giữ theo style của web hiện tại.

### Nên học theo

| Ý tưởng ở hihsk.com | Áp dụng cho web | Mục |
|---|---|---|
| Game "Mưa từ vựng": nghĩa tiếng Việt hoặc âm thanh rơi xuống, gõ pinyin để "bắn"; có boss theo mốc, nhân đôi điểm khi gõ đúng số thanh; theo dõi từ yếu; chơi không cần đăng nhập | Game gõ pinyin, từ yếu tự vào SRS | 3.12 |
| Chép chính tả theo cấp HSK, có bộ lọc cấp và trạng thái *Xong / Đang học / Chưa học* | Chính tả nghe → gõ, so khớp từng chữ | 3.13 |
| Trang bài từ vựng giàu thông tin: ảnh minh họa, từ loại, tách từng nghĩa, ví dụ có pinyin, link sang trang chi tiết chữ, nút "phát tất cả", in PDF luyện viết | Nâng cấp thẻ từ trong bài học + trang chi tiết chữ | 3.14 |
| 11 dạng bài tập mỗi bài (chọn nghĩa/pinyin/chữ, điền từ, nghe, flashcard, gõ, thứ tự nét, ghép cặp, quiz bộ thủ, tổng hợp); **bài ôn tổng hợp sau mỗi 3 bài** | Bổ sung dạng bài tập + checkpoint ôn tập | 3.5 (mở rộng) |
| Bộ thủ chia nhóm chủ đề (Con người, Thiên nhiên, Động vật...), có tiến độ theo nhóm, chiết tự, mẹo nhớ, luyện ngẫu nhiên | Module bộ thủ | 3.15 |
| Luyện viết trên ô Mễ tự cách, có chấm nét sai | Bảng luyện viết | 3.16 |
| Lộ trình Pinyin riêng, lượng từ, mẫu câu giao tiếp theo chủ đề, từ vựng theo chủ đề/chuyên ngành | Các khóa phụ | 3.17 |
| Bảng xếp hạng, XP | Kỷ lục cá nhân (BXH chỉ khi có backend) | 3.18 |
| Hỗ trợ cả HSK 2.0 và 3.0 | Đã có trong Mục 2 | 2 |

### Chỗ hihsk.com còn yếu, web mình làm tốt hơn

| Quan sát trên hihsk.com | Web mình làm |
|---|---|
| Trên trang bài từ vựng không thấy **âm Hán Việt** và **nút nghe từng từ** (chỉ có "phát tất cả") | Mỗi từ có Hán Việt + nút 🔊 riêng |
| Bài đọc HSK 4–6 rất ít (khoảng 2 bài mỗi cấp) | Thêm bài đọc đều cho các cấp khi mở rộng |
| Trang thi thử vẫn ghi số từ theo chuẩn 2.0 (150/300/600...) dù đã có HSK 3.0 | Mọi con số lấy từ config theo chuẩn đang chọn |
| Con số giới thiệu không khớp nhau (một chỗ "60+ đề", chỗ khác "500+ đề"); một số link ôn tập là link giữ chỗ | Không đưa số liệu chưa kiểm chứng; có test tự động bắt link chết |
| Phần lớn bài chính tả và SRS cần tài khoản hoặc VIP | Miễn phí, không cần đăng nhập, lưu trên trình duyệt + xuất/nhập JSON |
| Phụ đề bài chính tả được ghi là do AI tự sinh | Transcript phải được người duyệt trước khi đưa vào bài |

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
- Dạng bài tập (tối thiểu): chọn nghĩa, chọn pinyin, chọn Hán tự theo audio, ghép cặp, sắp xếp từ thành câu, điền từ, chọn thanh điệu, gõ pinyin, viết chữ theo nét, quiz bộ thủ, nói theo câu mẫu, flashcard, và bài **tổng hợp** trộn tất cả.
- **Checkpoint ôn tập sau mỗi 3 bài** (bài 3, 6, 9...): trộn từ và ngữ pháp của 3 bài trước, đạt ≥ 80% mới mở bài tiếp theo (có nút "làm lại").

#### 3.6 Luyện phát âm & thanh điệu
- Phát âm mẫu: qua module `speak()` dùng chung (xem 3.19): ưu tiên MP3 Microsoft Neural dựng sẵn, fallback giọng trình duyệt.
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

### Tính năng mới từ Mục 1b

#### 3.12 Game gõ pinyin (P1)
- Thẻ rơi từ trên xuống, hiện **nghĩa tiếng Việt** (chế độ chữ) hoặc **phát âm thanh** (chế độ nghe). Người chơi gõ pinyin, đúng thì thẻ nổ và hiện Hán tự + phát âm.
- Chấp nhận pinyin không dấu; gõ kèm số thanh đúng (`ni3hao3`) thì **nhân đôi điểm**.
- Tốc độ tăng dần; cứ 5 từ có một "boss" (từ dài hoặc cụm từ). Hết mạng thì kết thúc, hiện danh sách từ gõ sai.
- Chọn cấp HSK / bài học / "chỉ từ yếu". Từ sai ≥ 2 lần tự động vào SRS.
- Chơi không cần đăng nhập, lưu kỷ lục cá nhân. Dùng `requestAnimationFrame`, tự tạm dừng khi tab bị ẩn.

#### 3.13 Chép chính tả (P1)
- Nghe một câu (TTS hoặc audio đã duyệt) → gõ lại bằng **pinyin** hoặc **chữ Hán** (qua bộ gõ IME của máy).
- So khớp từng âm tiết/chữ, tô màu đúng/sai/thiếu. Có nút nghe lại, giảm tốc độ, gợi ý chữ đầu.
- Danh sách bài lọc theo cấp HSK, trạng thái *Xong / Đang học / Chưa học*.
- Câu lấy từ bài đọc và hội thoại tự soạn, transcript đã duyệt. Không tải hay cắt nội dung từ YouTube.

#### 3.14 Thẻ từ giàu thông tin + trang chi tiết chữ (P0, mở rộng 3.1–3.2)
- Thẻ từ trong bài: Hán tự lớn, pinyin, **Hán Việt**, **từ loại**, các nghĩa tách riêng từng dòng, 1–2 ví dụ có pinyin và nghĩa, nút 🔊 cho từ và cho từng ví dụ, ảnh minh họa (tùy chọn, chỉ dùng ảnh có giấy phép hoặc tự vẽ).
- Thanh công cụ bài học: **Phát tất cả** (đọc lần lượt từ + nghĩa), **In PDF luyện viết** (lưới Mễ tự cách, chữ mờ để tô theo).
- Trang `/chu/:hanzi`: thứ tự nét (hoạt ảnh), bộ thủ cấu thành, Hán Việt, các từ chứa chữ này theo cấp HSK, nút luyện viết.

#### 3.15 Bộ thủ (P1)
- Nhóm theo chủ đề (Con người, Thiên nhiên, Động vật, Hành động, Phương hướng, Đồ vật, Biểu tượng), mỗi nhóm có thanh tiến độ.
- Mỗi bộ: hình dạng gốc và biến thể (vd 水 → 氵), nghĩa, Hán Việt, số nét, thứ tự nét, mẹo nhớ ngắn (tự viết), 5–10 chữ ví dụ có link sang trang chi tiết chữ.
- Bài tập: nhận diện bộ trong chữ, ghép bộ thành chữ, nút "luyện ngẫu nhiên".
- Bắt đầu với khoảng 50 bộ thủ thông dụng nhất, mở rộng dần lên 214.

#### 3.16 Bảng luyện viết Mễ tự cách (P1)
- Canvas có lưới 米, dùng quiz mode của Hanzi Writer để chấm từng nét (sai thứ tự hoặc sai hướng thì báo và gợi ý).
- Chế độ: tô theo chữ mờ → viết có gợi ý → viết tự do. Hỗ trợ chuột, cảm ứng và bút.
- Ưu tiên các chữ thuộc danh sách viết tay của HSK 3.0 (Mục 2).

#### 3.17 Các khóa phụ (P2)
- **Lộ trình Pinyin** (làm trước HSK 1): thanh mẫu, vận mẫu, 4 thanh + thanh nhẹ, biến điệu, quy tắc viết pinyin. Mỗi bài có bài nghe-chọn.
- **Lượng từ**: mỗi lượng từ kèm danh từ đi cùng, ví dụ, bài tập chọn lượng từ đúng.
- **Mẫu câu giao tiếp** và **từ vựng theo chủ đề** (chào hỏi, mua sắm, công việc...), tái sử dụng engine bài học.

#### 3.18 Động lực: XP & kỷ lục (P2)
- XP cho mỗi hoạt động, huy hiệu theo mốc (streak 7/30 ngày, thuộc 300 từ HSK 1...).
- Không có backend: chỉ hiện kỷ lục và lịch sử cá nhân. **Bảng xếp hạng chỉ làm khi đã có backend và được yêu cầu.**

#### 3.19 Cài đặt giọng đọc, có giọng Microsoft miễn phí (P0)

**Hiện trạng:** trang Cài đặt đã có dropdown liệt kê giọng của trình duyệt (Web Speech API). Có 3 vấn đề:
1. Danh sách lẫn cả giọng **Quảng Đông (zh-HK)** và **phương ngữ** (`zh-CN-liaoning`, `zh-CN-shaanxi`), không phù hợp để học tiếng phổ thông.
2. Giọng **"Online (Natural)"** của Microsoft (晓晓 Xiaoxiao, 云希 Yunxi...) **chỉ xuất hiện khi mở web bằng Microsoft Edge**. Chrome, Firefox, Safari và điện thoại không có các giọng này, nên người dùng mỗi nơi nghe một kiểu.
3. Danh sách dài, không có nút nghe thử, không phân nhóm.

**Giải pháp: 2 nguồn giọng + chế độ Tự động**

| Nguồn | Cách hoạt động | Ưu điểm | Hạn chế |
|---|---|---|---|
| **A. Microsoft Neural (dựng sẵn)** | Lúc build, script gọi **Azure AI Speech** (gói Free F0, chính thức, khoảng 0,5 triệu ký tự/tháng cho giọng Neural) để tạo sẵn file MP3 cho mọi từ và ví dụ, rồi lưu thành file tĩnh | Giọng Natural giống nhau trên **mọi trình duyệt và điện thoại**, nghe offline được (cache), không lộ key | Chỉ có cho văn bản soạn sẵn; muốn đọc văn bản tùy ý thì cần backend (xem bên dưới) |
| **B. Giọng trình duyệt** | Web Speech API như hiện tại, có lọc và xếp hạng | Đọc được mọi câu, không tốn gì | Chất lượng tùy máy; giọng Natural chỉ có trên Edge |

**Chế độ Tự động (mặc định):** câu nào có file MP3 dựng sẵn thì phát file đó; không có thì dùng giọng trình duyệt tốt nhất theo thứ hạng: `Microsoft … Online (Natural) zh-CN` → `Microsoft Huihui/Yaoyao/Kangkang zh-CN` → `Google 普通话 zh-CN` → mọi giọng `zh-CN` khác → `zh-TW`.

**Script dựng audio (`scripts/build-audio`)**
- Đọc toàn bộ dữ liệu từ, ví dụ, bài đọc, chính tả → tạo MP3 cho **2 giọng**: nữ `zh-CN-XiaoxiaoNeural`, nam `zh-CN-YunxiNeural` (dùng tên giọng làm config, đổi được).
- Tên file theo hash nội dung + tên giọng (vd `audio/xiaoxiao/3f9a….mp3`) và có `audio/manifest.json`. **Chỉ tạo file mới hoặc file đã đổi** để tiết kiệm quota.
- Dùng SSML để chỉnh tốc độ và thêm khoảng nghỉ; với từ đa âm (vd 行 háng/xíng, 了 le/liǎo) dùng thẻ `<phoneme>` hoặc pinyin trong dữ liệu để đọc đúng.
- Key Azure chỉ nằm trong biến môi trường lúc build (`AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`), **không bao giờ đưa vào code phía client hay commit lên repo**. Thêm `.env.example`.
- In ra số ký tự đã dùng trong mỗi lần chạy. Lưu ý: kiểm tra trong tài liệu Azure cách tính ký tự cho chữ Hán (có thể một chữ Hán tính là 2 ký tự) và cách tính thẻ SSML, rồi ước lượng quota trước khi chạy cho cả HSK 1–6.
- Chạy được từng phần: `--level 1`, `--voice xiaoxiao`, `--dry-run` (chỉ đếm ký tự).

**Giao diện Cài đặt → Giọng đọc**
- **Nguồn giọng:** Tự động / Microsoft Neural (dựng sẵn) / Giọng trình duyệt.
- **Giọng Microsoft Neural:** Nữ (晓晓) / Nam (云希).
- **Giọng trình duyệt:** dropdown có `<optgroup>`: *Đề xuất* · *Microsoft Natural (cần mạng)* · *Giọng cài trên máy* · *Phổ thông Đài Loan (zh-TW)*. Giọng **Quảng Đông và phương ngữ ẩn mặc định**, chỉ hiện khi bật "Hiện giọng Quảng Đông/phương ngữ" kèm cảnh báo "không dùng để học tiếng phổ thông".
- Tên giọng hiển thị gọn: `晓晓 · Nữ · Natural · cần mạng` thay vì cả chuỗi dài.
- Nút **▶ Nghe thử** với câu mẫu `你好！欢迎你学习中文。`
- Thanh tốc độ 0.5x–1.5x (đã có), áp dụng cho cả hai nguồn (MP3 dùng `playbackRate`).
- Dòng gợi ý khi không có giọng Natural trong trình duyệt: "Muốn đọc mọi câu bằng giọng Natural, hãy mở web bằng Microsoft Edge. Từ vựng và ví dụ vẫn dùng giọng Microsoft dựng sẵn."
- Với hội thoại: người A dùng giọng nữ, người B dùng giọng nam.

**Yêu cầu kỹ thuật**
- Lắng nghe sự kiện `voiceschanged` (danh sách giọng tải chậm, nhất là trên Chrome và Edge).
- Lưu lựa chọn theo `voiceURI`. Nếu lần sau không còn giọng đó (đổi máy hoặc trình duyệt) thì tự quay về Tự động và báo nhẹ.
- Gom mọi chỗ phát âm vào **một module `speak(text, opts)`** dùng chung toàn site. Không gọi `speechSynthesis` rải rác.
- Gọi `speechSynthesis.cancel()` trước mỗi lần đọc mới. Câu dài thì chia nhỏ theo dấu câu (Chrome có lỗi tự dừng giữa chừng với câu dài).
- Giọng Natural online lỗi hoặc mất mạng → tự chuyển sang giọng offline.
- Có test cho logic xếp hạng và lọc giọng (dùng danh sách giọng mẫu như trong ảnh chụp: zh-CN, zh-TW, zh-HK, zh-CN-liaoning, zh-CN-shaanxi).

**Không dùng:** endpoint "Read Aloud" không chính thức của Edge (các thư viện kiểu `edge-tts`, `msedge-tts`). Endpoint này không có tài liệu, không có cam kết, Microsoft có thể chặn bất cứ lúc nào, và nó không chạy trực tiếp trên trình duyệt khác Edge.

**Tùy chọn sau này (cần backend):** một hàm serverless nhỏ gọi Azure để đọc văn bản tùy ý (công cụ dịch, câu người dùng tự nhập), có cache và giới hạn số lần gọi. Chỉ làm khi được yêu cầu.

---

## 4. Mô hình dữ liệu gợi ý (TypeScript)

```ts
type HskStandard = "2.0" | "3.0";

interface Word {
  id: string; hanzi: string; pinyin: string; pinyinNumbered: string;
  hanViet?: string; meaningEn?: string;
  senses: { partOfSpeech: string; meaningVi: string }[];   // tách từng nghĩa
  hsk2Level?: number; hsk3Level?: number; topics?: string[];
  examples: { zh: string; pinyin: string; vi: string; audioUrl?: string }[];
  audioUrl?: string; imageUrl?: string;
}

interface Radical {
  id: string; form: string; variants: string[]; meaningVi: string; hanViet: string;
  strokes: number; topic: string; mnemonicVi: string; exampleHanzi: string[];
}

interface DictationItem { id: string; hskLevel: number; zh: string; pinyin: string; vi: string; audioUrl?: string }

interface Lesson {
  id: string; hskLevel: number; unit: number; order: number; title: string;
  newWordIds: string[];
  grammar?: { pattern: string; explanationVi: string; examples: Word["examples"] };
  exercises: Exercise[];
}

type ExerciseType = "choose-meaning" | "choose-pinyin" | "listen-choose-hanzi" | "match-pairs"
  | "order-words" | "fill-blank" | "choose-tone" | "type-pinyin" | "write-stroke"
  | "radical-quiz" | "flashcard" | "speak" | "mixed";

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
  xp: number; badges: string[]; gameHighScores: Record<string, number>;
  dictationStatus: Record<string, "done" | "in-progress">;
  radicalProgress: Record<string, number>;   // topic -> % hoàn thành
  voice: {
    source: "auto" | "neural" | "browser";
    neuralVoice: "xiaoxiao" | "yunxi";
    browserVoiceURI?: string;
    rate: number;                 // 0.5–1.5
    showDialectVoices: boolean;   // mặc định false
  };
  examAttempts: { examId: string; date: string; score: number; sectionScores: Record<string, number> }[];
}
```

Nếu web hiện chỉ có frontend: lưu `UserProgress` vào localStorage (bọc try/catch) + xuất/nhập JSON. Không thêm backend khi chưa được yêu cầu.

---

## 5. Kế hoạch triển khai theo giai đoạn

Mỗi giai đoạn kết thúc bằng: chạy được, có test cho logic, cập nhật `CHANGELOG.md`, rồi **dừng lại báo cáo** trước khi sang giai đoạn sau.

| Giai đoạn | Nội dung | Hoàn thành khi |
|---|---|---|
| **1** | Mục 0 + dữ liệu từ HSK 1 (3.1, có từ loại và tách nghĩa) + config chuẩn HSK | Có `CURRENT_STATE.md`, `DATA_SOURCES.md`; dữ liệu HSK1 load được và đã kiểm tra hợp lệ |
| **1b** | Giọng đọc (3.19): module `speak()`, Cài đặt mới, script dựng audio cho HSK 1 | Giọng Quảng Đông/phương ngữ bị ẩn; nghe thử được; từ HSK 1 phát giọng 晓晓 giống nhau trên Chrome, Edge và điện thoại; key không có trong bundle |
| **2** | Pop-up từ điển (3.2) + thẻ từ & trang chi tiết chữ (3.14) + SRS (3.3) + xuất Anki (3.4) | Bấm từ bất kỳ → pop-up; mỗi từ có Hán Việt + 🔊; ôn thẻ đúng lịch; file xuất nhập được vào Anki |
| **3** | Lộ trình bài học HSK 1 với đủ dạng bài + checkpoint (3.5) + phát âm (3.6) + bảng luyện viết (3.16) | Học hết 1 unit HSK 1 đầu-cuối, qua được checkpoint; chấm nói có fallback |
| **4** | Game gõ pinyin (3.12) + chép chính tả (3.13) | Chơi được ở 2 chế độ, từ yếu vào SRS; ≥ 10 bài chính tả HSK 1 |
| **5** | Bài đọc (3.7) + nghe/shadowing (3.8) | ≥ 5 bài đọc HSK 1, đủ công cụ pinyin/dịch/audio/tốc độ |
| **6** | Thi thử theo config (3.9) | 1 đề HSK 1 chuẩn 3.0 hoàn chỉnh, chấm điểm, câu sai vào SRS |
| **7** | Bộ thủ (3.15) + khóa Pinyin (3.17) | ≥ 50 bộ thủ chia nhóm có bài tập; khóa Pinyin học được trọn vẹn |
| **8** | Dashboard + XP (3.10, 3.18) + nâng cấp mục nguồn (3.11) + lượng từ & mẫu câu (3.17) | Trang chủ hiện việc cần làm hôm nay, streak, XP, tiến độ theo cấp |

---

## 6. Yêu cầu chung

- Giao diện tiếng Việt; font hiển thị chữ Hán rõ (vd `Noto Sans SC`), cỡ chữ Hán ≥ 1.25 lần chữ Latin.
- Responsive, dùng tốt trên điện thoại (người học hay ôn trên mobile).
- Truy cập tốt: điều khiển bằng bàn phím được (phím số để chọn đáp án, Space để lật thẻ / phát audio).
- Không có tracking hay gửi dữ liệu người học ra ngoài.
- Test: unit test cho SRS, chấm điểm thi, tách/khớp pinyin (có/không dấu, có số thanh), so khớp chính tả, xuất Anki.
- **Test link chết**: script quét toàn bộ link nội bộ, fail nếu có link 404 hoặc `href="#"`.
- Không hiển thị số liệu "marketing" (số học viên, tỷ lệ đỗ...) nếu không có dữ liệu thật. Số bài, số từ, số đề đều đếm tự động từ dữ liệu.
- Không có tính năng nào bị khóa sau đăng nhập trừ khi được yêu cầu rõ.

---

## 7. Prompt khởi động (dán vào Claude Code)

```
Đọc kỹ file SPEC-hoc-tieng-trung.md (bản v2) ở thư mục gốc repo.

1. Làm Mục 0: khảo sát repo, viết docs/CURRENT_STATE.md, rồi lập bảng đối chiếu
   toàn bộ tính năng 3.1 → 3.18 với code hiện có, mỗi dòng ghi một trạng thái:
   ĐÃ CÓ / CẦN SỬA / LÀM MỚI, kèm file liên quan.
2. Gửi tôi bảng đó và kế hoạch cho Giai đoạn 1 (Mục 5) trước khi sửa code.
3. Sau khi tôi đồng ý: làm Giai đoạn 1, chạy test, cập nhật CHANGELOG.md,
   rồi dừng lại báo cáo. Mỗi giai đoạn sau cũng làm như vậy.

Ràng buộc:
- Giữ nguyên stack và style giao diện hiện có (dark theme, card bo góc, màu nhấn đỏ).
- Mục 1b chỉ để tham khảo ý tưởng: KHÔNG sao chép nội dung, hình ảnh, giao diện
  hay code của hihsk.com hoặc bất kỳ app nào khác.
- Không thêm backend, đăng nhập hay bảng xếp hạng khi tôi chưa yêu cầu.
- Mọi con số HSK lấy từ config theo chuẩn đang chọn (mặc định HSK 3.0).
- Chỗ nào chưa rõ (nguồn dữ liệu Hán Việt, giấy phép dữ liệu, có backend hay không...)
  thì hỏi tôi trước, không tự đoán.
```

### Prompt riêng: sửa ngay phần Giọng đọc (3.19)

```
Đọc mục 3.19 trong SPEC-hoc-tieng-trung.md. Trang Cài đặt hiện có dropdown "Giọng"
liệt kê toàn bộ giọng trình duyệt, lẫn cả giọng Quảng Đông (zh-HK) và phương ngữ
(zh-CN-liaoning, zh-CN-shaanxi); giọng Microsoft Natural chỉ có khi mở bằng Edge.

Hãy:
1. Tìm mọi chỗ đang gọi speechSynthesis / phát audio, gom về một module speak(text, opts).
2. Làm lại Cài đặt → Giọng đọc đúng theo 3.19: nguồn giọng (Tự động / Microsoft Neural
   dựng sẵn / Giọng trình duyệt), optgroup, ẩn Quảng Đông & phương ngữ mặc định,
   tên giọng rút gọn, nút Nghe thử, xử lý voiceschanged, fallback khi mất giọng đã chọn.
3. Viết scripts/build-audio dùng Azure AI Speech (gói Free F0), 2 giọng
   zh-CN-XiaoxiaoNeural và zh-CN-YunxiNeural, chỉ tạo file mới/đã đổi, có --dry-run
   để đếm ký tự. Key chỉ đọc từ biến môi trường, thêm .env.example, không commit key.
4. Chạy --dry-run cho HSK 1, báo tôi số ký tự ước tính trước khi chạy thật.
5. Viết test cho logic lọc/xếp hạng giọng.

Không dùng endpoint Read Aloud không chính thức của Edge (edge-tts, msedge-tts...).
Giữ nguyên style giao diện hiện tại. Hỏi tôi nếu chưa rõ stack hoặc cách deploy file audio.
```
