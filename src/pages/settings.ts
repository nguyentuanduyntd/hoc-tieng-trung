// Trang Cài đặt (#/cai-dat): giọng đọc, giao diện, cỡ chữ Hán (theo thiết bị) + cài đặt học tập (theo tiến độ).

import { HSK_STANDARDS } from "../config/hsk.ts";
import { RATE_MAX, RATE_MIN, ZH_SIZE_LABELS, clampRate, defaultSettings, type Theme, type ZhSize } from "../lib/settings.ts";
import { CARD_TYPE_LABELS, addWordCards, type CardType } from "../lib/srs.ts";
import { setProgress, setSettings, state } from "../state.ts";
import type { HskStandard } from "../types.ts";
import { esc } from "../ui/html.ts";
import { groupVoices, hasNaturalVoice, rankVoices, type VoiceInfo } from "../lib/voices.ts";
import { onVoicesChanged, rankedVoices, speakWithVoice, ttsSupported, voicesLoaded } from "../ui/speech.ts";
import { recognitionSupported } from "../ui/speechInput.ts";

/** Câu nghe thử theo SPEC 3.19. */
const SAMPLE = "你好！欢迎你学习中文。";

/** Báo nhẹ một lần: giọng đã lưu không còn trên trình duyệt này nên đã về Tự động. */
let fallbackNotice = "";
export function setVoiceFallbackNotice(msg: string) {
  fallbackNotice = msg;
}

/** Mọi giọng của trình duyệt (chưa lọc) — để đếm giọng phương ngữ. */
function browserVoices(): SpeechSynthesisVoice[] {
  return ttsSupported() ? speechSynthesis.getVoices() : [];
}

/** Tắt phương ngữ mà giọng đang chọn là phương ngữ -> về Tự động. */
function stillValidWithoutDialects(uri: string | undefined): string | undefined {
  if (!uri) return undefined;
  return rankVoices(browserVoices()).some((x) => x.voice.voiceURI === uri) ? uri : undefined;
}

function voiceSection(): string {
  const s = state.settings;
  if (!ttsSupported()) return `<p class="notice">Trình duyệt này không hỗ trợ đọc văn bản (Web Speech API). Hãy dùng Edge, Chrome hoặc Safari.</p>`;
  const ranked = rankedVoices();
  // nhãn "Tự động" = giọng mà chế độ Tự động sẽ dùng (hạng cao nhất), không phải giọng đang chọn
  const primary = ranked[0];
  const groups = groupVoices(ranked);
  const auto = !s.voiceURI;
  const opt = (x: VoiceInfo) =>
    `<option value="${esc(x.voice.voiceURI)}" ${!auto && x.voice.voiceURI === s.voiceURI ? "selected" : ""} title="${esc(x.voice.name)} (${esc(x.voice.lang)})">${esc(x.label)}</option>`;
  const dialectCount = rankVoices(browserVoices(), { showDialects: true }).filter((x) => x.variant === "dialect" || x.variant === "cantonese").length;
  const status = !voicesLoaded()
    ? `<p class="muted small">Đang tải danh sách giọng…</p>`
    : !ranked.length
      ? `<p class="notice">Chưa tìm thấy giọng tiếng phổ thông. Trên Windows: Cài đặt → Thời gian & ngôn ngữ → Giọng nói → thêm giọng “Chinese (Simplified)”, rồi tải lại trang. Hoặc mở web bằng Microsoft Edge.</p>`
      : "";
  return `
      <p class="muted">Web dùng giọng tiếng Trung có sẵn trong trình duyệt/hệ điều hành.${ranked.length ? ` Có ${ranked.length} giọng tiếng phổ thông dùng được.` : ""}</p>
      ${status}
      ${fallbackNotice ? `<p class="notice small">${esc(fallbackNotice)}</p>` : ""}
      <div class="setting-row">
        <label for="voice-select">Giọng:</label>
        <select id="voice-select" ${ranked.length ? "" : "disabled"}>
          <option value="" ${auto ? "selected" : ""}>Tự động${primary ? ` — ${esc(primary.label)}` : ""}</option>
          ${groups.map((g) => `<optgroup label="${esc(g.label)}">${g.items.map(opt).join("")}</optgroup>`).join("")}
        </select>
      </div>
      <div class="setting-row">
        <label for="rate-input">Tốc độ:</label>
        <input type="number" id="rate-input" min="${RATE_MIN}" max="${RATE_MAX}" step="0.05" value="${s.rate}" />
        <button class="btn" id="voice-test" ${ranked.length ? "" : "disabled"}>▶ Nghe thử</button>
      </div>
      ${
        ranked.length && !hasNaturalVoice(ranked)
          ? `<p class="small hint">💡 Muốn giọng tự nhiên hơn (晓晓, 云希 – Natural), hãy mở web bằng <strong>Microsoft Edge</strong>: Edge có sẵn giọng Microsoft Natural miễn phí (cần mạng).</p>`
          : ""
      }
      <label class="check"><input type="checkbox" id="show-dialects" ${s.showDialects ? "checked" : ""} /> Hiện giọng Quảng Đông / phương ngữ${dialectCount ? ` (${dialectCount})` : ""}</label>
      ${
        s.showDialects
          ? `<p class="notice small">⚠️ Giọng Quảng Đông và phương ngữ (Liêu Ninh, Thiểm Tây…) <strong>không dùng để học tiếng phổ thông</strong>: phát âm và thanh điệu khác chuẩn HSK. Chế độ Tự động và hội thoại không bao giờ dùng các giọng này.</p>`
          : ""
      }
      <p class="muted small">“Tự động” chọn giọng tốt nhất: Microsoft Natural → Huihui/Yaoyao/Kangkang → Google 普通话 → giọng zh-CN khác → zh-TW. Tốc độ là “1x” của trình đọc bài. Hội thoại: người nói thứ hai dùng giọng khác giới.</p>
      <p class="saved-msg small" id="voice-msg" aria-live="polite"></p>`;
}

export function settingsPage(): string {
  const s = state.settings;
  const p = state.progress;
  const pressed = (on: boolean) => `aria-pressed="${on}"`;
  return `
  <div class="settings">
    <h1>Cài đặt</h1>

    <section class="card" aria-labelledby="set-voice">
      <h2 id="set-voice">Giọng đọc</h2>
      <div id="voice-section">${voiceSection()}</div>
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

  // Danh sách giọng nạp muộn -> chỉ vẽ lại khối giọng đọc, khi danh sách thực sự đổi, ở tick sau.
  unsubscribeVoices?.();
  const sig = () => JSON.stringify(rankedVoices().map((x) => x.voice.voiceURI));
  let shown = sig();
  const redrawVoice = () => {
    const el = document.getElementById("voice-section");
    if (!el) return;
    el.innerHTML = voiceSection();
    shown = sig();
    bindVoice();
  };
  unsubscribeVoices = onVoicesChanged(() => {
    if (document.getElementById("voice-section") && sig() !== shown) setTimeout(redrawVoice, 0);
  });

  function bindVoice() {
    const rateInput = document.getElementById("rate-input") as HTMLInputElement | null;
    const currentRate = () => (rateInput ? clampRate(rateInput.value) : undefined);
    document.getElementById("voice-select")?.addEventListener("change", (e) => {
      const uri = (e.target as HTMLSelectElement).value || undefined;
      fallbackNotice = "";
      setSettings((x) => ({ ...x, voiceURI: uri }));
      speakWithVoice(SAMPLE, uri, currentRate());
      flash("voice-msg", uri ? "Đã lưu giọng đọc." : "Đã chuyển về Tự động.");
    });
    rateInput?.addEventListener("change", () => {
      const r = clampRate(rateInput.value);
      rateInput.value = String(r);
      setSettings((x) => ({ ...x, rate: r }));
      flash("voice-msg", `Đã lưu tốc độ ${r}.`);
    });
    document.getElementById("voice-test")?.addEventListener("click", () => {
      // dùng giọng & tốc độ đang hiển thị (kể cả khi chưa rời ô tốc độ)
      const uri = (document.getElementById("voice-select") as HTMLSelectElement | null)?.value || undefined;
      speakWithVoice(SAMPLE, uri, currentRate());
    });
    document.getElementById("show-dialects")?.addEventListener("change", (e) => {
      const on = (e.target as HTMLInputElement).checked;
      setSettings((x) => ({ ...x, showDialects: on, voiceURI: on ? x.voiceURI : stillValidWithoutDialects(x.voiceURI) }));
      redrawVoice();
    });
  }
  bindVoice();

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
