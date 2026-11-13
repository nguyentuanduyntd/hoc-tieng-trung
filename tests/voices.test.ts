import { describe, expect, it } from "vitest";
import { groupVoices, hasNaturalVoice, partnerVoice, rankVoices, resolvePrimary, splitForTts, voiceForGender, voiceInfo, voiceVariant } from "../src/lib/voices.ts";

/** Đúng 20 giọng tiếng Trung như Microsoft Edge trên Windows liệt kê (cả local và Online Natural). */
const EDGE: { voiceURI: string; name: string; lang: string; localService: boolean }[] = [
  { name: "Microsoft Huihui - Chinese (Simplified, PRC)", lang: "zh-CN", localService: true },
  { name: "Microsoft Kangkang - Chinese (Simplified, PRC)", lang: "zh-CN", localService: true },
  { name: "Microsoft Yaoyao - Chinese (Simplified, PRC)", lang: "zh-CN", localService: true },
  { name: "Microsoft Hanhan - Chinese (Traditional, Taiwan)", lang: "zh-TW", localService: true },
  { name: "Microsoft Yating - Chinese (Traditional, Taiwan)", lang: "zh-TW", localService: true },
  { name: "Microsoft Zhiwei - Chinese (Traditional, Taiwan)", lang: "zh-TW", localService: true },
  { name: "Microsoft Tracy - Chinese (Traditional, Hong Kong S.A.R.)", lang: "zh-HK", localService: true },
  { name: "Microsoft Danny - Chinese (Traditional, Hong Kong S.A.R.)", lang: "zh-HK", localService: true },
  { name: "Microsoft HiuGaai Online (Natural) - Chinese (Cantonese Traditional)", lang: "zh-HK", localService: false },
  { name: "Microsoft HiuMaan Online (Natural) - Chinese (Hong Kong SAR)", lang: "zh-HK", localService: false },
  { name: "Microsoft WanLung Online (Natural) - Chinese (Hong Kong SAR)", lang: "zh-HK", localService: false },
  { name: "Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)", lang: "zh-CN", localService: false },
  { name: "Microsoft Xiaoyi Online (Natural) - Chinese (Mainland)", lang: "zh-CN", localService: false },
  { name: "Microsoft Yunjian Online (Natural) - Chinese (Mainland)", lang: "zh-CN", localService: false },
  { name: "Microsoft Yunxi Online (Natural) - Chinese (Mainland)", lang: "zh-CN", localService: false },
  { name: "Microsoft Yunxia Online (Natural) - Chinese (Mainland)", lang: "zh-CN", localService: false },
  { name: "Microsoft Yunyang Online (Natural) - Chinese (Mainland)", lang: "zh-CN", localService: false },
  { name: "Microsoft Xiaobei Online (Natural) - Chinese (Northeastern Mandarin)", lang: "zh-CN-liaoning", localService: false },
  { name: "Microsoft Xiaoni Online (Natural) - Chinese (Zhongyuan Mandarin Shaanxi)", lang: "zh-CN-shaanxi", localService: false },
  { name: "Microsoft HsiaoChen Online (Natural) - Chinese (Taiwan)", lang: "zh-TW", localService: false },
].map((v) => ({ ...v, voiceURI: v.name }));

const names = (xs: { voice: { name: string } }[]) => xs.map((x) => x.voice.name.replace(/^Microsoft /, "").split(" ")[0]);

describe("danh sách 20 giọng Edge", () => {
  it("đúng 20 giọng", () => expect(EDGE).toHaveLength(20));

  it("phân loại biến thể: zh-CN chuẩn, zh-TW, phương ngữ, Quảng Đông", () => {
    const by = (n: string) => voiceVariant(EDGE.find((v) => v.name.includes(n))!);
    expect(by("Xiaoxiao")).toBe("cn");
    expect(by("Huihui")).toBe("cn");
    expect(by("Hanhan")).toBe("tw");
    expect(by("Xiaobei")).toBe("dialect"); // zh-CN-liaoning KHÔNG phải zh-CN
    expect(by("Xiaoni")).toBe("dialect"); // zh-CN-shaanxi
    expect(by("Tracy")).toBe("cantonese");
    expect(by("HiuGaai")).toBe("cantonese");
    expect(voiceVariant({ voiceURI: "x", name: "Google US English", lang: "en-US" })).toBeUndefined();
  });

  it("mặc định ẩn Quảng Đông & phương ngữ: còn 9 zh-CN + 4 zh-TW", () => {
    const r = rankVoices(EDGE);
    expect(r).toHaveLength(13);
    expect(r.every((x) => x.variant === "cn" || x.variant === "tw")).toBe(true);
    expect(rankVoices(EDGE, { showDialects: true })).toHaveLength(20);
  });

  it("xếp hạng: Natural zh-CN → Huihui/Yaoyao/Kangkang → zh-TW", () => {
    const r = rankVoices(EDGE);
    expect(names(r.slice(0, 6))).toEqual(["Xiaoxiao", "Xiaoyi", "Yunjian", "Yunxi", "Yunxia", "Yunyang"]);
    expect(names(r.slice(6, 9))).toEqual(["Huihui", "Kangkang", "Yaoyao"]);
    expect(r.slice(9).every((x) => x.variant === "tw")).toBe(true);
  });

  it("phương ngữ & Quảng Đông khi bật thì xếp cuối", () => {
    const r = rankVoices(EDGE, { showDialects: true });
    expect(r.slice(13).every((x) => x.variant === "dialect" || x.variant === "cantonese")).toBe(true);
  });

  it("Tự động = giọng hạng cao nhất (晓晓 Natural)", () => {
    const r = rankVoices(EDGE);
    expect(resolvePrimary(r)?.label).toBe("晓晓 · Nữ · Natural · cần mạng");
  });

  it("giọng đã chọn còn tồn tại thì dùng; không còn thì về Tự động", () => {
    const r = rankVoices(EDGE);
    expect(resolvePrimary(r, "Microsoft Kangkang - Chinese (Simplified, PRC)")?.voice.name).toMatch(/Kangkang/);
    expect(resolvePrimary(r, "giọng-đã-mất")?.voice.name).toMatch(/Xiaoxiao/);
  });

  it("người nói thứ hai: khác giới, ưu tiên cặp 晓晓 + 云希, không phải Quảng Đông/phương ngữ", () => {
    const r = rankVoices(EDGE, { showDialects: true });
    const xiao = resolvePrimary(r)!;
    expect(partnerVoice(r, xiao)?.voice.name).toMatch(/Yunxi /);
    const yunjian = r.find((x) => /Yunjian/.test(x.voice.name))!;
    expect(partnerVoice(r, yunjian)?.voice.name).toMatch(/Xiaoxiao/);
    const huihui = r.find((x) => /Huihui/.test(x.voice.name))!;
    const p = partnerVoice(r, huihui)!;
    expect(p.gender).toBe("male");
    expect(["cantonese", "dialect"]).not.toContain(p.variant);
  });

  it("giọng theo giới tính cho hội thoại đề thi (男/女)", () => {
    const r = rankVoices(EDGE);
    const xiao = resolvePrimary(r);
    expect(voiceForGender(r, xiao, "female")?.voice.name).toMatch(/Xiaoxiao/);
    expect(voiceForGender(r, xiao, "male")?.voice.name).toMatch(/Yunxi /);
  });

  it("nhóm dropdown: Đề xuất = cặp nữ/nam, mỗi giọng xuất hiện một lần", () => {
    const g = groupVoices(rankVoices(EDGE));
    expect(g.map((x) => x.label)).toEqual(["Đề xuất", "Microsoft Natural (cần mạng)", "Giọng cài trên máy", "Phổ thông Đài Loan (zh-TW)"]);
    expect(names(g[0].items)).toEqual(["Xiaoxiao", "Yunxi"]);
    const all = g.flatMap((x) => x.items.map((i) => i.voice.voiceURI));
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(13);
  });

  it("tên rút gọn", () => {
    const r = rankVoices(EDGE, { showDialects: true });
    const lab = (n: string) => r.find((x) => x.voice.name.includes(n))!.label;
    expect(lab("Yunxi ")).toBe("云希 · Nam · Natural · cần mạng");
    expect(lab("Huihui")).toBe("慧慧 · Nữ · trên máy");
    expect(lab("Hanhan")).toBe("涵涵 · Nữ · trên máy · Đài Loan");
    expect(lab("Xiaobei")).toContain("Liêu Ninh");
    expect(lab("Tracy")).toContain("Quảng Đông");
  });

  it("có / không có giọng Natural", () => {
    expect(hasNaturalVoice(rankVoices(EDGE))).toBe(true);
    expect(hasNaturalVoice(rankVoices(EDGE.filter((v) => v.localService)))).toBe(false);
  });
});

describe("trình duyệt khác", () => {
  it("Chrome: Google 普通话 xếp trên giọng zh-CN lạ, dưới Microsoft local", () => {
    const chrome = [
      { voiceURI: "g", name: "Google 普通话（中国大陆）", lang: "zh-CN", localService: false },
      { voiceURI: "o", name: "Some Other Voice", lang: "zh-CN", localService: true },
      { voiceURI: "h", name: "Microsoft Huihui - Chinese (Simplified, PRC)", lang: "zh-CN", localService: true },
      { voiceURI: "hk", name: "Google 粤語（香港）", lang: "zh-HK", localService: false },
    ];
    expect(rankVoices(chrome).map((x) => x.voice.voiceURI)).toEqual(["h", "g", "o"]);
    expect(voiceInfo(chrome[0])!.label).toBe("Google 普通话 · cần mạng");
  });
  it("Android/iOS đặt lang dạng zh_CN / cmn-Hans-CN vẫn nhận là zh-CN", () => {
    expect(voiceVariant({ voiceURI: "a", name: "x", lang: "zh_CN" })).toBe("cn");
    expect(voiceVariant({ voiceURI: "b", name: "x", lang: "cmn-Hans-CN" })).toBe("cn");
  });
  it("không có giọng nào", () => {
    expect(rankVoices([])).toEqual([]);
    expect(resolvePrimary([])).toBeUndefined();
    expect(groupVoices([])).toEqual([]);
  });
});

describe("chia câu dài", () => {
  it("câu ngắn giữ nguyên", () => expect(splitForTts("你好！")).toEqual(["你好！"]));
  it("câu dài chia theo dấu câu, không mất chữ", () => {
    const t = "今天是星期六，天气很好，不冷也不热。我和朋友去外边玩。我们去了商店，买了很多东西。中午我们在饭店吃饭。";
    const parts = splitForTts(t, 20);
    expect(parts.join("")).toBe(t);
    expect(parts.every((p) => [...p].length <= 20)).toBe(true);
    expect(parts.length).toBeGreaterThan(1);
  });
  it("đoạn không có dấu câu dài hơn giới hạn thì cắt cứng", () => {
    const t = "一".repeat(25);
    expect(splitForTts(t, 10).map((p) => p.length)).toEqual([10, 10, 5]);
  });
});
