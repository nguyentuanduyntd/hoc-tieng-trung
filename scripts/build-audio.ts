// Dựng sẵn audio giọng Microsoft Neural bằng Azure AI Speech (REST, gói Free F0) — SPEC 3.19.
//
//   npm run audio -- --dry-run                 chỉ đếm (không cần key, không gọi mạng)
//   npm run audio -- --level 1 --voice female  chạy thật cho HSK 1, giọng nữ
//   npm run audio -- --limit 20                chỉ tạo tối đa 20 file (thử trước)
//   npm run audio -- --prune                   xóa file mp3 không còn dùng
//
// Key CHỈ lấy từ biến môi trường AZURE_SPEECH_KEY, AZURE_SPEECH_REGION (hoặc file .env cục bộ,
// đã nằm trong .gitignore). Key không bao giờ đi vào code phía client hay vào repo.
// Không dùng endpoint “Read Aloud” không chính thức của Edge (edge-tts, msedge-tts…).
// Chỉ tạo file mới / file đã đổi nội dung (tên file = băm nội dung + giọng) để tiết kiệm quota.
// Chạy `npm run data` trước để có public/data/*.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AUDIO_OUTPUT_FORMAT, F0_MONTHLY_CHARS, F0_REQUESTS_PER_MINUTE, NEURAL_VOICES, SAMPLE_SENTENCE, type NeuralVoiceKey } from "../src/config/audio.ts";
import { audioHash, billableChars, collectAudioItems, ssmlBody, ssmlFor, type AudioItem, type AudioManifest } from "../src/lib/audio.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "public", "data");
const OUT = join(ROOT, "public", "audio");
const MANIFEST = join(OUT, "manifest.json");

// ---------- tham số ----------
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const dryRun = flag("dry-run");
const prune = flag("prune");
const level = Number(opt("level") ?? 1);
const limit = opt("limit") ? Number(opt("limit")) : Infinity;
const voiceArg = opt("voice");
const voiceKeys: NeuralVoiceKey[] = voiceArg
  ? (voiceArg.split(",").map((v) => (v === "xiaoxiao" ? "female" : v === "yunxi" ? "male" : v)) as NeuralVoiceKey[])
  : ["female", "male"];
for (const v of voiceKeys) if (!NEURAL_VOICES[v]) fail(`Giọng không hợp lệ: ${v} (dùng female|male|xiaoxiao|yunxi)`);

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const readJson = <T>(rel: string): T | undefined => {
  const p = join(DATA, rel);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : undefined;
};

// ---------- gom văn bản ----------
const vocab = readJson<import("../src/types.ts").VocabFile>(`vocab/hsk${level}.json`);
if (!vocab) fail(`Chưa có public/data/vocab/hsk${level}.json — chạy "npm run data" trước.`);
const items = collectAudioItems({
  vocab,
  lessons: readJson(`lessons/hsk${level}.json`),
  readings: readJson(`readings/hsk${level}.json`),
  exams: readJson(`exams/hsk${level}.json`),
  sample: SAMPLE_SENTENCE,
});

const manifest: AudioManifest = existsSync(MANIFEST)
  ? (JSON.parse(readFileSync(MANIFEST, "utf8")) as AudioManifest)
  : { version: 1, voices: {}, items: {} };

interface Job {
  item: AudioItem;
  voice: NeuralVoiceKey;
  hash: string;
  file: string;
  chars: number;
}

const jobs: Job[] = [];
const all: Job[] = [];
for (const voice of voiceKeys) {
  const v = NEURAL_VOICES[voice];
  for (const item of items) {
    const body = ssmlBody(item);
    const hash = await audioHash(v.name, body);
    const file = join(OUT, v.dir, `${hash}.mp3`);
    const job = { item, voice, hash, file, chars: billableChars(body) };
    all.push(job);
    if (!existsSync(file)) jobs.push(job);
  }
}

// ---------- báo cáo ----------
const sum = (js: Job[]) => js.reduce((n, j) => n + j.chars, 0);
const fmt = (n: number) => n.toLocaleString("vi-VN");
const kinds = [...new Set(items.map((i) => i.kind))];
console.log(`HSK ${level} · giọng: ${voiceKeys.map((v) => NEURAL_VOICES[v].name).join(", ")}`);
console.log(`Văn bản khác nhau: ${items.length} (${kinds.map((k) => `${k} ${items.filter((i) => i.kind === k).length}`).join(", ")})`);
console.log(`  có <phoneme> (từ một chữ đa âm): ${items.filter((i) => i.pinyinNumbered).length}`);
console.log(`Tổng cho ${voiceKeys.length} giọng: ${all.length} file · ${fmt(sum(all))} ký tự tính phí (ước lượng)`);
console.log(`Cần tạo mới: ${jobs.length} file · ${fmt(sum(jobs))} ký tự tính phí (ước lượng)`);
const todo = jobs.slice(0, limit);
if (todo.length < jobs.length) console.log(`  --limit ${limit}: lần này tạo ${todo.length} file · ${fmt(sum(todo))} ký tự`);
console.log(`  = ${((sum(todo) / F0_MONTHLY_CHARS) * 100).toFixed(1)}% hạn mức F0 ${fmt(F0_MONTHLY_CHARS)} ký tự/tháng`);
console.log(`  thời gian ước tính (F0 tối đa ${F0_REQUESTS_PER_MINUTE} yêu cầu/phút): ~${Math.ceil(todo.length / (F0_REQUESTS_PER_MINUTE - 1))} phút`);
console.log(`Cách tính: chữ Hán và dấu câu toàn khổ = 2, ký tự khác (kể cả thẻ <phoneme>) = 1; phần bọc <speak>/<voice> không tính.`);

if (prune) {
  const keep = new Set(all.map((j) => j.file));
  let removed = 0;
  for (const voice of voiceKeys) {
    const dir = join(OUT, NEURAL_VOICES[voice].dir);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (f.endsWith(".mp3") && !keep.has(p)) {
        if (!dryRun) rmSync(p);
        removed++;
      }
    }
  }
  console.log(`${dryRun ? "Sẽ xóa" : "Đã xóa"} ${removed} file không còn dùng.`);
}

if (dryRun) {
  console.log("--dry-run: không gọi Azure, không ghi file.");
  process.exit(0);
}

// ---------- chạy thật ----------
try {
  process.loadEnvFile(join(ROOT, ".env"));
} catch {
  /* không có .env: dùng biến môi trường sẵn có */
}
const KEY = process.env.AZURE_SPEECH_KEY;
const REGION = process.env.AZURE_SPEECH_REGION;
if (todo.length && (!KEY || !REGION)) fail("Thiếu AZURE_SPEECH_KEY hoặc AZURE_SPEECH_REGION (biến môi trường hoặc file .env — xem .env.example).");

const endpoint = `https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
const GAP_MS = Math.ceil(60_000 / (F0_REQUESTS_PER_MINUTE - 1)); // chừa 1 yêu cầu dự phòng mỗi phút
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function writeManifest() {
  // chỉ ghi các mục có file thật trên đĩa, cho mọi giọng đã cấu hình
  const items: AudioManifest["items"] = {};
  const voices: AudioManifest["voices"] = { ...manifest.voices };
  for (const j of all) {
    if (!existsSync(j.file)) continue;
    (items[j.item.text] ??= {})[j.voice] = j.hash;
    voices[j.voice] = NEURAL_VOICES[j.voice].name;
  }
  // giữ mục của giọng không chạy lần này (nếu file còn)
  for (const [text, e] of Object.entries(manifest.items))
    for (const [v, h] of Object.entries(e) as [NeuralVoiceKey, string][]) {
      if (voiceKeys.includes(v)) continue;
      if (existsSync(join(OUT, NEURAL_VOICES[v].dir, `${h}.mp3`))) (items[text] ??= {})[v] = h;
    }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify({ version: 1, voices, items }, null, 0) + "\n");
}

let used = 0;
let made = 0;
let last = 0;
for (const j of todo) {
  const wait = last + GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  let ok = false;
  for (let attempt = 1; attempt <= 5 && !ok; attempt++) {
    last = Date.now();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": KEY!,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": AUDIO_OUTPUT_FORMAT,
        "User-Agent": "hoc-tieng-trung-build-audio",
      },
      body: ssmlFor(j.item, NEURAL_VOICES[j.voice].name),
    }).catch((e: unknown) => ({ ok: false, status: 0, statusText: String(e), headers: new Headers(), arrayBuffer: async () => new ArrayBuffer(0) }) as unknown as Response);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) fail(`Azure trả về audio rỗng cho "${j.item.text}"`);
      mkdirSync(dirname(j.file), { recursive: true });
      writeFileSync(j.file, buf);
      used += j.chars;
      made++;
      ok = true;
    } else if (res.status === 401 || res.status === 403) {
      writeManifest();
      fail(`Azure từ chối key (HTTP ${res.status}). Kiểm tra AZURE_SPEECH_KEY / AZURE_SPEECH_REGION. Đã tạo ${made} file, ~${fmt(used)} ký tự.`);
    } else if (res.status === 400) {
      console.warn(`  ! bỏ qua "${j.item.text}" (${j.voice}): HTTP 400 — SSML không hợp lệ?`);
      break;
    } else {
      const retry = Number(res.headers.get("retry-after")) || 2 ** attempt * 5;
      console.warn(`  … HTTP ${res.status || "lỗi mạng"} — thử lại sau ${retry}s (lần ${attempt}/5)`);
      await sleep(retry * 1000);
    }
  }
  if (!ok && made === 0 && j === todo[0]) {
    writeManifest();
    fail("Không tạo được file đầu tiên — dừng để khỏi tốn quota. Kiểm tra mạng / region.");
  }
  if (made % 25 === 0) {
    writeManifest();
    console.log(`  ${made}/${todo.length} file · ~${fmt(used)} ký tự`);
  }
}
writeManifest();
console.log(`✓ Đã tạo ${made} file · ~${fmt(used)} ký tự tính phí lần này. Manifest: public/audio/manifest.json`);
