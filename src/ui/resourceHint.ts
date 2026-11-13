// Gợi ý nguồn miễn phí theo ngữ cảnh (SPEC 3.11): xong thi thử -> CTI / Mandarin Bean,
// xong bài nghe -> Mandarin Corner, … Nguồn đã "đến lúc dùng" (theo nhãn Dùng khi nào) được đánh dấu.

import { getExamConfig } from "../config/exams.ts";
import { RESOURCES, type ExternalResource } from "../config/resources.ts";
import { isResourceReady, learnerStats, suggestResources } from "../lib/dashboard.ts";
import { state } from "../state.ts";
import { esc } from "./html.ts";

type Ctx = ExternalResource["contexts"][number];

export function resourceHint(contexts: Ctx[], title = "Dùng kèm nguồn miễn phí"): string {
  const stats = learnerStats(state.progress, getExamConfig(state.progress.hskStandard, 1)?.totalScore);
  const seen = new Set<string>();
  const list = contexts.flatMap((c) => suggestResources(RESOURCES, c, stats)).filter((r) => !seen.has(r.id) && seen.add(r.id));
  if (!list.length) return "";
  return `<aside class="resource-hint" aria-label="${esc(title)}">
    <div class="small muted">${esc(title)}</div>
    <ul>${list
      .map((r) => {
        const ready = isResourceReady(r.id, stats);
        return `<li><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)} ↗</a>
          ${ready ? `<span class="badge accent">Nên dùng ngay</span>` : ""}
          <span class="small muted">— ${esc(r.whenToUse)}</span></li>`;
      })
      .join("")}</ul>
  </aside>`;
}
