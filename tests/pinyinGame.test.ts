import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BOSS_EVERY,
  LIVES,
  bossPool,
  fallMs,
  judgePinyin,
  maxOnScreen,
  missedWords,
  newGame,
  settleGame,
  step,
  submit,
  weakWordIds,
} from "../src/lib/pinyinGame.ts";
import { defaultProgress, sanitizeProgress } from "../src/lib/progress.ts";
import type { VocabFile, Word } from "../src/types.ts";

const vocab: VocabFile = JSON.parse(readFileSync(new URL("../public/data/vocab/hsk1.json", import.meta.url), "utf8"));
const W = (h: string) => vocab.words.find((w) => w.hanzi === h)!;
const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe("chấm pinyin", () => {
  const nihao = "ni3 hao3";
  it("không dấu, có/không cách, hoa thường đều đúng; không thưởng", () => {
    for (const s of ["nihao", "ni hao", "NiHao", " ni'hao "]) expect(judgePinyin(nihao, s)).toEqual({ ok: true, toneBonus: false });
  });
  it("gõ số thanh đúng hoặc dấu đúng -> thưởng", () => {
    for (const s of ["ni3hao3", "ni3 hao3", "nǐ hǎo", "nǐhǎo"]) expect(judgePinyin(nihao, s)).toEqual({ ok: true, toneBonus: true });
  });
  it("sai thanh -> vẫn đúng nhưng không thưởng; sai chữ -> sai", () => {
    expect(judgePinyin(nihao, "ni2hao3")).toEqual({ ok: true, toneBonus: false });
    expect(judgePinyin(nihao, "ni3")).toEqual({ ok: false, toneBonus: false });
    expect(judgePinyin(nihao, "nihoa")).toEqual({ ok: false, toneBonus: false });
    expect(judgePinyin(nihao, "")).toEqual({ ok: false, toneBonus: false });
  });
  it("thanh nhẹ: gõ 5 hoặc bỏ trống đều được thưởng", () => {
    const baba = W("爸爸").pinyinNumbered; // ba4 ba5
    expect(judgePinyin(baba, "ba4ba5").toneBonus).toBe(true);
    expect(judgePinyin(baba, "ba4ba").toneBonus).toBe(true);
    expect(judgePinyin(baba, "bà ba").toneBonus).toBe(true);
  });
  it("ü gõ được bằng v, u: hoặc ü", () => {
    const nu = W("女").pinyinNumbered; // nv3 / nü3
    for (const s of ["nv", "nü", "nu:3", "nv3", "nǚ"]) expect(judgePinyin(nu, s).ok, s).toBe(true);
    expect(judgePinyin(nu, "nv3").toneBonus).toBe(true);
  });
  it("nhi hóa: dian3r và dianr3 đều được", () => {
    const w = vocab.words.find((x) => /r$/.test(x.pinyinNumbered) && x.pinyinNumbered.includes("dian3"))!;
    expect(w).toBeTruthy();
    expect(judgePinyin(w.pinyinNumbered, w.pinyinNumbered.replace(/\s/g, "")).toneBonus).toBe(true);
    expect(judgePinyin(w.pinyinNumbered, w.pinyinNumbered.replace(/dian3r/, "dianr3")).toneBonus).toBe(true);
  });
});

describe("vòng chơi", () => {
  const pool: Word[] = ["朋友", "谢谢", "猫", "狗", "茶", "水", "出租车", "电影院"].map(W);

  it("sinh thẻ, gõ đúng thì nổ và cộng điểm (×2 khi đúng thanh)", () => {
    const s = newGame(pool, "text");
    const ev = step(s, 700, seq(0));
    expect(ev[0].type).toBe("spawn");
    const card = s.cards[0];
    const hit = submit(s, card.word.pinyinNumbered);
    expect(hit).toMatchObject({ type: "hit", points: 20, toneBonus: true });
    expect(s.cards).toHaveLength(0);
    expect(s.score).toBe(20);
    expect(s.hits).toBe(1);
  });

  it("gõ sai không mất mạng nhưng ghi lỗi cho thẻ gần đáy nhất", () => {
    const s = newGame(pool, "text");
    step(s, 700, seq(0));
    const ev = submit(s, "zzz");
    expect(ev.type).toBe("wrong");
    expect(s.lives).toBe(LIVES);
    expect(s.misses[s.cards[0].word.id]).toBe(1);
  });

  it("thẻ chạm đáy mất 1 mạng; hết mạng thì kết thúc", () => {
    const s = newGame(pool, "audio");
    let drops = 0;
    let over = false;
    for (let t = 0; t < 2000 && !over; t++) {
      for (const e of step(s, 100, seq(0.3))) {
        if (e.type === "drop") drops++;
        if (e.type === "over") over = true;
      }
    }
    expect(over).toBe(true);
    expect(drops).toBe(LIVES);
    expect(s.lives).toBe(0);
    expect(missedWords(s).reduce((n, m) => n + m.count, 0)).toBe(LIVES);
  });

  it("cứ 5 thẻ có 1 boss là từ nhiều âm tiết, được ×3 điểm", () => {
    const s = newGame(pool, "text");
    const bosses: boolean[] = [];
    for (let i = 0; i < BOSS_EVERY * 2; i++) {
      s.spawnIn = 0;
      const ev = step(s, 1, seq(0.5));
      const sp = ev.find((e) => e.type === "spawn");
      if (sp?.type === "spawn") {
        bosses.push(sp.card.boss);
        const r = submit(s, sp.card.word.pinyinNumbered.replace(/[0-9]/g, ""));
        if (sp.card.boss) {
          expect(bossPool(pool).map((w) => w.id)).toContain(sp.card.word.id);
          expect(r).toMatchObject({ type: "hit", points: 30 });
        }
      }
    }
    expect(bosses).toEqual([false, false, false, false, true, false, false, false, false, true]);
  });

  it("nhanh dần và nhiều thẻ hơn ở chế độ chữ; chế độ nghe luôn 1 thẻ", () => {
    expect(fallMs(20)).toBeLessThan(fallMs(0));
    expect(fallMs(1000)).toBe(4500);
    expect(maxOnScreen("text", 0)).toBe(1);
    expect(maxOnScreen("text", 50)).toBe(3);
    expect(maxOnScreen("audio", 50)).toBe(1);
  });

  it("gõ một pinyin trùng nhiều thẻ thì bắn thẻ gần đáy nhất", () => {
    const s = newGame([W("他"), W("她"), W("它")], "text");
    s.spawnIn = 0;
    step(s, 1, seq(0));
    s.cards[0].y = 0.8;
    s.hits = 8; // cho phép 2 thẻ
    s.spawnIn = 0;
    step(s, 1, seq(0.5));
    expect(s.cards).toHaveLength(2);
    const low = s.cards[0];
    expect(submit(s, "ta")).toMatchObject({ type: "hit", card: low });
  });
});

describe("từ cùng nghĩa trên thẻ", () => {
  it("chế độ chữ: thẻ “đâu, ở đâu” chấp nhận cả 哪儿 lẫn 哪里", () => {
    const pool = [W("哪儿"), W("哪里"), W("猫")];
    const s = newGame(pool, "text");
    s.spawnIn = 0;
    step(s, 1, seq(0));
    const c = s.cards[0];
    expect(c.word.hanzi).toBe("哪儿");
    expect(submit(s, "na3li3")).toMatchObject({ type: "hit", card: c });
  });
  it("chế độ nghe: chỉ chấp nhận đúng âm", () => {
    const s = newGame([W("前"), W("前面")], "audio");
    s.spawnIn = 0;
    step(s, 1, seq(0));
    expect(submit(s, "qianmian").type).toBe("wrong");
  });
});

describe("lưu kết quả", () => {
  it("sai tích lũy ≥ 2 lần -> vào ôn tập, bộ đếm xóa; kỷ lục chỉ cập nhật khi cao hơn", () => {
    const prev = { wordMisses: { a: 1, b: 1 }, gameRecords: { "pinyin-text": { score: 100, date: "2026-11-01" } } };
    const o = settleGame(prev, "text", 90, { a: 1, c: 1, d: 2 }, "2026-11-13");
    expect(o.toSrs.sort()).toEqual(["a", "d"]);
    expect(o.wordMisses).toEqual({ b: 1, c: 1 });
    expect(o.record).toBeUndefined();
    expect(settleGame(prev, "text", 120, {}, "2026-11-13").record).toEqual({ score: 120, date: "2026-11-13" });
    expect(settleGame(prev, "audio", 10, {}, "2026-11-13").record).toEqual({ score: 10, date: "2026-11-13" });
  });
  it("từ yếu = từng gõ sai hoặc thẻ ôn tập từng quên", () => {
    const p = { ...defaultProgress(), wordMisses: { x: 1 } };
    p.cards = [{ id: "y::zh-vi", wordId: "y", cardType: "zh-vi", due: "2026-11-13T00:00:00Z", stability: 1, difficulty: 5, reps: 3, lapses: 1 }];
    expect([...weakWordIds(p)].sort()).toEqual(["x", "y"]);
  });
  it("migration: tiến độ cũ không có trường game -> mặc định rỗng; dữ liệu sai bị bỏ", () => {
    const old = sanitizeProgress({ version: 1, cards: [] });
    expect(old.gameRecords).toEqual({});
    expect(old.wordMisses).toEqual({});
    const bad = sanitizeProgress({ gameRecords: { a: { score: -1, date: "x" }, b: { score: 5, date: "2026-11-13" } }, wordMisses: { a: 2, b: "x", c: 0, d: 1.5 } });
    expect(bad.gameRecords).toEqual({ b: { score: 5, date: "2026-11-13" } });
    expect(bad.wordMisses).toEqual({ a: 2 });
  });
});
