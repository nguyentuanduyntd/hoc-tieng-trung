// Lọc, xếp hạng, gắn nhãn giọng đọc của trình duyệt (SPEC 3.19, phần giọng trình duyệt).
// Hàm thuần, không đụng speechSynthesis — có test với danh sách giọng mẫu.

export interface VoiceLike {
  voiceURI: string;
  name: string;
  lang: string;
  localService?: boolean;
}

export type Variant = "cn" | "tw" | "dialect" | "cantonese";
export type Gender = "female" | "male" | "unknown";
export type VoiceKind = "natural" | "microsoft" | "google" | "other";

export interface VoiceInfo<V extends VoiceLike = VoiceLike> {
  voice: V;
  variant: Variant;
  kind: VoiceKind;
  gender: Gender;
  /** Cần mạng (giọng online / Natural / Google). */
  online: boolean;
  /** Số càng nhỏ càng tốt. */
  rank: number;
  /** Tên gọn: "晓晓 · Nữ · Natural · cần mạng". */
  label: string;
}

/** Tên giọng Microsoft -> tên chữ Hán + giới tính (giọng Edge/Windows phổ biến). */
const KNOWN: Record<string, { zh: string; gender: Gender }> = {
  xiaoxiao: { zh: "晓晓", gender: "female" },
  xiaoyi: { zh: "晓伊", gender: "female" },
  xiaochen: { zh: "晓辰", gender: "female" },
  xiaohan: { zh: "晓涵", gender: "female" },
  xiaomeng: { zh: "晓梦", gender: "female" },
  xiaomo: { zh: "晓墨", gender: "female" },
  xiaoqiu: { zh: "晓秋", gender: "female" },
  xiaorui: { zh: "晓睿", gender: "female" },
  xiaoshuang: { zh: "晓双", gender: "female" },
  xiaoxuan: { zh: "晓萱", gender: "female" },
  xiaoyan: { zh: "晓颜", gender: "female" },
  xiaoyou: { zh: "晓悠", gender: "female" },
  xiaozhen: { zh: "晓甄", gender: "female" },
  xiaobei: { zh: "晓北", gender: "female" },
  xiaoni: { zh: "晓妮", gender: "female" },
  yunxi: { zh: "云希", gender: "male" },
  yunjian: { zh: "云健", gender: "male" },
  yunyang: { zh: "云扬", gender: "male" },
  yunxia: { zh: "云夏", gender: "male" },
  yunfeng: { zh: "云枫", gender: "male" },
  yunhao: { zh: "云皓", gender: "male" },
  yunye: { zh: "云野", gender: "male" },
  yunze: { zh: "云泽", gender: "male" },
  huihui: { zh: "慧慧", gender: "female" },
  yaoyao: { zh: "瑶瑶", gender: "female" },
  kangkang: { zh: "康康", gender: "male" },
  hanhan: { zh: "涵涵", gender: "female" },
  yating: { zh: "雅婷", gender: "female" },
  zhiwei: { zh: "志伟", gender: "male" },
  hsiaochen: { zh: "曉臻", gender: "female" },
  hsiaoyu: { zh: "曉雨", gender: "female" },
  yunjhe: { zh: "雲哲", gender: "male" },
  hiugaai: { zh: "曉佳", gender: "female" },
  hiumaan: { zh: "曉曼", gender: "female" },
  wanlung: { zh: "雲龍", gender: "male" },
  tracy: { zh: "Tracy", gender: "female" },
  danny: { zh: "Danny", gender: "male" },
  tingting: { zh: "婷婷", gender: "female" },
  meijia: { zh: "美佳", gender: "female" },
  sinji: { zh: "善怡", gender: "female" },
};

const GENDER_LABEL: Record<Gender, string> = { female: "Nữ", male: "Nam", unknown: "" };

function normLang(lang: string): string {
  return lang.replace(/_/g, "-").toLowerCase();
}

/** Phân loại biến thể ngôn ngữ; undefined = không phải tiếng Trung. */
export function voiceVariant(v: VoiceLike): Variant | undefined {
  const l = normLang(v.lang);
  if (/^(yue|zh-hk|zh-mo)\b/.test(l) || /cantonese|粤語|粵語|廣東/i.test(v.name)) return "cantonese";
  if (l === "zh-cn" || l === "cmn-cn" || l === "cmn-hans-cn" || l === "zh-hans-cn" || l === "zh") return "cn";
  if (l === "zh-tw" || l === "cmn-tw" || l === "cmn-hant-tw" || l === "zh-hant-tw") return "tw";
  if (/^(zh|cmn)-cn-/.test(l) || /^(wuu|hak|nan|hsn|gan)\b/.test(l)) return "dialect";
  if (/^(zh|cmn)\b/.test(l)) return "dialect";
  return undefined;
}

function knownKey(name: string): string | undefined {
  const words = name.toLowerCase().match(/[a-z]+/g) ?? [];
  return words.find((w) => KNOWN[w]);
}

export function voiceInfo<V extends VoiceLike>(v: V): VoiceInfo<V> | undefined {
  const variant = voiceVariant(v);
  if (!variant) return undefined;
  const isMs = /microsoft/i.test(v.name);
  const natural = isMs && /natural|online/i.test(v.name);
  const google = /google/i.test(v.name);
  const kind: VoiceKind = natural ? "natural" : isMs ? "microsoft" : google ? "google" : "other";
  const online = natural || google || v.localService === false;
  const key = knownKey(v.name);
  const gender = key ? KNOWN[key].gender : "unknown";

  // Thứ hạng: Natural zh-CN -> Microsoft Huihui/Yaoyao/Kangkang -> Google 普通话 -> zh-CN khác -> zh-TW -> (phương ngữ, Quảng Đông)
  let rank: number;
  if (variant === "cn") rank = kind === "natural" ? 0 : isMs && /huihui|yaoyao|kangkang/i.test(v.name) ? 1 : google ? 2 : 3;
  else if (variant === "tw") rank = 4;
  else if (variant === "dialect") rank = 5;
  else rank = 6;

  const display = key ? KNOWN[key].zh : google ? "Google 普通话" : v.name.replace(/^Microsoft\s+/i, "").replace(/\s+-\s+.*$/, "").trim();
  const parts = [display, GENDER_LABEL[gender], kind === "natural" ? "Natural" : "", online ? "cần mạng" : "trên máy"].filter(Boolean);
  if (variant === "tw") parts.push("Đài Loan");
  if (variant === "dialect") parts.push(dialectName(v.lang));
  if (variant === "cantonese") parts.push("Quảng Đông");
  return { voice: v, variant, kind, gender, online, rank, label: parts.join(" · ") };
}

function dialectName(lang: string): string {
  const l = normLang(lang);
  if (l.endsWith("liaoning")) return "phương ngữ Liêu Ninh";
  if (l.endsWith("shaanxi")) return "phương ngữ Thiểm Tây";
  return "phương ngữ";
}

/** Giọng tiếng Trung dùng được để học, đã xếp hạng (tốt nhất trước). Ẩn Quảng Đông & phương ngữ trừ khi bật. */
export function rankVoices<V extends VoiceLike>(voices: V[], opts: { showDialects?: boolean } = {}): VoiceInfo<V>[] {
  return voices
    .map((v) => voiceInfo(v))
    .filter((x): x is VoiceInfo<V> => !!x && (opts.showDialects || x.variant === "cn" || x.variant === "tw"))
    .map((x, i) => ({ x, i }))
    .sort((a, b) => a.x.rank - b.x.rank || a.i - b.i)
    .map(({ x }) => x);
}

/** Giọng đang dùng: giọng đã chọn (nếu còn trong danh sách), không thì giọng hạng cao nhất ("Tự động"). */
export function resolvePrimary<V extends VoiceLike>(ranked: VoiceInfo<V>[], preferredURI?: string): VoiceInfo<V> | undefined {
  return (preferredURI && ranked.find((x) => x.voice.voiceURI === preferredURI)) || ranked[0];
}

/**
 * Giọng cho người nói thứ hai trong hội thoại: giọng KHÁC GIỚI tốt nhất (ưu tiên cặp 晓晓 + 云希),
 * không bao giờ là Quảng Đông hay phương ngữ. Không có giọng khác giới thì lấy giọng khác bất kỳ.
 */
export function partnerVoice<V extends VoiceLike>(ranked: VoiceInfo<V>[], primary: VoiceInfo<V> | undefined): VoiceInfo<V> | undefined {
  const pool = ranked.filter((x) => (x.variant === "cn" || x.variant === "tw") && x.voice.voiceURI !== primary?.voice.voiceURI);
  if (!primary) return pool[0];
  const want: Gender = primary.gender === "male" ? "female" : primary.gender === "female" ? "male" : "unknown";
  if (want !== "unknown") {
    const pairName = want === "male" ? "yunxi" : "xiaoxiao";
    const pair = pool.find((x) => knownKey(x.voice.name) === pairName && x.variant === primary.variant);
    if (pair) return pair;
    const sameVariant = pool.find((x) => x.gender === want && x.variant === primary.variant);
    if (sameVariant) return sameVariant;
    const any = pool.find((x) => x.gender === want);
    if (any) return any;
  }
  return pool.find((x) => x.variant === primary.variant) ?? pool[0];
}

/** Giọng theo giới tính (hội thoại trong đề thi: 男 / 女). */
export function voiceForGender<V extends VoiceLike>(ranked: VoiceInfo<V>[], primary: VoiceInfo<V> | undefined, gender: Gender): VoiceInfo<V> | undefined {
  if (!primary) return undefined;
  if (gender === "unknown" || primary.gender === gender) return primary;
  const p = partnerVoice(ranked, primary);
  return p && p.gender === gender ? p : primary;
}

export interface VoiceGroup<V extends VoiceLike = VoiceLike> {
  label: string;
  items: VoiceInfo<V>[];
}

/**
 * Nhóm cho <optgroup>: Đề xuất (cặp nữ/nam tốt nhất) · Microsoft Natural (cần mạng) · Giọng cài trên máy ·
 * Phổ thông Đài Loan (zh-TW) · Quảng Đông & phương ngữ (chỉ khi bật). Mỗi giọng chỉ xuất hiện một lần.
 */
export function groupVoices<V extends VoiceLike>(ranked: VoiceInfo<V>[]): VoiceGroup<V>[] {
  const best = ranked[0];
  const suggested = best ? [best, partnerVoice(ranked, best)].filter((x): x is VoiceInfo<V> => !!x && x.variant === "cn") : [];
  const used = new Set(suggested.map((x) => x.voice.voiceURI));
  const rest = ranked.filter((x) => !used.has(x.voice.voiceURI));
  const groups: VoiceGroup<V>[] = [
    { label: "Đề xuất", items: suggested },
    { label: "Microsoft Natural (cần mạng)", items: rest.filter((x) => x.variant === "cn" && x.kind === "natural") },
    { label: "Giọng cài trên máy", items: rest.filter((x) => x.variant === "cn" && x.kind !== "natural" && !x.online) },
    { label: "Giọng online khác", items: rest.filter((x) => x.variant === "cn" && x.kind !== "natural" && x.online) },
    { label: "Phổ thông Đài Loan (zh-TW)", items: rest.filter((x) => x.variant === "tw") },
    { label: "Quảng Đông & phương ngữ (không dùng để học tiếng phổ thông)", items: rest.filter((x) => x.variant === "dialect" || x.variant === "cantonese") },
  ];
  return groups.filter((g) => g.items.length);
}

export const hasNaturalVoice = (ranked: VoiceInfo[]) => ranked.some((x) => x.kind === "natural" && x.variant === "cn");

// ---------- Chia câu dài ----------

/**
 * Chia văn bản dài theo dấu câu (Chrome hay tự dừng giữa chừng với câu dài). Đoạn ≤ maxLen ký tự;
 * không cắt giữa chữ trừ khi một đoạn không có dấu câu dài hơn maxLen.
 */
export function splitForTts(text: string, maxLen = 60): string[] {
  const t = text.trim();
  if (!t) return [];
  if ([...t].length <= maxLen) return [t];
  const pieces = t.match(/[^。！？!?；;，,、：:\n]+[。！？!?；;，,、：:\n]*/g) ?? [t];
  const out: string[] = [];
  let cur = "";
  for (const p of pieces) {
    if ([...(cur + p)].length <= maxLen) cur += p;
    else {
      if (cur) out.push(cur);
      if ([...p].length <= maxLen) cur = p;
      else {
        const chars = [...p];
        for (let i = 0; i < chars.length; i += maxLen) out.push(chars.slice(i, i + maxLen).join(""));
        cur = "";
      }
    }
  }
  if (cur) out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}
