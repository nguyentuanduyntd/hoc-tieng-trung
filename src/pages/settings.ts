// Trang Cài đặt (#/cai-dat): giọng đọc, giao diện, cỡ chữ Hán (theo thiết bị) + cài đặt học tập (theo tiến độ).

import { HSK_STANDARDS } from "../config/hsk.ts";
import { RATE_MAX, RATE_MIN, ZH_SIZE_LABELS, clampRate, defaultSettings, type Theme, type ZhSize } from "../lib/settings.ts";
import { CARD_TYPE_LABELS, addWordCards, type CardType } from "../lib/srs.ts";
import { setProgress, setSettings, state } from "../state.ts";
import type { HskStandard } from "../types.ts";
import { esc } from "../ui/html.ts";
import { onVoicesChanged, speak, ttsSupported, zhVoices } from "../ui/speech.ts";
import { recognitionSupported } from "../ui/speechInput.ts";

const SAMPLE = "你好，谢谢！我在学习汉语。";

export function settingsPage(): string {
  const s = state.settings;
  const p = state.progress;
  const voices = ttsSupported() ? zhVoices() : [];
  const selected = s.voiceURI && voices.some((v) => v.voiceURI === s.voiceURI) ? s.voiceURI : voices[0]?.voiceURI;
  const pressed = (on: boolean) => `aria-pressed="${on}"`;
  return `
  <div class="settings">
    <h1>Cài đặt</h1>

    <section class="card" aria-labelledby="set-voice">
      <h2 id="set-voice">Giọng đọc</h2>
      ${
        !ttsSupported()
          ? `<p class="notice">Trình duyệt này không hỗ trợ đọc văn bản (Web Speech API). Hãy dùng Chrome, Edge hoặc Safari.</p>`
          : voices.length
            ? `<p class="muted">Web dùng giọng tiếng Trung có sẵn trong trình duyệt/hệ điều hành. Tìm thấy ${voices.length} giọng tiếng Trung.</p>`
            : `<p class="notice">Chưa tìm thấy giọng tiếng Trung. Trên Windows: Cài đặt → Thời gian & ngôn ngữ → Giọng nói → thêm giọng “Chinese (Simplified)”, rồi tải lại trang.</p>`
      }
      <div class="setting-row">
        <label for="voice-select">Giọng:</label>
        <select id="voice-select" ${voices.length ? "" : "disabled"}>
          ${voices.map((v) => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === selected ? "selected" : ""}>${esc(v.name)} (${esc(v.lang)})</option>`).join("")}
        </select>
      </div>
      <div class="setting-row">
        <label for="rate-input">Tốc độ:</label>
        <input type="number" id="rate-input" min="${RATE_MIN}" max="${RATE_MAX}" step="0.05" value="${s.rate}" />
        <button class="btn" id="voice-test" ${ttsSupported() ? "" : "disabled"}>🔊 Thử</button>
      </div>
      <p class="muted small">Tốc độ này là “1x” của trình đọc bài và là tốc độ mặc định ở mọi nút 🔊. Hội thoại dùng thêm các giọng khác để phân biệt người nói.</p>
      <p class="saved-msg small" id="voice-msg" aria-live="polite"></p>
    </section>

    <section class="card" aria-labelledby="set-ui">
      <h2 id="set-ui">Giao diện</h2>
      <div class="seg-btns" role="group" aria-label="Giao diện sáng hoặc tối">
        ${(["light", "dark"] as Theme[])
          .map((t) => `<button class="btn" data-theme-btn="${t}" ${pressed(s.theme === t)}>${t === "light" ? "☀️ Sáng" : "🌙 Tối"}</button>`)
          .join("")}
      </div>
      <h3>Cỡ chữ Hán</h3>
      <p class="muted small">Phóng to chữ Hán trong bảng từ vựng, thẻ ôn tập, bài đọc và đề thi. Chữ tiếng Việt giữ nguyên.</p>
      <div class="seg-btns" role="group" aria-label="Cỡ chữ Hán">
        ${(Object.keys(ZH_SIZE_LABELS) as ZhSize[])
          .map((z) => `<button class="btn" data-zh-btn="${z}" ${pressed(s.zhSize === z)}>${ZH_SIZE_LABELS[z]}</button>`)
          .join("")}
        <span class="zh-preview" lang="zh-CN" aria-label="Xem trước">你好，谢谢</span>
      </div>
    </section>

    <section class="card" aria-labelledby="set-study">
      <h2 id="set-study">Học tập</h2>
      <div class="setting-row">
        <label for="std-select-2">Chuẩn HSK:</label>
        <select id="std-select-2">
          ${Object.values(HSK_STANDARDS).map((x) => `<option value="${x.id}" ${x.id === p.hskStandard ? "selected" : ""}>${x.label}</option>`).join("")}
        </select>
      </div>
      <div class="setting-row">
        <label for="daily-goal">Mục tiêu mỗi ngày (phút):</label>
        <input type="number" id="daily-goal" min="1" max="240" value="${p.dailyGoalMinutes}" />
      </div>
      <div class="setting-row">
        <label for="new-per-day">Thẻ mới mỗi ngày:</label>
        <input type="number" id="new-per-day" min="0" max="100" value="${p.newCardsPerDay}" />
      </div>
      <fieldset class="field"><legend class="muted">Loại thẻ tạo khi thêm từ vào ôn tập</legend>
        ${(Object.keys(CARD_TYPE_LABELS) as CardType[])
          .map((t) => `<label class="check"><input type="checkbox" name="card-type" value="${t}" ${p.srsCardTypes.includes(t) ? "checked" : ""}/> ${esc(CARD_TYPE_LABELS[t])}</label>`)
          .join("")}
      </fieldset>
      <button class="btn" id="apply-types">Thêm loại thẻ mới cho các từ đã có</button>
      <p class="saved-msg small" id="study-msg" aria-live="polite"></p>
    </section>

    <section class="card" aria-labelledby="set-privacy">
      <h2 id="set-privacy">Quyền riêng tư</h2>
      <p class="muted small">Web không gửi dữ liệu học của bạn đi đâu. Riêng chấm nói tự động dùng dịch vụ nhận dạng của trình duyệt: âm thanh được gửi tới máy chủ của nhà cung cấp trình duyệt (Google với Chrome, Microsoft với Edge).</p>
      <label class="check"><input type="checkbox" id="speech-consent" ${p.speechRecognitionConsent ? "checked" : ""} ${recognitionSupported() ? "" : "disabled"}/>
        Cho phép chấm nói tự động${recognitionSupported() ? "" : " (trình duyệt này không hỗ trợ)"}</label>
      <p class="muted small">Tắt thì khi luyện nói web dùng ghi âm & tự chấm (bản ghi chỉ ở trên máy).</p>
    </section>

    <section class="card" aria-labelledby="set-data">
      <h2 id="set-data">Dữ liệu</h2>
      <p class="muted small">Sao lưu / chuyển máy và xuất Anki ở trang <a href="#/tien-do">Tiến độ</a>. Giọng đọc, giao diện và cỡ chữ lưu riêng trên trình duyệt này.</p>
      <button class="btn" id="reset-device">Khôi phục cài đặt giao diện & giọng đọc mặc định</button>
    </section>
  </div>`;
}

let unsubscribeVoices: (() => void) | null = null;

export function mountSettings(rerender: () => void) {
  const flash = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  // Danh sách giọng có thể nạp muộn -> vẽ lại khi trình duyệt báo có giọng mới.
  unsubscribeVoices?.();
  const shownCount = ttsSupported() ? zhVoices().length : 0;
  unsubscribeVoices = onVoicesChanged(() => {
    // chỉ vẽ lại khi số giọng thực sự đổi, và làm ở tick sau (không vẽ lại ngay trong sự kiện)
    if (document.getElementById("voice-select") && zhVoices().length !== shownCount) setTimeout(rerender, 0);
  });

  document.getElementById("voice-select")?.addEventListener("change", (e) => {
    const uri = (e.target as HTMLSelectElement).value;
    setSettings((s) => ({ ...s, voiceURI: uri }));
    speak(SAMPLE);
    flash("voice-msg", "Đã lưu giọng đọc.");
  });
  const rateInput = document.getElementById("rate-input") as HTMLInputElement;
  rateInput.addEventListener("change", () => {
    const r = clampRate(rateInput.value);
    rateInput.value = String(r);
    setSettings((s) => ({ ...s, rate: r }));
    flash("voice-msg", `Đã lưu tốc độ ${r}.`);
  });
  document.getElementById("voice-test")?.addEventListener("click", () => {
    // dùng giá trị đang nhập (kể cả khi chưa rời ô)
    speak(SAMPLE, clampRate(rateInput.value));
  });

  document.querySelectorAll<HTMLButtonElement>("[data-theme-btn]").forEach((b) =>
    b.addEventListener("click", () => {
      setSettings((s) => ({ ...s, theme: b.dataset.themeBtn as Theme }));
      rerender();
    }),
  );
  document.querySelectorAll<HTMLButtonElement>("[data-zh-btn]").forEach((b) =>
    b.addEventListener("click", () => {
      setSettings((s) => ({ ...s, zhSize: b.dataset.zhBtn as ZhSize }));
      document.querySelectorAll<HTMLButtonElement>("[data-zh-btn]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    }),
  );

  document.getElementById("std-select-2")!.addEventListener("change", (e) => {
    setProgress((p) => ({ ...p, hskStandard: (e.target as HTMLSelectElement).value as HskStandard }), { silent: true });
    flash("study-msg", "Đã đổi chuẩn HSK.");
  });
  document.getElementById("daily-goal")!.addEventListener("change", (e) => {
    const v = Math.max(1, Math.min(240, Math.round(Number((e.target as HTMLInputElement).value) || 10)));
    (e.target as HTMLInputElement).value = String(v);
    setProgress((p) => ({ ...p, dailyGoalMinutes: v }), { silent: true });
    flash("study-msg", `Đã lưu: mục tiêu ${v} phút mỗi ngày.`);
  });
  document.getElementById("new-per-day")!.addEventListener("change", (e) => {
    const v = Math.max(0, Math.min(100, Math.round(Number((e.target as HTMLInputElement).value) || 0)));
    (e.target as HTMLInputElement).value = String(v);
    setProgress((p) => ({ ...p, newCardsPerDay: v }), { silent: true });
    flash("study-msg", `Đã lưu: ${v} thẻ mới mỗi ngày.`);
  });
  document.querySelectorAll<HTMLInputElement>('input[name="card-type"]').forEach((cb) =>
    cb.addEventListener("change", () => {
      const types = [...document.querySelectorAll<HTMLInputElement>('input[name="card-type"]:checked')].map((x) => x.value as CardType);
      if (!types.length) {
        cb.checked = true;
        return flash("study-msg", "Cần chọn ít nhất một loại thẻ.");
      }
      setProgress((p) => ({ ...p, srsCardTypes: types }), { silent: true });
      flash("study-msg", "Đã lưu loại thẻ.");
    }),
  );
  document.getElementById("apply-types")!.addEventListener("click", () => {
    const before = state.progress.cards.length;
    setProgress(
      (p) => {
        const now = new Date();
        let cards = p.cards;
        for (const id of new Set(p.cards.map((c) => c.wordId))) cards = addWordCards(cards, id, p.srsCardTypes, now);
        return { ...p, cards };
      },
      { silent: true },
    );
    flash("study-msg", `Đã thêm ${state.progress.cards.length - before} thẻ.`);
  });

  document.getElementById("speech-consent")?.addEventListener("change", (e) => {
    const on = (e.target as HTMLInputElement).checked;
    setProgress((p) => ({ ...p, speechRecognitionConsent: on }), { silent: true });
  });
  document.getElementById("reset-device")!.addEventListener("click", () => {
    setSettings(() => defaultSettings());
    rerender();
  });
}
