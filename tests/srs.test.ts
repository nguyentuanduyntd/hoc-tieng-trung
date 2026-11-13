import { describe, expect, it } from "vitest";
import {
  addWordCards,
  applyReview,
  buildQueue,
  formatInterval,
  markWordForReview,
  newCard,
  nextCard,
  nextInterval,
  retrievability,
  review,
  type Rating,
} from "../src/lib/srs.ts";
import type { SrsCard } from "../src/types.ts";

const T0 = new Date("2026-11-13T09:00:00");
const days = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const ivlDays = (c: SrsCard, from: Date) => Math.round((Date.parse(c.due) - from.getTime()) / 86_400_000);

describe("công thức FSRS", () => {
  it("R(S,S) = 0.9 và khoảng cách = S khi retention 0.9", () => {
    expect(retrievability(10, 10)).toBeCloseTo(0.9, 6);
    expect(nextInterval(10)).toBe(10);
    expect(retrievability(0, 5)).toBe(1);
  });
  it("khoảng cách tối thiểu 1 ngày", () => expect(nextInterval(0.1)).toBe(1));
});

describe("thẻ mới", () => {
  const c = newCard("你_ni3", "zh-vi", T0);
  it("id ổn định theo từ + loại thẻ", () => expect(c.id).toBe("你_ni3::zh-vi"));
  it("Quên -> hỏi lại sau 1 phút, chưa tính lapse", () => {
    const r = review(c, 1, T0);
    expect(Date.parse(r.due) - T0.getTime()).toBe(60_000);
    expect(r.lapses).toBe(0);
    expect(r.reps).toBe(1);
  });
  it("khoảng cách tăng dần Khó ≤ Được ≤ Dễ", () => {
    const [h, g, e] = ([2, 3, 4] as Rating[]).map((x) => ivlDays(review(c, x, T0), T0));
    expect(h).toBeLessThanOrEqual(g);
    expect(g).toBeLessThan(e);
    expect(g).toBe(4); // S0(Được) ≈ 3.71
  });
  it("độ khó ban đầu: Dễ < Được < Khó < Quên, trong [1,10]", () => {
    const d = ([1, 2, 3, 4] as Rating[]).map((x) => review(c, x, T0).difficulty);
    expect(d[3]).toBeLessThan(d[2]);
    expect(d[2]).toBeLessThan(d[1]);
    expect(d[1]).toBeLessThan(d[0]);
    for (const x of d) expect(x).toBeGreaterThanOrEqual(1), expect(x).toBeLessThanOrEqual(10);
  });
});

describe("thẻ đang ôn", () => {
  const learned = review(newCard("w", "zh-vi", T0), 3, T0); // đến hạn sau 4 ngày
  const onTime = days(T0, 4);

  it("ôn đúng hạn + Được -> khoảng cách dài hơn lần trước", () => {
    const r = review(learned, 3, onTime);
    expect(ivlDays(r, onTime)).toBeGreaterThan(4);
    expect(r.stability).toBeGreaterThan(learned.stability);
  });
  it("Quên -> độ ổn định giảm, lapses +1, hỏi lại trong phiên", () => {
    const r = review(learned, 1, onTime);
    expect(r.stability).toBeLessThan(learned.stability);
    expect(r.lapses).toBe(1);
    expect(Date.parse(r.due) - onTime.getTime()).toBe(60_000);
    expect(r.difficulty).toBeGreaterThan(learned.difficulty);
  });
  it("ôn muộn (nhớ được khi R thấp) tăng độ ổn định nhiều hơn ôn đúng hạn", () => {
    const late = days(T0, 12);
    expect(review(learned, 3, late).stability).toBeGreaterThan(review(learned, 3, onTime).stability);
  });
  it("chuỗi Được liên tiếp: khoảng cách tăng đơn điệu", () => {
    let c = learned;
    let now = onTime;
    let prev = 4;
    for (let i = 0; i < 6; i++) {
      c = review(c, 3, now);
      const ivl = ivlDays(c, now);
      expect(ivl).toBeGreaterThan(prev);
      prev = ivl;
      now = new Date(c.due);
    }
  });
  it("không sửa thẻ gốc", () => {
    const copy = { ...learned };
    review(learned, 4, onTime);
    expect(learned).toEqual(copy);
  });
});

describe("hàng ôn mỗi ngày", () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => newCard(`w${i}`, "zh-vi", new Date(T0.getTime() + i)));

  it("giới hạn thẻ mới/ngày", () => {
    const q = buildQueue(mk(25), T0, 10);
    expect(q.fresh).toHaveLength(10);
    expect(q.due).toHaveLength(0);
    expect(q.fresh[0].wordId).toBe("w0"); // theo thứ tự thêm
  });

  it("thẻ mới đã học hôm nay trừ vào hạn mức", () => {
    let cards = mk(15);
    for (let i = 0; i < 4; i++) cards = applyReview(cards, cards[i].id, 3, T0);
    expect(buildQueue(cards, T0, 10).fresh).toHaveLength(6);
    // sang ngày mới thì hạn mức làm mới
    expect(buildQueue(cards, days(T0, 1), 10).fresh).toHaveLength(10);
  });

  it("thẻ đến hạn xếp trước thẻ mới và theo thứ tự đến hạn", () => {
    let cards = mk(3);
    cards = applyReview(cards, cards[0].id, 1, T0); // hỏi lại sau 1 phút
    const later = new Date(T0.getTime() + 2 * 60_000);
    const q = buildQueue(cards, later, 10);
    expect(q.due.map((c) => c.wordId)).toEqual(["w0"]);
    expect(nextCard(q)?.wordId).toBe("w0");
  });

  it("thẻ chưa đến hạn không xuất hiện", () => {
    let cards = mk(1);
    cards = applyReview(cards, cards[0].id, 3, T0);
    expect(nextCard(buildQueue(cards, days(T0, 1), 10))).toBeUndefined();
    expect(nextCard(buildQueue(cards, days(T0, 4), 10))?.wordId).toBe("w0");
  });

  it("thẻ mới cùng từ để sang ngày sau nếu hôm nay đã ôn từ đó", () => {
    let cards = addWordCards([], "a", ["zh-vi", "vi-zh"], T0);
    cards = applyReview(cards, "a::zh-vi", 3, T0);
    expect(buildQueue(cards, T0, 10).fresh).toHaveLength(0);
    expect(buildQueue(cards, days(T0, 1), 10).fresh.map((c) => c.id)).toEqual(["a::vi-zh"]);
  });

  it("thêm thẻ không trùng", () => {
    let cards = addWordCards([], "a", ["zh-vi", "vi-zh"], T0);
    cards = addWordCards(cards, "a", ["zh-vi", "write"], T0);
    expect(cards.map((c) => c.cardType)).toEqual(["zh-vi", "vi-zh", "write"]);
  });

  it("markWordForReview đưa thẻ đã học về đến hạn ngay", () => {
    let cards = addWordCards([], "a", ["zh-vi"], T0);
    cards = applyReview(cards, cards[0].id, 3, T0);
    cards = markWordForReview(cards, "a", days(T0, 1));
    expect(buildQueue(cards, days(T0, 1), 10).due).toHaveLength(1);
  });
});

describe("hiển thị khoảng cách", () => {
  it.each([
    [60_000, "1 phút"],
    [3 * 3_600_000, "3 giờ"],
    [4 * 86_400_000, "4 ngày"],
    [60 * 86_400_000, "2 tháng"],
  ])("%i ms -> %s", (ms, s) => expect(formatInterval(ms)).toBe(s));
});
