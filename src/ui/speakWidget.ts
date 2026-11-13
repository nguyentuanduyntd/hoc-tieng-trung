// Khối "Nói theo câu mẫu": nghe mẫu -> nói -> chấm (nhận dạng) hoặc ghi âm & tự chấm (fallback).

import { scoreSpeech, SPEAK_PASS } from "../lib/grading.ts";
import { sameSound, setProgress, state } from "../state.ts";
import type { SentenceRef } from "../types.ts";
import { esc, zhTokens } from "./html.ts";
import { speak, speakSlow, ttsSupported } from "./speech.ts";
import { recognitionSupported, recognizeOnce, recordOnce, recorderSupported } from "./speechInput.ts";

export interface SpeakResult {
  /** 0..1; null = bỏ qua (không tính điểm). */
  score: number | null;
  method: "recognition" | "self" | "skip";
}

export function mountSpeakWidget(root: HTMLElement, s: SentenceRef, onResult: (r: SpeakResult) => void) {
  let finished = false;
  const finish = (r: SpeakResult) => {
    if (finished) return;
    finished = true;
    onResult(r);
  };

  const canRecognize = recognitionSupported();
  const canRecord = recorderSupported();

  function draw() {
    const consent = state.progress.speechRecognitionConsent;
    root.innerHTML = `
      <div class="speak-target">
        <div class="ex-zh big-zh">${zhTokens(s.tokens)}</div>
        <div class="ex-py">${esc(s.pinyin)}</div>
        <div class="ex-vi">${esc(s.vi)}</div>
      </div>
      <div class="row center">
        <button class="btn" data-sw="listen">🔊 Nghe mẫu</button>
        <button class="btn" data-sw="slow">🐢 Nghe chậm</button>
      </div>
      ${
        canRecognize && consent
          ? `<div class="row center"><button class="btn primary big-btn" data-sw="rec">🎤 Bấm rồi nói</button></div>`
          : canRecognize && !consent
            ? `<div class="notice small">
                 Chấm tự động dùng dịch vụ nhận dạng giọng nói của trình duyệt — <strong>âm thanh sẽ được gửi tới máy chủ của nhà cung cấp trình duyệt</strong> (Google với Chrome, Microsoft với Edge).
                 Nếu không muốn, hãy dùng ghi âm: bản ghi chỉ nằm trên máy bạn.
                 <div class="row" style="margin-top:8px">
                   <button class="btn primary" data-sw="consent">Đồng ý, chấm tự động</button>
                   ${canRecord ? `<button class="btn" data-sw="record">⏺ Ghi âm & tự chấm</button>` : ""}
                 </div>
               </div>`
            : canRecord
              ? `<p class="muted small center">Trình duyệt này không hỗ trợ chấm tự động — hãy ghi âm rồi so với mẫu.</p>
                 <div class="row center"><button class="btn primary big-btn" data-sw="record">⏺ Ghi âm</button></div>`
              : `<p class="muted small center">Trình duyệt không hỗ trợ micro. Hãy đọc to theo mẫu rồi tự chấm.</p>
                 <div class="row center"><button class="btn" data-sw="self-ok">Tôi đọc được</button><button class="btn" data-sw="self-bad">Chưa được</button></div>`
      }
      ${canRecognize && consent && canRecord ? `<p class="center small"><button class="link-btn" data-sw="record">Hoặc ghi âm & tự chấm</button></p>` : ""}
      <div class="speak-result" aria-live="polite"></div>
      <p class="center small"><button class="link-btn" data-sw="skip">Không nói được lúc này — bỏ qua</button></p>`;
  }

  const result = () => root.querySelector<HTMLElement>(".speak-result")!;

  async function doRecognize(btn: HTMLButtonElement) {
    btn.disabled = true;
    btn.textContent = "🎙️ Đang nghe… (nói xong sẽ tự dừng)";
    try {
      const alts = await recognizeOnce().result;
      const best = alts.map((a) => ({ a, r: scoreSpeech(s.zh, a, sameSound) })).sort((x, y) => y.r.score - x.r.score)[0];
      const pass = best.r.score >= SPEAK_PASS;
      result().innerHTML = `
        <div class="speak-chars">${best.r.chars.map((c) => `<span class="${c.ok ? "ok" : "bad"}">${esc(c.ch)}</span>`).join("")}</div>
        <p class="muted small">Máy nghe được: “${esc(best.a)}” · Điểm: ${Math.round(best.r.score * 100)}%</p>
        <p>${pass ? "✅ Tốt lắm!" : "Chữ màu đỏ chưa rõ — nghe mẫu và thử lại."}</p>
        <div class="row center">
          <button class="btn" data-sw="rec">Thử lại</button>
          <button class="btn primary" data-sw="accept" data-score="${best.r.score}">Tiếp tục</button>
        </div>`;
    } catch (e) {
      result().innerHTML = `<p class="bad-text">${esc((e as Error).message)}</p>
        <div class="row center"><button class="btn" data-sw="rec">Thử lại</button>${canRecord ? `<button class="btn" data-sw="record">Dùng ghi âm</button>` : ""}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "🎤 Bấm rồi nói";
    }
  }

  async function doRecord(btn: HTMLButtonElement | null) {
    const area = result();
    area.innerHTML = `<p>⏺ Đang ghi âm… <button class="btn" data-sw="stop">⏹ Dừng</button></p>`;
    const h = recordOnce();
    area.querySelector("[data-sw=stop]")!.addEventListener("click", () => h.stop(), { once: true });
    if (btn) btn.disabled = true;
    try {
      const rec = await h.result;
      area.innerHTML = `
        <p class="small muted">Nghe lần lượt bản ghi của bạn và câu mẫu, rồi tự đánh giá:</p>
        <div class="row center">
          <audio controls src="${rec.url}"></audio>
          <button class="btn" data-sw="listen">🔊 Mẫu</button>
        </div>
        <div class="row center">
          <button class="btn" data-sw="record">Ghi lại</button>
          <button class="btn" data-sw="self-bad">Chưa giống</button>
          <button class="btn primary" data-sw="self-ok">Giống mẫu</button>
        </div>`;
    } catch (e) {
      area.innerHTML = `<p class="bad-text">${esc((e as Error).message)}</p>
        <div class="row center"><button class="btn" data-sw="self-ok">Tôi đọc được</button><button class="btn" data-sw="self-bad">Chưa được</button></div>`;
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  root.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-sw]");
    if (!b || finished) return;
    switch (b.dataset.sw) {
      case "listen":
        speak(s.zh);
        break;
      case "slow":
        speakSlow(s.zh);
        break;
      case "consent":
        setProgress((p) => ({ ...p, speechRecognitionConsent: true }), { silent: true });
        draw();
        break;
      case "rec":
        doRecognize(root.querySelector<HTMLButtonElement>('[data-sw="rec"]') ?? b);
        break;
      case "record":
        doRecord(b);
        break;
      case "accept":
        finish({ score: Number(b.dataset.score), method: "recognition" });
        break;
      case "self-ok":
        finish({ score: 1, method: "self" });
        break;
      case "self-bad":
        finish({ score: 0, method: "self" });
        break;
      case "skip":
        finish({ score: null, method: "skip" });
        break;
    }
  });

  draw();
  if (ttsSupported()) speak(s.zh);
}
