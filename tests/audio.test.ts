import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NEURAL_VOICES, SAMPLE_SENTENCE } from "../src/config/audio.ts";
import { audioHash, billableChars, collectAudioItems, pickAudio, ssmlBody, ssmlFor, toSapi, type AudioManifest } from "../src/lib/audio.ts";
import { sanitizeSettings } from "../src/lib/settings.ts";
import type { ExamsFile, LessonsFile, ReadingsFile, VocabFile } from "../src/types.ts";

const load = <T>(p: string): T => JSON.parse(readFileSync(new URL(`../public/data/${p}`, import.meta.url), "utf8"));
const vocab = load<VocabFile>("vocab/hsk1.json");
const lessons = load<LessonsFile>("lessons/hsk1.json");
const readings = load<ReadingsFile>("readings/hsk1.json");
const exams = load<ExamsFile>("exams/hsk1.json");

describe("pinyin -> SAPI (Azure zh-CN)", () => {
  it("âm tiết + số thanh, nối bằng ' - '; nhi hóa; ü", () => {
    expect(toSapi("ni3 hao3")).toBe("ni 3 - hao 3");
    expect(toSapi("le5")).toBe("le 5");
    expect(toSapi("dian3r")).toBe("dian r 3");
    expect(toSapi("nü3")).toBe("nv 3");
    expect(toSapi("nv3 er2")).toBe("nv 3 - er 2");
  });
});

describe("gom văn bản cần đọc", () => {
  const items = collectAudioItems({ vocab, lessons, readings, exams, sample: SAMPLE_SENTENCE });
  it("đủ mọi nguồn, không trùng", () => {
    expect(new Set(items.map((i) => i.text)).size).toBe(items.length);
    for (const k of ["word", "example", "lesson", "reading", "exam", "sample"]) expect(items.some((i) => i.kind === k), k).toBe(true);
    for (const w of vocab.words) expect(items.some((i) => i.text === w.hanzi), w.hanzi).toBe(true);
    for (const r of readings.readings) for (const s of r.sentences) expect(items.some((i) => i.text === s.zh.trim())).toBe(true);
  });
  it("chỉ từ một chữ đa âm mới có <phoneme>", () => {
    const ph = items.filter((i) => i.pinyinNumbered);
    expect(ph.length).toBeGreaterThan(0);
    for (const i of ph) expect([...i.text]).toHaveLength(1);
    const le = items.find((i) => i.text === "了")!;
    expect(ssmlBody(le)).toBe(`<phoneme alphabet="sapi" ph="${toSapi(le.pinyinNumbered!)}">了</phoneme>`);
    expect(items.find((i) => i.text === "你")?.pinyinNumbered).toBeUndefined();
  });
  it("phần Nghe của đề thi: lời thoại + câu hỏi, không lấy phương án / phần Đọc", () => {
    const examTexts = items.filter((i) => i.kind === "exam").map((i) => i.text);
    const reading = exams.exams[0].sections.find((s) => s.id === "reading")!;
    for (const q of reading.parts.flatMap((p) => p.questions)) if (q.text) expect(examTexts).not.toContain(q.text.zh);
  });
});

describe("SSML & tính phí", () => {
  it("SSML tối thiểu: không có <prosody> (tốc độ chỉnh bằng playbackRate ở client)", () => {
    const s = ssmlFor({ text: "你好", kind: "word" }, NEURAL_VOICES.female.name);
    expect(s).toContain('<voice name="zh-CN-XiaoxiaoNeural">你好</voice>');
    expect(s).not.toContain("prosody");
    expect(ssmlBody({ text: "A<B", kind: "sample" })).toBe("A&lt;B");
  });
  it("chữ Hán tính 2 ký tự, chữ La-tinh/thẻ tính 1", () => {
    expect(billableChars("你好")).toBe(4);
    expect(billableChars("你好！")).toBe(6);
    expect(billableChars("ab c")).toBe(4);
  });
  it("tên file ổn định, đổi giọng hoặc nội dung thì đổi", async () => {
    const a = await audioHash("v1", "你好");
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(await audioHash("v1", "你好")).toBe(a);
    expect(await audioHash("v2", "你好")).not.toBe(a);
    expect(await audioHash("v1", "您好")).not.toBe(a);
  });
});

describe("chọn file ở client", () => {
  const m: AudioManifest = { version: 1, voices: {}, items: { 你好: { female: "f1", male: "m1" }, 再见: { male: "m2" } } };
  it("đúng giọng; thiếu thì lấy giọng còn lại; không có thì null", () => {
    expect(pickAudio(m, "你好", "male")).toEqual({ voice: "male", hash: "m1" });
    expect(pickAudio(m, " 再见 ", "female")).toEqual({ voice: "male", hash: "m2" });
    expect(pickAudio(m, "谢谢", "female")).toBeNull();
    expect(pickAudio(null, "你好", "female")).toBeNull();
  });
});

describe("cài đặt nguồn giọng", () => {
  it("migration: cài đặt cũ -> Tự động, giọng nữ; giá trị lạ bị bỏ", () => {
    expect(sanitizeSettings({ rate: 1 })).toMatchObject({ voiceSource: "auto", neuralVoice: "female" });
    expect(sanitizeSettings({ voiceSource: "neural", neuralVoice: "male" })).toMatchObject({ voiceSource: "neural", neuralVoice: "male" });
    expect(sanitizeSettings({ voiceSource: "x", neuralVoice: 1 })).toMatchObject({ voiceSource: "auto", neuralVoice: "female" });
  });
});

describe("an toàn key Azure", () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  it("code phía client (src/) không đọc key / không gọi endpoint Azure", () => {
    for (const f of walk(new URL("../src", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"))) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/AZURE_SPEECH_KEY|Ocp-Apim-Subscription-Key|tts\.speech\.microsoft\.com/);
    }
  });
  it(".env bị git bỏ qua, có .env.example không chứa key", () => {
    const gi = readFileSync(new URL("../.gitignore", import.meta.url), "utf8");
    expect(gi).toMatch(/^\.env$/m);
    const ex = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
    expect(ex).toMatch(/^AZURE_SPEECH_KEY=$/m);
  });
  it("không dùng thư viện Read Aloud không chính thức", () => {
    const pkg = readFileSync(new URL("../package.json", import.meta.url), "utf8");
    expect(pkg).not.toMatch(/edge-tts|msedge-tts/);
  });
});
