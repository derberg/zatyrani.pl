import { describe, it, expect } from 'vitest';
import { generateUID } from './add-event.js';
import { formatDate } from './add-event.js';
import { normalizeEventData } from './add-event.js';

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
});

describe('normalizeEventData', () => {
  it('should normalize event data correctly', () => {
    const input = {
      name: 'Test Event',
      date: '2025-10-27',
      website: 'https://example.com',
      registration: 'https://example.com/register',
      description: 'An example event',
      location: 'Online'
    };

    const result = normalizeEventData(input);

    // Check main structure
    expect(result.title).toBe('Test Event');
    expect(result.mainLink).toBe('https://example.com');
    expect(result.registrationLink).toBe('https://example.com/register');
    expect(result.description).toBe('An example event');
    expect(result.image).toBe('');
    expect(result.location).toBe('Online');

    // Check generated fields
    expect(result.date).toBeTruthy(); // formatted date
    expect(result.uid).toBeTruthy();  // generated UID
  });

  it('should handle empty strings', () => {
    const input = {
      name: '',
      date: '',
      website: '',
      registration: '',
      description: '',
      location: ''
    };

    const result = normalizeEventData(input);

    expect(result.title).toBe('');
    expect(result.mainLink).toBe('');
    expect(result.registrationLink).toBe('');
    expect(result.description).toBe('');
    expect(result.image).toBe('');
    expect(result.location).toBe('');
    expect(result.date).toBeTruthy();
    expect(result.uid).toBeTruthy();
  });
});
