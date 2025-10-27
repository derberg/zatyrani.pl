import { describe, it, expect } from 'vitest';
import { generateUID } from './add-event.js';
import { formatDate } from './add-event.js';

describe('generateUID', () => {
  it('should normalize Polish characters and format UID', () => {
    const date = new Date(2025, 9, 24); // YYYY-MM-DD: 2025-10-24
    const uid = generateUID('Zażółć gęślą jaźń', date);
    expect(uid).toBe('zazolc-gesla-jazn-24-10-2025');
  });

  it('should crop title longer than 40 chars', () => {
    const longTitle = 'A'.repeat(50);
    const date = new Date(2025, 9, 24);
    const uid = generateUID(longTitle, date);
    expect(uid).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-24-10-2025');
  });

  it('should replace spaces and special characters with hyphens', () => {
    const title = 'Hello, World! This is @Test';
    const date = new Date(2025, 9, 24);
    const uid = generateUID(title, date);
    expect(uid).toBe('hello-world-this-is-test-24-10-2025');
  });
});

describe("formatDate", () => {
  it("formats a valid date string correctly", () => {
    const result = formatDate("2025-10-27");
    expect(result).toBe("27/10/2025");
  });

  it("pads single-digit days and months with zeros", () => {
    const result = formatDate("2025-01-05");
    expect(result).toBe("05/01/2025");
  });

  it("handles different date formats (e.g., with time)", () => {
    const result = formatDate("2025-12-03T15:30:00Z");
    expect(result).toBe("03/12/2025");
  });

  it("handles date strings with time zone offsets", () => {
    const result = formatDate("2025-07-01T00:00:00+02:00");
    // Depending on timezone, result could differ slightly — test should match expected local interpretation
    expect(result).toBe("01/07/2025");
  });
});