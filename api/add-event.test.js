import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readExistingEventsData, generateEventUID, formatDate, normalizeEventData } from './add-event.js';

describe('readExistingEventsData', () => {
	let mockOctokit;

	beforeEach(() => {
		mockOctokit = {
			repos: {
				getContent: vi.fn()
			}
		};
	});

	it('should return empty array when content is empty', async () => {
		mockOctokit.repos.getContent.mockResolvedValue({
			data: {
				content: ''
			}
		});

		const result = await readExistingEventsData(mockOctokit);

		expect(result).toEqual([]);
	});

	it('should decode and parse events from base64 content', async () => {
		const mockEvents = [
			{
				"title": "Bieg Ultra Trail",
				"location": "Jaworze",
				"date": "11/02/2023",
				"description": "Każdy biegnie ile chce.",
				"image": "events/tempfile0.webp",
				"mainLink": "https://www.facebook.com/events/770434970865092",
				"registrationLink": "https://zapisy.inessport.pl/index.php?idm=5&idp=0&act=zgloszenie-zawodnika&event=880",
				"uid": "bieg-ultra-trail-11-02-2023"
			}
		];

		const base64Content = Buffer.from(JSON.stringify(mockEvents)).toString('base64');

		mockOctokit.repos.getContent.mockResolvedValue({
			data: {
				content: base64Content
			}
		});

		const result = await readExistingEventsData(mockOctokit);

		expect(result).toEqual(mockEvents);
		expect(result[0].title).toBe("Bieg Ultra Trail");
	});
});

describe('generateEventUID', () => {
	it('should normalize Polish characters and format UID', () => {
		const date = new Date(2025, 9, 24); // YYYY-MM-DD: 2025-10-24
		const uid = generateEventUID('Zażółć gęślą jaźń', date);
		expect(uid).toBe('zazolc-gesla-jazn-24-10-2025');
	});

	it('should crop title longer than 40 chars', () => {
		const longTitle = 'A'.repeat(50);
		const date = new Date(2025, 9, 24);
		const uid = generateEventUID(longTitle, date);
		expect(uid).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-24-10-2025');
	});

	it('should replace spaces and special characters with hyphens', () => {
		const title = 'Hello, World! This is @Test';
		const date = new Date(2025, 9, 24);
		const uid = generateEventUID(title, date);
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
});
