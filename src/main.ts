import "./styles.css";
import { HSK_STANDARDS, getLevelInfo, wordLevel, wordsAtLevel } from "./config/hsk.ts";
import { RESOURCES } from "./config/resources.ts";
import { getExamConfig } from "./config/exams.ts";
import { isResourceReady, learnerStats } from "./lib/dashboard.ts";
import { buildAnkiTxt, selectWords, type AnkiFilter } from "./lib/anki.ts";
import { exportProgressJson, importProgressJson } from "./lib/progress.ts";
import { posLabel } from "./lib/pos.ts";
import { searchWords } from "./lib/search.ts";
import { addWordCards } from "./lib/srs.ts";
import { installPlayerHandlers, lessonPlayerPage, lessonsListPage, mountLessonPlayer, mountLessonsList } from "./pages/lessons.ts";
import { mountPronunciation, pronunciationPage } from "./pages/pronunciation.ts";
import { examListPage, examRunPage, installExamHandlers, mountExamList, mountExamRun } from "./pages/exam.ts";
import { homePage } from "./pages/home.ts";
import { mountSettings, setVoiceFallbackNotice, settingsPage } from "./pages/settings.ts";
import { onVoicesChanged, savedVoiceMissing } from "./ui/speech.ts";
import { toast } from "./ui/toast.ts";
import { installReaderHandlers, loadReadings, mountReader, mountReadingList, readerPage, readingListPage } from "./pages/reading.ts";
import { mountReviewPage, reviewCounts, reviewPage } from "./pages/review.ts";
import { applyDeviceSettings, setSettings, loadLessons, loadVocab, setProgress, state, subscribe } from "./state.ts";
import type { HskStandard, ReadingsFile, Word } from "./types.ts";
import { installActivityTracker } from "./ui/activity.ts";
import { installChartTooltip } from "./ui/charts.ts";
import { esc, zhWord } from "./ui/html.ts";
import { inSrs, installPopupHandlers } from "./ui/popup.ts";
import { resourceHint } from "./ui/resourceHint.ts";

const app = document.getElementById("app")!;

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function standardPicker(): string {
  return `<label class="row"><span class="muted">Chuẩn HSK</span>
    <select id="std-select" aria-label="Chọn chuẩn HSK">
      ${Object.values(HSK_STANDARDS)
        .map((s) => `<option value="${s.id}" ${s.id === state.progress.hskStandard ? "selected" : ""}>${s.label}</option>`)
        .join("")}
    </select></label>`;
}

// ---------- Trang chủ (dashboard) ----------
let readingsFile: ReadingsFile | null = null;
const homeRoute = () => homePage(readingsFile, standardPicker());

// ---------- Từ vựng ----------
function vocabPage(): string {
  return `
  <h1>Từ vựng HSK 1</h1>
  <p class="lead">Tìm bằng Hán tự, pinyin có dấu, pinyin số (<code>ni3hao3</code>), pinyin không dấu, tiếng Việt hoặc âm Hán Việt.
    Nhấn <kbd>/</kbd> để tìm. Bấm vào chữ Hán để mở từ điển.</p>
  <div class="notice">Âm Hán Việt và nghĩa tiếng Việt là bản nháp do dự án tự soạn, đang chờ duyệt.</div>
  ${resourceHint(["dictionary"], "Gặp chữ lạ ngoài web?")}
  <div class="toolbar">
    <input type="search" id="q" placeholder="vd: 谢谢 · xiè xie · xie4xie5 · cảm ơn · tạ tạ" autocomplete="off" aria-label="Tìm từ" />
    ${standardPicker()}
    <button class="btn" id="add-all">+ Thêm cả cấp vào ôn tập</button>
  </div>
  <p class="muted" id="count" aria-live="polite"></p>
  <div class="word-list" id="list"></div>`;
}

function wordCard(w: Word): string {
  const lv = wordLevel(w, state.progress.hskStandard);
  const added = inSrs(w.id);
  return `<article class="card word">
    <div class="hanzi">${zhWord(w.hanzi, w.id)}</div>
    <div>
      <div class="pinyin">${esc(w.pinyin)}</div>
      <div class="hv">${esc(w.hanViet ?? "")}</div>
      <div class="meaning">${w.pos?.length ? `<span class="pos-tag">${esc(w.pos.map(posLabel).join(", "))}</span> ` : ""}${esc((w.senses ?? [w.meaningVi]).join(" · "))}</div>
    </div>
    <div class="word-btns">
      <button class="btn icon-btn" data-speak="${esc(w.hanzi)}" aria-label="Phát âm ${esc(w.hanzi)}" title="Phát âm">🔊</button>
      <button class="btn icon-btn" data-add-srs="${esc(w.id)}" ${added ? "disabled" : ""}
        aria-label="${added ? "Đã có trong ôn tập" : `Thêm ${esc(w.hanzi)} vào ôn tập`}" title="${added ? "Đã có trong ôn tập" : "Thêm vào ôn tập"}">${added ? "✓" : "+"}</button>
    </div>
    <div class="tags">
      ${lv ? `<span class="badge accent">${esc(getLevelInfo(state.progress.hskStandard, lv)?.label ?? "")}</span>` : `<span class="badge">ngoài ${esc(HSK_STANDARDS[state.progress.hskStandard].label)}</span>`}
      ${w.hsk3Level ? `<span class="badge">3.0: cấp ${w.hsk3Level}</span>` : ""}
      ${w.hsk2Level ? `<span class="badge">2.0: cấp ${w.hsk2Level}</span>` : ""}
    </div>
  </article>`;
}

function currentVocabList(): Word[] {
  const input = document.getElementById("q") as HTMLInputElement | null;
  if (!state.vocab) return [];
  const q = input?.value ?? "";
  return q.trim() ? searchWords(state.vocab.words, q, 300) : wordsAtLevel(state.vocab.words, state.progress.hskStandard, 1);
}

function renderVocabList() {
  const list = document.getElementById("list");
  const count = document.getElementById("count");
  const input = document.getElementById("q") as HTMLInputElement | null;
  if (!list || !count || !input) return;
  if (!state.vocab) {
    count.textContent = "Đang tải dữ liệu…";
    return;
  }
  const words = currentVocabList();
  count.textContent = input.value.trim()
    ? `${words.length} kết quả`
    : `${words.length} từ ${HSK_STANDARDS[state.progress.hskStandard].label} cấp 1`;
  list.innerHTML = words.map(wordCard).join("") || `<p class="muted">Không tìm thấy từ nào.</p>`;
}

// ---------- Nguồn miễn phí ----------
const CONTEXT_LABELS: Record<string, string> = {
  lesson: "học bài",
  reading: "đọc",
  listening: "nghe",
  exam: "thi thử",
  srs: "ôn tập",
  dictionary: "tra từ",
};

function resourcesPage(): string {
  const stats = learnerStats(state.progress, getExamConfig(state.progress.hskStandard, 1)?.totalScore);
  return `
  <h1>Nguồn miễn phí nên dùng kèm</h1>
  <p class="lead">Web là nơi học chính; các nguồn dưới đây để bổ trợ đúng lúc. Nhãn <span class="badge accent">Nên dùng ngay</span> dựa trên tiến độ của bạn.</p>
  <div class="grid">
    ${RESOURCES.map((r) => {
      const ready = isResourceReady(r.id, stats);
      return `<div class="card ${ready ? "highlight" : ""}">
        <h3>${esc(r.name)} ${ready ? `<span class="badge accent">Nên dùng ngay</span>` : ""}</h3>
        <p>${esc(r.strength)}</p>
        <div class="res-meta"><span class="badge">Cấp: ${esc(r.levels)}</span>${r.contexts.map((c) => `<span class="badge">sau khi ${esc(CONTEXT_LABELS[c] ?? c)}</span>`).join("")}</div>
        <p class="when"><strong>Dùng khi nào:</strong> ${esc(r.whenToUse)}</p>
        <a class="btn" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Mở ↗</a>
      </div>`;
    }).join("")}
  </div>`;
}

// ---------- Tiến độ, cài đặt SRS, xuất Anki ----------
function progressPage(): string {
  const p = state.progress;
  const std = HSK_STANDARDS[p.hskStandard];
  const learned = new Set(p.cards.filter((c) => c.reps > 0).map((c) => c.wordId)).size;
  return `
  <h1>Tiến độ & sao lưu</h1>
  <p class="lead">Tiến độ chỉ lưu trên trình duyệt này. Xuất file JSON để sao lưu hoặc chuyển sang máy khác.</p>
  <div class="grid">
    <div class="card">
      <h3>Tổng quan</h3>
      <p>Chuỗi ngày học: <strong>${p.streak}</strong> · Thẻ ôn: <strong>${p.cards.length}</strong> · Từ đã ôn ít nhất 1 lần: <strong>${learned}</strong></p>
      <p class="muted small">Chuẩn HSK đang dùng: ${esc(std.label)}</p>
    </div>
    <div class="card">
      <h3>Cài đặt học tập</h3>
      <p>Chuẩn HSK, mục tiêu mỗi ngày, số thẻ mới, loại thẻ ôn, giọng đọc và giao diện đã chuyển sang trang <a href="#/cai-dat">Cài đặt</a>.</p>
      <a class="btn" href="#/cai-dat">Mở Cài đặt</a>
    </div>
    <div class="card">
      <h3>Xuất sang Anki</h3>
      <label class="row field"><span>Cấp</span>
        <select id="anki-level">
          <option value="">Tất cả</option>
          ${std.levels.map((l) => `<option value="${l.level}" ${l.level === 1 ? "selected" : ""}>${esc(l.label)} (${esc(std.label)})</option>`).join("")}
        </select></label>
      <label class="row field"><span>Chọn từ</span>
        <select id="anki-filter">
          <option value="all">Tất cả từ của cấp</option>
          <option value="learned">Chỉ từ đã học</option>
          <option value="difficult">Từ hay sai</option>
        </select></label>
      <p class="muted small" id="anki-count"></p>
      <button class="btn primary" id="anki-export">Tải file .txt</button>
      <p class="muted small">Trong Anki: <em>File → Import</em>, chọn file vừa tải. Deck, cột và tag được nhận tự động.</p>
    </div>
    <div class="card">
      <h3>Sao lưu</h3>
      <p>Xuất / nhập toàn bộ tiến độ dạng JSON.</p>
      <div class="row">
        <button class="btn primary" id="export">Xuất JSON</button>
        <label class="btn">Nhập JSON<input type="file" id="import" accept="application/json,.json" hidden /></label>
      </div>
      <p class="muted" id="io-msg" aria-live="polite" style="margin-top:10px"></p>
    </div>
  </div>`;
}

function ankiOptions() {
  const lvRaw = (document.getElementById("anki-level") as HTMLSelectElement).value;
  const std = state.progress.hskStandard;
  return {
    level: lvRaw ? Number(lvRaw) : undefined,
    levelOf: (w: Word) => wordLevel(w, std),
    filter: (document.getElementById("anki-filter") as HTMLSelectElement).value as AnkiFilter,
    cards: state.progress.cards,
    standardTag: `hsk${std}`,
  };
}

function bindProgressPage() {
  const updateAnkiCount = () => {
    const n = state.vocab ? selectWords(state.vocab.words, ankiOptions()).length : 0;
    document.getElementById("anki-count")!.textContent = `${n} từ sẽ được xuất.`;
  };
  updateAnkiCount();
  document.getElementById("anki-level")!.addEventListener("change", updateAnkiCount);
  document.getElementById("anki-filter")!.addEventListener("change", updateAnkiCount);
  document.getElementById("anki-export")!.addEventListener("click", () => {
    if (!state.vocab) return;
    const o = ankiOptions();
    const txt = buildAnkiTxt(state.vocab.words, o);
    downloadText(`anki-hoc-tieng-trung-${o.level ? `hsk${o.level}` : "tat-ca"}-${o.filter}.txt`, txt, "text/plain;charset=utf-8");
  });

  const msg = () => document.getElementById("io-msg")!;
  document.getElementById("export")!.addEventListener("click", () => {
    downloadText(`tien-do-hoc-tieng-trung-${new Date().toISOString().slice(0, 10)}.json`, exportProgressJson(state.progress), "application/json");
    msg().textContent = "Đã xuất file.";
  });
  document.getElementById("import")!.addEventListener("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const imported = importProgressJson(await file.text());
      setProgress(() => imported);
      msg().textContent = state.persisted ? "Đã nhập tiến độ." : "Đã nhập, nhưng trình duyệt không cho lưu lâu dài (chế độ riêng tư?).";
    } catch {
      msg().textContent = "File không hợp lệ — cần file JSON xuất từ web này.";
    }
  });
}

// ---------- Router ----------
interface Route {
  render: (param: string) => string;
  mount?: (param: string) => void;
  /** Trang tự quản lý trạng thái (bài học, luyện phát âm): không vẽ lại khi tiến độ thay đổi. */
  stateful?: (param: string) => boolean;
}

const routes: Record<string, Route> = {
  home: { render: homeRoute },
  "tu-vung": {
    render: vocabPage,
    mount: () => {
      const input = document.getElementById("q") as HTMLInputElement;
      input.value = sessionQuery;
      input.addEventListener("input", () => {
        sessionQuery = input.value;
        renderVocabList();
      });
      document.getElementById("add-all")!.addEventListener("click", () => {
        const ids = currentVocabList().map((w) => w.id);
        setProgress((p) => {
          let cards = p.cards;
          const now = new Date();
          ids.forEach((id, i) => (cards = addWordCards(cards, id, p.srsCardTypes, new Date(now.getTime() + i))));
          return { ...p, cards };
        });
      });
      renderVocabList();
    },
  },
  "on-tap": { render: reviewPage, mount: mountReviewPage, stateful: () => true },
  "bai-hoc": {
    render: (param) => (param ? lessonPlayerPage() : lessonsListPage()),
    mount: (param) => void (param ? mountLessonPlayer(param) : mountLessonsList()),
    stateful: (param) => !!param,
  },
  "phat-am": { render: pronunciationPage, mount: mountPronunciation, stateful: () => true },
  "thi-thu": {
    render: (param) => (param ? examRunPage() : examListPage()),
    mount: (param) => void (param ? mountExamRun(param) : mountExamList()),
    stateful: (param) => !!param,
  },
  doc: {
    render: (param) => (param ? readerPage() : readingListPage()),
    mount: (param) => void (param ? mountReader(param) : mountReadingList()),
    stateful: (param) => !!param,
  },
  nguon: { render: resourcesPage },
  "tien-do": { render: progressPage, mount: bindProgressPage },
  "cai-dat": { render: settingsPage, mount: () => mountSettings(render) },
};
let sessionQuery = "";

function parseHash(): { route: string; param: string } {
  const path = location.hash.replace(/^#\/?/, "").split("?")[0];
  const [head, ...rest] = path.split("/");
  return head in routes ? { route: head, param: decodeURIComponent(rest.join("/")) } : { route: "home", param: "" };
}
const currentRoute = () => parseHash().route;
/** Trang stateful đã vẽ khi dữ liệu chưa tải xong -> cần vẽ lại một lần khi có dữ liệu. */
let renderedBeforeData = false;

function updateNav(route: string) {
  document.querySelectorAll<HTMLAnchorElement>(".nav a, .tabbar a, .more-panel a").forEach((a) => {
    const on = a.dataset.route === route;
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  // nút "Thêm" sáng lên khi đang ở một mục nằm trong danh sách "Thêm"
  const more = document.getElementById("more-btn");
  more?.classList.toggle("active", (more.dataset.moreRoutes ?? "").split(" ").includes(route));
  const { due, fresh } = reviewCounts();
  document.querySelectorAll<HTMLElement>("[data-due-badge]").forEach((b) => {
    b.textContent = String(due + fresh);
    b.hidden = due + fresh === 0;
  });
}

/** Danh sách "Thêm" của thanh tab điện thoại. */
function installMoreSheet() {
  const btn = document.getElementById("more-btn");
  const sheet = document.getElementById("more-sheet");
  if (!btn || !sheet) return;
  const setOpen = (open: boolean) => {
    sheet.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    if (open) sheet.querySelector<HTMLElement>("a")?.focus();
  };
  btn.addEventListener("click", () => setOpen(sheet.hidden));
  sheet.addEventListener("click", (e) => {
    // bấm ra ngoài khung hoặc chọn một mục -> đóng
    if (e.target === sheet || (e.target as HTMLElement).closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !sheet.hidden) {
      setOpen(false);
      btn.focus();
    }
  });
  window.addEventListener("hashchange", () => setOpen(false));
}

function render() {
  const { route, param } = parseHash();
  renderedBeforeData = !state.vocab;
  // giữ vị trí cuộn khi re-render cùng trang (vd sau khi thêm thẻ)
  const y = window.scrollY;
  app.innerHTML = routes[route].render(param);
  routes[route].mount?.(param);
  updateNav(route);
  window.scrollTo(0, y);
  document.getElementById("std-select")?.addEventListener("change", (e) => {
    setProgress((p) => ({ ...p, hskStandard: (e.target as HTMLSelectElement).value as HskStandard }));
  });
}

applyDeviceSettings();
installPopupHandlers();
installPlayerHandlers();
installMoreSheet();

// Giọng đã lưu không còn (đổi máy / đổi trình duyệt) -> về Tự động, báo nhẹ.
// Chờ danh sách giọng ổn định (Edge nạp giọng Natural online sau giọng trên máy).
let voiceCheckTimer: number | undefined;
const scheduleVoiceCheck = () => {
  window.clearTimeout(voiceCheckTimer);
  voiceCheckTimer = window.setTimeout(() => {
    if (!savedVoiceMissing()) return;
    setSettings((x) => ({ ...x, voiceURI: undefined }));
    const msg = "Giọng đọc đã chọn không có trên trình duyệt này — đã chuyển về Tự động.";
    setVoiceFallbackNotice(msg);
    toast(msg);
  }, 3000);
};
onVoicesChanged(scheduleVoiceCheck);
scheduleVoiceCheck();
installReaderHandlers();
installExamHandlers();
subscribe(() => {
  const { route, param } = parseHash();
  // trang ôn tập tự vẽ lại để không làm mất thẻ đang hiện
  if (route === "on-tap") mountReviewPage();
  // bài học / luyện phát âm: chỉ vẽ lại nếu lần trước dữ liệu chưa sẵn sàng
  else if (!routes[route].stateful?.(param) || (renderedBeforeData && state.vocab)) render();
  updateNav(route);
});
document.addEventListener("srs-changed", () => updateNav(currentRoute()));
document.addEventListener("keydown", (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
    const q = document.getElementById("q");
    if (q) {
      e.preventDefault();
      q.focus();
    }
  }
});
window.addEventListener("hashchange", () => {
  document.querySelector<HTMLDialogElement>("dialog.dict-popup[open]")?.close();
  render();
  window.scrollTo(0, 0);
  app.focus({ preventScroll: true });
});

render();
loadVocab();
Promise.all([loadLessons(), loadReadings()]).then(([, r]) => {
  readingsFile = r;
  if (currentRoute() === "home") render();
});
installActivityTracker(currentRoute);
installChartTooltip();
