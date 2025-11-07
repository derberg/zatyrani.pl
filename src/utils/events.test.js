import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readExistingEventsData, formatDate } from './events.js';


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


describe("readExistingEventsData", () => {
  let mockOctokit;

  beforeEach(() => {
    mockOctokit = {
      repos: {
        getContent: vi.fn(),
      },
    };
  });

  it("should return empty array when content is empty", async () => {
    mockOctokit.repos.getContent.mockResolvedValue({
      data: {
        content: "",
      },
    });

    const result = await readExistingEventsData(mockOctokit);

    expect(result).toEqual([]);
  });

  it("should decode and parse events from base64 content", async () => {
    const mockEvents = [
      {
        title: "Bieg Ultra Trail",
        location: "Jaworze",
        date: "11/02/2023",
        description: "Każdy biegnie ile chce.",
        image: "events/tempfile0.webp",
        mainLink: "https://www.facebook.com/events/770434970865092",
        registrationLink:
          "https://zapisy.inessport.pl/index.php?idm=5&idp=0&act=zgloszenie-zawodnika&event=880",
        uid: "bieg-ultra-trail-11-02-2023",
      },
    ];

    const base64Content = Buffer.from(JSON.stringify(mockEvents)).toString("base64");

    mockOctokit.repos.getContent.mockResolvedValue({
      data: {
        content: base64Content,
      },
    });

    const result = await readExistingEventsData(mockOctokit);

    expect(result).toEqual(mockEvents);
    expect(result[0].title).toBe("Bieg Ultra Trail");
  });
});
