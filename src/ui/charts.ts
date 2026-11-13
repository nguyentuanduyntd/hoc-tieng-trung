// Biểu đồ cột SVG nhỏ, không thư viện ngoài. Theo quy ước dataviz: cột ≤ 24px, bo 4px ở đầu dữ liệu
// (vuông ở đường gốc), lưới mảnh 1px liền, một trục y, nhãn giá trị chọn lọc, tooltip khi rê/focus,
// luôn có bảng số liệu thay thế (<details>).

import { esc } from "./html.ts";

export interface Column {
  label: string;
  value: number;
  /** Nội dung tooltip (mặc định: label + value). */
  tip?: string;
  /** Hiện nhãn giá trị trên đầu cột. */
  showValue?: boolean;
}

export interface ColumnChartOptions {
  title: string;
  columns: Column[];
  unit: string;
  /** Đường tham chiếu (mục tiêu, điểm đạt). */
  ref?: { value: number; label: string };
  yMax?: number;
  /** Cột được nhấn mạnh (vd hôm nay) dùng màu chính, cột khác dùng màu nhạt hơn của cùng sắc. */
  highlightIndex?: number;
  tableHeaders: [string, string];
}

const W = 560;
const H = 190;
const M = { top: 18, right: 12, bottom: 26, left: 34 };

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  // bội số có nửa tròn để vạch giữa cũng là số nguyên
  for (const m of [1, 2, 4, 5, 10]) if (m * pow >= v) return m * pow;
  return 10 * pow;
}

/** Đường dẫn cột: bo 4px ở 2 góc trên, vuông ở đáy. */
function barPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function columnChart(o: ColumnChartOptions): string {
  const max = niceMax(Math.max(o.yMax ?? 0, o.ref?.value ?? 0, ...o.columns.map((c) => c.value)));
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const band = iw / Math.max(1, o.columns.length);
  const bw = Math.min(24, band * 0.6);
  const y = (v: number) => M.top + ih - (v / max) * ih;
  const ticks = [0, max / 2, max];
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

  const grid = ticks
    .map((t) => `<line class="grid" x1="${M.left}" x2="${W - M.right}" y1="${y(t)}" y2="${y(t)}"/>
      <text class="tick" x="${M.left - 6}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`)
    .join("");
  const bars = o.columns
    .map((c, i) => {
      const cx = M.left + band * i + band / 2;
      const top = y(c.value);
      const tip = esc(c.tip ?? `${c.label}: ${fmt(c.value)} ${o.unit}`);
      const cls = o.highlightIndex === undefined || o.highlightIndex === i ? "bar" : "bar dim";
      return `<g class="col" tabindex="0" role="img" aria-label="${tip}" data-tip="${tip}">
        <rect class="hit" x="${cx - band / 2}" y="${M.top}" width="${band}" height="${ih}"/>
        <path class="${cls}" d="${barPath(cx - bw / 2, top, bw, M.top + ih - top)}"/>
        ${c.showValue && c.value > 0 ? `<text class="val" x="${cx}" y="${top - 5}" text-anchor="middle">${fmt(c.value)}</text>` : ""}
        <text class="xlab" x="${cx}" y="${H - 8}" text-anchor="middle">${esc(c.label)}</text>
      </g>`;
    })
    .join("");
  const ref = o.ref
    ? `<line class="ref" x1="${M.left}" x2="${W - M.right}" y1="${y(o.ref.value)}" y2="${y(o.ref.value)}"/>
       <text class="ref-label" x="${W - M.right}" y="${y(o.ref.value) - 5}" text-anchor="end">${esc(o.ref.label)}</text>`
    : "";
  return `<figure class="chart">
    <svg viewBox="0 0 ${W} ${H}" role="group" aria-label="${esc(o.title)}">${grid}${ref}${bars}<line class="axis" x1="${M.left}" x2="${W - M.right}" y1="${y(0)}" y2="${y(0)}"/></svg>
    <details class="chart-table"><summary>Xem dạng bảng</summary>
      <table><thead><tr><th>${esc(o.tableHeaders[0])}</th><th>${esc(o.tableHeaders[1])}</th></tr></thead>
      <tbody>${o.columns.map((c) => `<tr><td>${esc(c.label)}</td><td>${fmt(c.value)}</td></tr>`).join("")}</tbody></table>
    </details>
  </figure>`;
}

/** Một tooltip dùng chung cho mọi biểu đồ (rê chuột hoặc focus bằng bàn phím). */
export function installChartTooltip() {
  const tip = document.createElement("div");
  tip.className = "chart-tip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  document.body.appendChild(tip);
  const show = (el: Element) => {
    const r = el.getBoundingClientRect();
    tip.textContent = el.getAttribute("data-tip");
    tip.hidden = false;
    const tw = tip.offsetWidth;
    tip.style.left = `${Math.min(window.innerWidth - tw - 8, Math.max(8, r.left + r.width / 2 - tw / 2))}px`;
    tip.style.top = `${r.top + window.scrollY - tip.offsetHeight - 6}px`;
  };
  const hide = () => (tip.hidden = true);
  document.addEventListener("pointerover", (e) => {
    const el = (e.target as Element).closest?.("[data-tip]");
    el ? show(el) : hide();
  });
  document.addEventListener("focusin", (e) => {
    const el = (e.target as Element).closest?.("[data-tip]");
    el ? show(el) : hide();
  });
  document.addEventListener("focusout", hide);
  window.addEventListener("scroll", hide, { passive: true });
}
