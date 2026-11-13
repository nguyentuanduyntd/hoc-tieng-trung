# Audio dựng sẵn — giọng Microsoft Neural (SPEC 3.19, nguồn A)

Web phát file MP3 dựng sẵn cho từ vựng, câu ví dụ, câu luyện nói và ngữ pháp, bài đọc / chính tả, và phần Nghe của đề thi. Nhờ vậy giọng nghe giống nhau trên mọi trình duyệt và điện thoại. Câu nào không có file (hoặc tải file lỗi) thì đọc bằng giọng trình duyệt như trước.

- **Giọng:** nữ `zh-CN-XiaoxiaoNeural`, nam `zh-CN-YunxiNeural`. Đổi tên giọng trong `src/config/audio.ts`.
- **Nguồn:** Azure AI Speech, REST API chính thức, gói **Free F0**. Không dùng endpoint “Read Aloud” không chính thức của Edge (`edge-tts`, `msedge-tts`).
- **Vị trí file:** `public/audio/<giọng>/<hash>.mp3` và `public/audio/manifest.json`. Manifest ánh xạ văn bản sang hash.
- **Tên file:** băm từ tên giọng + nội dung SSML. Sửa chữ, sửa pinyin hay đổi giọng đều sinh file mới. Script chỉ tạo các file chưa có.

## Chạy

1. Tạo resource **Speech**, gói **Free F0**, trên portal.azure.com. Ở mục *Keys and Endpoint*, lấy **Key 1** và **Region**.
2. Chép `.env.example` thành `.env` rồi điền key và region. File `.env` đã nằm trong `.gitignore`, **không commit**. Cách khác: đặt biến môi trường `AZURE_SPEECH_KEY` và `AZURE_SPEECH_REGION`.
3. Chạy `npm run data`.
4. Chạy `npm run audio -- --dry-run`. Bước này chỉ đếm ký tự, không cần key và không gọi mạng.
5. Nên chạy thử trước: `npm run audio -- --voice female --limit 20`. Nghe vài file trong `public/audio/xiaoxiao/`.
6. Chạy thật: `npm run audio`, hoặc `--voice female` / `--voice male` để chạy từng giọng.
   - Gói F0 cho tối đa 20 yêu cầu mỗi phút, nên script tự giãn nhịp, khoảng 3,2 giây một file.
   - Ngắt giữa chừng không sao: lần chạy sau chỉ tạo các file còn thiếu.
7. Commit `public/audio/`. GitHub Pages phục vụ các file này như file tĩnh. Máy build trên CI không có key và không gọi Azure.

Tùy chọn khác:
- `--level N`: dữ liệu `hsk{N}.json`.
- `--prune`: xóa file không còn dùng, kết hợp được với `--dry-run`.

## Hạn mức và cách tính ký tự

Theo tài liệu Azure:
- **Mỗi chữ Hán tính 2 ký tự.**
- Chữ La-tinh, dấu câu và khoảng trắng tính phí.
- **Thẻ SSML tùy chỉnh** như `<phoneme>` và `<prosody>` cũng tính phí. Phần bọc `<speak>` / `<voice>` thì không.
- Chỉ yêu cầu thành công mới bị tính.

Vì vậy:
- Script **không dùng `<prosody>`**. Tốc độ do client chỉnh bằng `playbackRate`, có giữ cao độ.
- Script chỉ dùng `<phoneme alphabet="sapi">` cho **từ một chữ đa âm**, ví dụ 了 le5 hoặc 还 hái, để đọc đúng âm của từ trong từ điển.
- Ước lượng của script nghiêng về cao: dấu câu toàn khổ cũng tính 2.

Gói F0 có 0,5 triệu ký tự Neural mỗi tháng, giới hạn 20 yêu cầu / 60 giây, không điều chỉnh được.

Kết quả `--dry-run` cho HSK 1, ngày 13/11/2026:

| Phạm vi | Văn bản | File | Ký tự tính phí (ước lượng) | % hạn mức F0/tháng | Thời gian |
|---|---|---|---|---|---|
| 1 giọng (nữ) | 861 | 861 | 10.974 | 2,2% | ~46 phút |
| 2 giọng | 861 | 1.722 | 21.948 | 4,4% | ~91 phút |

861 văn bản gồm:
- 301 từ, trong đó 14 từ có `<phoneme>`;
- 315 câu ví dụ;
- 54 câu bài học;
- 111 câu bài đọc / chính tả;
- 79 câu phần Nghe của 3 đề;
- 1 câu nghe thử.

## Lưu ý điều khoản

Có ý kiến trên Microsoft Q&A, không phải tài liệu chính thức, rằng audio tạo bằng gói F0 không đi kèm quyền dùng thương mại. Dự án này là web học cá nhân, phi thương mại. Nếu sau này dùng thương mại, cần đọc *Microsoft Product Terms* hoặc chuyển sang gói S0.

Nguồn đã xem ngày 13/11/2026:
- [Quotas and limits – Azure Speech](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-services-quotas-and-limits)
- [Text to speech overview (billable characters)](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech)
- [Pricing – Azure Speech](https://azure.microsoft.com/en-us/pricing/details/speech/)
- [Speech phonetic alphabets (SAPI zh-CN)](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-ssml-phonetic-sets)
