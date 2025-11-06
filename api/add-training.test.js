import { describe, it, expect } from "vitest";
import { generateTrainingUID, formatDateTime } from "./add-training.js";

describe("generateTrainingUID", () => {
  it("should generate a UID with a standard case", () => {
    const uid = generateTrainingUID("bieg", "2025-05-10T08:00:00Z", "Stanica Stacja", 20, 7);
    expect(uid).toBe("bieg-10-5-2025-8-0-stanica-stacja-20-7");
  });

  it("should normalize Polish characters in the location", () => {
    const uid = generateTrainingUID("bieg", "2025-05-10T08:00:00Z", "Zażółć gęślą jaźń", 20, 7);
    expect(uid).toBe("bieg-10-5-2025-8-0-zazolc-gesla-jazn-20-7");
  });

  it("should handle spaces and special characters in the location", () => {
    const uid = generateTrainingUID(
      "bieg",
      "2025-05-10T08:00:00Z",
      "Location with spaces & chars!",
      20,
      7,
    );
    expect(uid).toBe("bieg-10-5-2025-8-0-location-with-spaces-chars-20-7");
  });

  it("should handle a different date format", () => {
    const uid = generateTrainingUID(
      "nordic walking",
      "12/05/2025 18:30",
      "Nieborowice – Krzyż",
      8,
      11,
    );
    expect(uid).toBe("nordic-walking-12-05-2025-18-30-nieborowice-krzyz-8-11");
  });
});

describe("formatDateTime", () => {
  it("should format a standard date string correctly", () => {
    const result = formatDateTime("2025-10-27T12:00:00Z");
    expect(result).toBe("27/10/2025 12:00");
  });

  it("should pad single-digit days and months with zeros", () => {
    const result = formatDateTime("2025-01-05T08:05:00Z");
    expect(result).toBe("05/01/2025 08:05");
  });
});
