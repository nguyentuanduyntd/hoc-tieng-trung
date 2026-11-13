// Hiển thị XP, cấp độ, huy hiệu, kỷ lục (SPEC 3.18). Không có bảng xếp hạng (không có backend).

import { shiftDate } from "../lib/dashboard.ts";
import { localDate } from "../lib/srs.ts";
import { BADGES, XP, badgeCtx, badgeEarned, levelOf, personalRecords } from "../lib/xp.ts";
import { state } from "../state.ts";
import { columnChart } from "./charts.ts";
import { esc } from "./html.ts";

/** Ô KPI trên trang chủ: cấp, XP hôm nay, thanh tiến độ lên cấp. */
export function xpKpi(): string {
  const p = state.progress;
  const lv = levelOf(p.xp.total);
  const today = p.xp.byDay[localDate(new Date())] ?? 0;
  return `<a class="kpi kpi-link" href="#/tien-do" aria-label="Cấp ${lv.level}, ${today} XP hôm nay — xem thành tích">
    <span class="kpi-value">⭐ ${lv.level}<small> · ${today} XP</small></span><span class="kpi-label">cấp · XP hôm nay</span>
    <span class="goal-bar" role="progressbar" aria-valuenow="${Math.round(lv.ratio * 100)}" aria-valuemin="0" aria-valuemax="100" aria-label="Tiến độ lên cấp ${lv.level + 1}"><span style="width:${lv.ratio * 100}%"></span></span></a>`;
}

/** Khối “Thành tích” ở trang Tiến độ. */
export function achievementsSection(): string {
  const p = state.progress;
  const lv = levelOf(p.xp.total);
  const today = localDate(new Date());
  const days = Array.from({ length: 14 }, (_, i) => shiftDate(today, i - 13));
  const chart = columnChart({
    title: "XP 14 ngày gần nhất",
    unit: "XP",
    columns: days.map((d, i) => ({
      label: i === days.length - 1 ? "Nay" : d.slice(8),
      value: p.xp.byDay[d] ?? 0,
      tip: `${d.split("-").reverse().join("/")}: ${p.xp.byDay[d] ?? 0} XP`,
      showValue: i === days.length - 1,
    })),
    highlightIndex: days.length - 1,
    tableHeaders: ["Ngày", "XP"],
  });
  const ctx = badgeCtx(p, { hsk1Lessons: state.lessons?.lessons.length });
  const earned = BADGES.filter((b) => p.badges[b.id]);
  return `
  <section class="section" id="thanh-tich" aria-labelledby="ach-h">
    <h2 id="ach-h">🏅 Thành tích</h2>
    <p class="muted small">Chỉ có thành tích và kỷ lục của chính bạn (lưu trên trình duyệt) — không có bảng xếp hạng.</p>
    <div class="grid">
      <div class="card">
        <h3>⭐ Cấp ${lv.level}</h3>
        <p><strong>${p.xp.total.toLocaleString("vi-VN")}</strong> XP · còn ${(lv.to - p.xp.total).toLocaleString("vi-VN")} XP lên cấp ${lv.level + 1}</p>
        <div class="progress" role="progressbar" aria-valuenow="${Math.round(lv.ratio * 100)}" aria-valuemin="0" aria-valuemax="100" aria-label="Tiến độ lên cấp"><span style="width:${lv.ratio * 100}%"></span></div>
        <details class="small"><summary>Cách tính XP</summary>
          <ul>
            <li>Ôn 1 thẻ: ${XP.review} · Xong bài học: ${XP.lesson} (học lại: 5) · Checkpoint / thi vượt: ${XP.checkpoint}</li>
            <li>Bài đọc: ${XP.reading} (đọc lại: ${XP.readingRepeat}) · Thi thử: ${XP.exam}, đạt thêm ${XP.examPassBonus}</li>
            <li>Chính tả: ${XP.dictationPass}/câu đạt (${XP.dictationTry} nếu chưa đạt) · Viết chữ: ${XP.writeChar} (không sai: ${XP.writeCharPerfect})</li>
            <li>Bộ thủ, Pinyin: ${XP.quizCorrect}/câu đúng · Mưa từ vựng: điểm ÷ ${XP.gameDivisor} (tối đa ${XP.gameMax}/ván)</li>
            <li>Đạt mục tiêu phút học trong ngày: +${XP.dailyGoal}</li>
          </ul></details>
      </div>
      <div class="card">
        <h3>Kỷ lục cá nhân</h3>
        <table class="sandhi records"><tbody>${personalRecords(p)
          .map((r) => `<tr><td>${esc(r.label)}</td><td><strong>${esc(r.value)}</strong></td></tr>`)
          .join("")}</tbody></table>
      </div>
    </div>
    <div class="card section">${chart}</div>
    <h3>Huy hiệu (${earned.length}/${BADGES.length})</h3>
    <div class="badge-grid">${BADGES.map((b) => {
      const got = p.badges[b.id];
      const [cur, target] = b.progress(ctx);
      const pct = Math.min(100, Math.round((cur / Math.max(1, target)) * 100));
      return `<div class="badge-card ${got ? "got" : ""}" title="${esc(b.desc)}">
        <span class="badge-icon" aria-hidden="true">${b.icon}</span>
        <strong>${esc(b.title)}</strong>
        <span class="small muted">${esc(b.desc)}</span>
        ${
          got
            ? `<span class="small ok-text">✓ ${esc(got.split("-").reverse().join("/"))}</span>`
            : `<span class="mini-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(b.title)}"><span style="width:${pct}%"></span></span>
               <span class="small muted">${Math.min(cur, target).toLocaleString("vi-VN")}/${target.toLocaleString("vi-VN")}${badgeEarned(b, ctx) ? " — nhận ở lần học tới" : ""}</span>`
        }
      </div>`;
    }).join("")}</div>
  </section>`;
}
