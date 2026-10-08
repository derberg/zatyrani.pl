import { describe, it, expect } from "vitest";
import { cleanPhone, normalizeMemberPhone } from "./phone.js";

describe("cleanPhone", () => {
  it("strips bidi and zero-width marks", () => {
    expect(cleanPhone("\u202A+48123456789\u202C")).toBe("+48123456789");
    expect(cleanPhone("\u200B 600 100 200 ")).toBe("600 100 200");
  });

  it("handles empty input", () => {
    expect(cleanPhone(undefined)).toBe("");
  });
});

describe("normalizeMemberPhone", () => {
  it("normalizes Polish numbers to +48", () => {
    expect(normalizeMemberPhone("600100200")).toBe("+48600100200");
    expect(normalizeMemberPhone("600 100 200")).toBe("+48600100200");
    expect(normalizeMemberPhone("600-100-200")).toBe("+48600100200");
    expect(normalizeMemberPhone("0600100200")).toBe("+48600100200");
    expect(normalizeMemberPhone("48600100200")).toBe("+48600100200");
    expect(normalizeMemberPhone("+48 600 100 200")).toBe("+48600100200");
    expect(normalizeMemberPhone("0048600100200")).toBe("+48600100200");
    expect(normalizeMemberPhone("\u202A+48600100200\u202C")).toBe("+48600100200");
  });

  it("keeps foreign numbers given with + or 00", () => {
    expect(normalizeMemberPhone("+49 151 23456789")).toBe("+4915123456789");
    expect(normalizeMemberPhone("0044 7700 900123")).toBe("+447700900123");
  });

  it("rejects invalid input", () => {
    expect(normalizeMemberPhone("")).toBeNull();
    expect(normalizeMemberPhone("12345")).toBeNull();
    expect(normalizeMemberPhone("+48 600 100 20")).toBeNull();
    expect(normalizeMemberPhone("60010020a")).toBeNull();
    expect(normalizeMemberPhone("4915123456789")).toBeNull();
    expect(normalizeMemberPhone(null)).toBeNull();
  });
});
