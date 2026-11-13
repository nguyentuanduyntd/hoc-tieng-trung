// Trang chủ = dashboard tiến độ (SPEC 3.10): việc nên làm hôm nay, streak, phút học / mục tiêu,
// số từ theo cấp HSK, lịch sử thi thử, gợi ý nguồn bổ trợ.

import { HSK_STANDARDS } from "../config/hsk.ts";
import { RESOURCES } from "../config/resources.ts";
import { getExamConfig } from "../config/exams.ts";
import { emptyDay, goalRatio, isResourceReady, lastDays, learnerStats, levelProgress, pickNextReading, todayPlan } from "../lib/dashboard.ts";
import { findCheckpoint, nextLesson } from "../lib/lessons.ts";
import { localDate } from "../lib/srs.ts";
import { state } from "../state.ts";
import type { ReadingsFile } from "../types.ts";
import { columnChart } from "../ui/charts.ts";
import { xpKpi } from "../ui/achievements.ts";
import { esc } from "../ui/html.ts";
import { reviewCounts } from "./review.ts";

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function homePage(readings: ReadingsFile | null, standardPicker: string): string {
  const p = state.progress;
  const std = HSK_STANDARDS[p.hskStandard];
  const today = localDate(new Date());
  const log = p.studyLog[today] ?? emptyDay();
  const { due, fresh } = reviewCounts();

  // Việc nên làm
  const lessonsFile = state.lessons;
  const nlId = lessonsFile ? nextLesson(lessonsFile, p.completedLessonIds) : undefined;
  const nl = nlId ? lessonsFile!.lessons.find((l) => l.id === nlId) : undefined;
  const ncp = nlId && lessonsFile ? findCheckpoint(lessonsFile, nlId) : undefined;
  const nr = readings ? pickNextReading(readings.readings, p.readingResults) : undefined;
  const plan = todayPlan({
    due,
    fresh,
    totalCards: p.cards.length,
    nextLesson: nl
      ? { id: nl.id, title: `Unit ${nl.unit} · Bài ${nl.order}: ${nl.title}` }
      : ncp
        ? { id: ncp.id, title: `Checkpoint ${ncp.order} — ôn tập 3 bài vừa học` }
        : undefined,
    nextReading: nr && { id: nr.id, title: `${nr.titleZh ?? ""} · ${nr.title}` },
    today: log,
  });

  // Mục tiêu ngày
  const minutes = Math.round(log.seconds / 60);
  const ratio = goalRatio(log.seconds, p.dailyGoalMinutes);

  // Biểu đồ phút học 7 ngày
  const days = lastDays(p.studyLog, today, 7);
  const minutesChart = columnChart({
    title: "Số phút học 7 ngày gần nhất",
    unit: "phút",
    columns: days.map((d, i) => ({
      label: i === days.length - 1 ? "Hôm nay" : WEEKDAYS[new Date(d.date + "T12:00:00").getDay()],
      value: d.minutes,
      tip: `${d.date}: ${d.minutes} phút`,
      showValue: i === days.length - 1,
    })),
    ref: { value: p.dailyGoalMinutes, label: `Mục tiêu ${p.dailyGoalMinutes} phút` },
    highlightIndex: days.length - 1,
    tableHeaders: ["Ngày", "Phút"],
  });

  // Tiến độ theo cấp
  const levels = state.vocab ? levelProgress(state.vocab.words, p.cards, p.hskStandard) : [];

  // Thi thử
  const examCfg = getExamConfig(p.hskStandard, 1);
  const attempts = p.examAttempts.slice(-8);
  const bestIdx = attempts.length ? attempts.reduce((bi, a, i, arr) => (a.score > arr[bi].score ? i : bi), 0) : -1;
  const examChart = attempts.length
    ? columnChart({
        title: "Điểm các lần thi thử gần nhất",
        unit: "điểm",
        columns: attempts.map((a, i) => ({
          label: `#${p.examAttempts.length - attempts.length + i + 1}`,
          value: a.score,
          tip: `${a.date} · ${a.examId}: ${a.score} điểm (nghe ${a.sectionScores.listening ?? "–"}, đọc ${a.sectionScores.reading ?? "–"})`,
          showValue: i === attempts.length - 1 || i === bestIdx,
        })),
        yMax: examCfg?.totalScore ?? 200,
        ref: examCfg ? { value: examCfg.passScore, label: `Đạt ${examCfg.passScore}` } : undefined,
        tableHeaders: ["Lần thi", "Điểm"],
      })
    : "";

  // Nguồn nên dùng ngay
  const stats = learnerStats(p, examCfg?.totalScore);
  const ready = RESOURCES.filter((r) => isResourceReady(r.id, stats) && r.id !== "pleco").slice(0, 3);

  return `
  <div class="dash-head">
    <div>
      <h1>Chào bạn 👋</h1>
      <p class="lead">Học tiếng Trung từ HSK 1 — có âm Hán Việt cho từng chữ.</p>
    </div>
    <div class="row">
      <div class="kpi"><span class="kpi-value">${p.streak}</span><span class="kpi-label">ngày liên tiếp 🔥</span></div>
      <div class="kpi"><span class="kpi-value">${minutes}<small>/${p.dailyGoalMinutes}</small></span><span class="kpi-label">phút hôm nay</span>
        <span class="goal-bar" role="progressbar" aria-valuenow="${Math.round(ratio * 100)}" aria-valuemin="0" aria-valuemax="100" aria-label="Mục tiêu ngày"><span style="width:${ratio * 100}%"></span></span></div>
      ${xpKpi()}
    </div>
  </div>

  <section class="section">
    <h2>Hôm nay nên làm gì</h2>
    <ol class="plan">
      ${plan.steps
        .map(
          (s, i) => `<li class="card plan-step ${s.done ? "done" : ""} ${plan.next === s ? "next" : ""}">
            <span class="plan-num" aria-hidden="true">${s.done ? "✓" : i + 1}</span>
            <span class="plan-info"><strong>${esc(s.title)}</strong><span class="muted small">${esc(s.detail)}</span></span>
            <a class="btn ${plan.next === s ? "primary" : ""}" href="${esc(s.href)}">${s.done ? "Mở" : plan.next === s ? "Bắt đầu" : "Mở"}</a>
          </li>`,
        )
        .join("")}
    </ol>
    ${plan.next ? "" : `<p class="feedback ok">Đã xong việc hôm nay 🎉 Muốn học thêm? Thử <a href="#/phat-am">luyện thanh điệu</a> hoặc <a href="#/thi-thu">thi thử</a>.</p>`}
  </section>

  <div class="dash-grid">
    <section class="card">
      <h2>Thời gian học</h2>
      <p class="muted small">Chỉ tính lúc đang mở trang học và có thao tác (hoặc đang nghe).</p>
      ${minutesChart}
    </section>

    <section class="card">
      <h2>Từ vựng theo cấp <span class="badge">${esc(std.label)}</span></h2>
      <div class="legend-row small"><span><i class="sw sw-known"></i>Đã thuộc</span><span><i class="sw sw-learning"></i>Đang học</span></div>
      <ul class="levels">
        ${levels
          .map((l) => {
            const pk = l.target ? (l.known / l.target) * 100 : 0;
            const pl = l.target ? (l.learning / l.target) * 100 : 0;
            const tip = `${l.label}: ${l.known} đã thuộc, ${l.learning} đang học / ${l.target} từ`;
            return `<li class="${l.available >= l.target * 0.5 ? "" : "no-data"}">
              <span class="lv-label">${esc(l.label)}</span>
              <span class="stack" tabindex="0" data-tip="${esc(tip)}" aria-label="${esc(tip)}">
                ${l.known ? `<span class="seg known" style="width:${pk}%"></span>` : ""}
                ${l.learning ? `<span class="seg learning" style="width:${pl}%"></span>` : ""}
              </span>
              <span class="lv-num small">${l.known + l.learning}/${l.target}${!l.available ? ` <span class="muted">· chưa có dữ liệu</span>` : l.available < l.target * 0.5 ? ` <span class="muted">· dữ liệu mới có ${l.available} từ</span>` : ""}</span>
            </li>`;
          })
          .join("")}
      </ul>
      <details class="chart-table"><summary>Xem dạng bảng</summary>
        <table><thead><tr><th>Cấp</th><th>Đã thuộc</th><th>Đang học</th><th>Mục tiêu</th><th>Có trong dữ liệu</th></tr></thead>
        <tbody>${levels.map((l) => `<tr><td>${esc(l.label)}</td><td>${l.known}</td><td>${l.learning}</td><td>${l.target}</td><td>${l.available}</td></tr>`).join("")}</tbody></table>
      </details>
      <p class="muted small">“Đã thuộc” = mọi thẻ của từ có độ ổn định ≥ 21 ngày. Mục tiêu theo chuẩn ${esc(std.label)}${std.verified ? "" : " (chưa đối chiếu chinesetest.cn)"}.</p>
    </section>

    <section class="card">
      <h2>Thi thử</h2>
      ${
        examChart ||
        `<p class="muted">Chưa có lần thi nào.</p><a class="btn" href="#/thi-thu">Làm đề thi thử đầu tiên</a>`
      }
      ${attempts.length ? `<a class="btn" href="#/thi-thu">Làm đề khác</a>` : ""}
    </section>

    <section class="card">
      <h2>Cài đặt nhanh</h2>
      <div class="toolbar">${standardPicker}</div>
      ${std.notes.map((n) => `<p class="small muted">${esc(n)}</p>`).join("")}
      <p class="small">Mục tiêu: ${p.dailyGoalMinutes} phút/ngày · ${p.newCardsPerDay} thẻ mới/ngày — <a href="#/tien-do">đổi</a></p>
      ${
        ready.length
          ? `<h3 class="small">Nguồn bổ trợ nên dùng bây giờ</h3><ul class="ready-list">${ready
              .map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)} ↗</a> <span class="muted small">— ${esc(r.whenToUse)}</span></li>`)
              .join("")}</ul>`
          : ""
      }
    </section>
  </div>
  ${state.loadError ? `<div class="notice">${esc(state.loadError)}</div>` : ""}
  ${state.persisted ? "" : `<div class="notice">Trình duyệt không cho lưu tiến độ (chế độ riêng tư?). Hãy xuất JSON ở trang Tiến độ để không mất dữ liệu.</div>`}`;
}
