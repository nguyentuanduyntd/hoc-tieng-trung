// Đo thời gian học thực sự: chỉ tính khi đang ở trang học, tab đang hiển thị, và người học vừa
// tương tác (≤ 60 giây) hoặc web đang phát âm. Lưu vào studyLog theo ngày — không gửi đi đâu.

import { addStudySeconds } from "../lib/dashboard.ts";
import { localDate } from "../lib/srs.ts";
import { setProgress } from "../state.ts";

const TICK_SECONDS = 15;
const IDLE_MS = 60_000;
/** Các trang tính là "đang học". */
const STUDY_ROUTES = new Set(["bai-hoc", "on-tap", "doc", "phat-am", "thi-thu", "tu-vung"]);

let lastInteraction = Date.now();

export function installActivityTracker(currentRoute: () => string) {
  const bump = () => (lastInteraction = Date.now());
  for (const ev of ["pointerdown", "keydown", "scroll", "touchstart"]) window.addEventListener(ev, bump, { passive: true });
  window.setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (!STUDY_ROUTES.has(currentRoute())) return;
    const speaking = typeof speechSynthesis !== "undefined" && speechSynthesis.speaking;
    if (!speaking && Date.now() - lastInteraction > IDLE_MS) return;
    setProgress((p) => addStudySeconds(p, localDate(new Date()), TICK_SECONDS), { silent: true });
  }, TICK_SECONDS * 1000);
}
