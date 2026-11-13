// Hoạt ảnh & luyện viết thứ tự nét bằng Hanzi Writer (MIT).
// Dữ liệu nét (Make Me a Hanzi, Arphic Public License) được copy sẵn vào public/data/strokes lúc build,
// nên không gọi CDN bên ngoài.

import HanziWriter, { type CharacterJson } from "hanzi-writer";

const cache = new Map<string, Promise<CharacterJson>>();

export function loadChar(ch: string): Promise<CharacterJson> {
  let p = cache.get(ch);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}data/strokes/${encodeURIComponent(ch)}.json`).then((r) => {
      if (!r.ok) throw new Error(`Không có dữ liệu nét cho ${ch}`);
      return r.json();
    });
    p.catch(() => cache.delete(ch));
    cache.set(ch, p);
  }
  return p;
}

function cssVar(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function strokeOptions(size: number) {
  return {
    width: size,
    height: size,
    padding: 6,
    strokeColor: cssVar("--text", "#e8e9ec"),
    radicalColor: cssVar("--accent", "#e5484d"),
    outlineColor: cssVar("--border", "#2a2f3a"),
    drawingColor: cssVar("--accent", "#e5484d"),
    highlightColor: cssVar("--ok", "#3fb950"),
    charDataLoader: (ch: string, onLoad: (d: CharacterJson) => void, onError: (e?: unknown) => void) => {
      loadChar(ch).then(onLoad, onError);
    },
  };
}

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Vẽ hoạt ảnh thứ tự nét cho từng chữ trong `text`; trả về hàm phát lại. */
export function mountStrokeAnimation(container: HTMLElement, text: string, size = 110): () => void {
  container.innerHTML = "";
  const writers = [...text].map((ch) => {
    const box = document.createElement("div");
    box.className = "stroke-box";
    box.setAttribute("aria-label", `Thứ tự nét chữ ${ch}`);
    container.appendChild(box);
    const w = HanziWriter.create(box, ch, {
      ...strokeOptions(size),
      showCharacter: !!reducedMotion(),
      strokeAnimationSpeed: 1.2,
      delayBetweenStrokes: 180,
      onLoadCharDataError: () => {
        box.textContent = ch;
        box.classList.add("stroke-missing");
      },
    });
    return w;
  });
  const play = async () => {
    for (const w of writers) {
      await new Promise<void>((resolve) => {
        w.hideCharacter();
        w.animateCharacter({ onComplete: () => resolve() });
      });
    }
  };
  if (!reducedMotion()) play();
  return () => void play();
}

/** Luyện viết lần lượt từng chữ; gọi `onDone(totalMistakes)` khi viết xong cả từ. */
export function mountWritingQuiz(
  container: HTMLElement,
  text: string,
  onDone: (mistakes: number) => void,
  size = 200,
  opts: { outline?: boolean } = {},
) {
  container.innerHTML = "";
  const chars = [...text];
  let mistakes = 0;
  const run = (i: number) => {
    if (i >= chars.length) return onDone(mistakes);
    const box = document.createElement("div");
    box.className = "stroke-box quiz";
    box.setAttribute("aria-label", `Viết chữ thứ ${i + 1}/${chars.length}`);
    container.appendChild(box);
    const w = HanziWriter.create(box, chars[i], {
      ...strokeOptions(size),
      showCharacter: false,
      // không hiện nét mờ: người học phải tự nhớ ra chữ (gợi ý chỉ hiện sau 2 lần sai)
      showOutline: !!opts.outline,
      showHintAfterMisses: 2,
      highlightOnComplete: true,
      onLoadCharDataError: () => {
        box.textContent = chars[i];
        run(i + 1);
      },
    });
    w.quiz({
      onComplete: (s) => {
        mistakes += s.totalMistakes;
        run(i + 1);
      },
    });
  };
  run(0);
}
