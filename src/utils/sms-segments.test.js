import { describe, it, expect } from "vitest";
import { encoding, segments, transliterate } from "./sms-segments.js";

describe("encoding", () => {
  it("plain ASCII is GSM-7", () => {
    expect(encoding("Hello world")).toBe("GSM-7");
  });

  it("empty string is GSM-7", () => {
    expect(encoding("")).toBe("GSM-7");
  });

  it("Polish accents force UCS-2", () => {
    expect(encoding("Cześć")).toBe("UCS-2");
    expect(encoding("źdźbło")).toBe("UCS-2");
  });

  it("GSM extension characters stay GSM-7", () => {
    expect(encoding("price: 5€")).toBe("GSM-7");
    expect(encoding("[link]")).toBe("GSM-7");
    expect(encoding("a^b|c")).toBe("GSM-7");
  });

  it("emoji forces UCS-2", () => {
    expect(encoding("hello 🚀")).toBe("UCS-2");
  });
});

describe("segments", () => {
  it("empty string is zero segments", () => {
    expect(segments("")).toBe(0);
  });

  it("short ASCII is one segment", () => {
    expect(segments("Hello")).toBe(1);
  });

  it("160-char GSM-7 is one segment", () => {
    expect(segments("a".repeat(160))).toBe(1);
  });

  it("161-char GSM-7 is two segments (153 per part)", () => {
    expect(segments("a".repeat(161))).toBe(2);
  });

  it("306-char GSM-7 is two segments (2 × 153)", () => {
    expect(segments("a".repeat(306))).toBe(2);
  });

  it("307-char GSM-7 is three segments", () => {
    expect(segments("a".repeat(307))).toBe(3);
  });

  it("GSM extension characters count as 2 septets", () => {
    // 80 base chars + 40 extension chars = 80 + 80 = 160 septets → 1 segment
    expect(segments("a".repeat(80) + "€".repeat(40))).toBe(1);
    // 80 base chars + 41 extension chars = 80 + 82 = 162 septets → 2 segments
    expect(segments("a".repeat(80) + "€".repeat(41))).toBe(2);
  });

  it("short Polish (UCS-2) is one segment", () => {
    expect(segments("Cześć")).toBe(1);
  });

  it("70 UCS-2 code units is one segment", () => {
    expect(segments("ą".repeat(70))).toBe(1);
  });

  it("71 UCS-2 code units is two segments (67 per part)", () => {
    expect(segments("ą".repeat(71))).toBe(2);
  });

  it("134 UCS-2 code units is two segments (2 × 67)", () => {
    expect(segments("ą".repeat(134))).toBe(2);
  });

  it("135 UCS-2 code units is three segments", () => {
    expect(segments("ą".repeat(135))).toBe(3);
  });
});

describe("transliterate", () => {
  it("strips Polish lowercase accents", () => {
    expect(transliterate("ąćęłńóśźż")).toBe("acelnoszz");
  });

  it("strips Polish uppercase accents", () => {
    expect(transliterate("ĄĆĘŁŃÓŚŹŻ")).toBe("ACELNOSZZ");
  });

  it("leaves ASCII untouched", () => {
    expect(transliterate("Hello world!")).toBe("Hello world!");
  });

  it("transliterates a real sentence", () => {
    expect(transliterate("Cześć, źdźbło rośnie.")).toBe(
      "Czesc, zdzblo rosnie."
    );
  });

  it("flips encoding to GSM-7 after transliteration", () => {
    const before = "Cześć";
    expect(encoding(before)).toBe("UCS-2");
    expect(encoding(transliterate(before))).toBe("GSM-7");
  });

  it("does not touch other non-ASCII (e.g. emoji)", () => {
    expect(transliterate("ąć🚀")).toBe("ac🚀");
  });
});
