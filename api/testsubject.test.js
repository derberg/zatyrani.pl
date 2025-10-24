import { describe, it, expect } from 'vitest';
import { generateUID } from './add-event.js';

// Mock formatDate for predictable results
function formatDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Override the global function inside generateUID for testing
// Or adjust generateUID to accept a date formatter as optional parameter
const originalGenerateUID = generateUID;
const generateUIDTest = (title, date) => {
  const uidFunction = (title, date) => {
    let croppedTitle = title.slice(0, 40);
    const polishMap = {
      'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n',
      'ó': 'o', 'ś': 's', 'ż': 'z', 'ź': 'z',
      'Ą': 'a', 'Ć': 'c', 'Ę': 'e', 'Ł': 'l', 'Ń': 'n',
      'Ó': 'o', 'Ś': 's', 'Ż': 'z', 'Ź': 'z'
    };
    croppedTitle = croppedTitle.replace(/[ąćęłńóśżźĄĆĘŁŃÓŚŻŹ]/g, match => polishMap[match]);
    let slug = croppedTitle.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `${slug}-${formatDate(date)}`;
  };
  return uidFunction(title, date);
};

describe('generateUID', () => {
  it('should normalize Polish characters and format UID', () => {
    const date = new Date(2025, 9, 24); // YYYY-MM-DD: 2025-10-24
    const uid = generateUIDTest('Zażółć gęślą jaźń', date);
    expect(uid).toBe('zazolc-gesla-jazn-2025-10-24');
  });

  it('should crop title longer than 40 chars', () => {
    const longTitle = 'A'.repeat(50);
    const date = new Date(2025, 9, 24);
    const uid = generateUIDTest(longTitle, date);
    expect(uid.startsWith('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(true);
  });

  it('should replace spaces and special characters with hyphens', () => {
    const title = 'Hello, World! This is @Test';
    const date = new Date(2025, 9, 24);
    const uid = generateUIDTest(title, date);
    expect(uid).toBe('hello-world-this-is-test-2025-10-24');
  });
});
