// scripts/generate-uids.js

import fs from "fs/promises";
import path from "path";

const dataPath = path.resolve("src/data/events.json");

// Helper to slugify strings (lowercase, replace non-alphanumeric with hyphens)
export function slugify(str) {
  return str
    .toLowerCase()
    // Replace Polish characters with ASCII equivalents
    .replace(/ą/g, "a")
    .replace(/ć/g, "c")
    .replace(/ę/g, "e")
    .replace(/ł/g, "l")
    .replace(/ń/g, "n")
    .replace(/ó/g, "o")
    .replace(/ś/g, "s")
    .replace(/ź/g, "z")
    .replace(/ż/g, "z")
    // Now remove anything else that’s not alphanumeric
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function generateUIDs() {
  try {
    // Load and parse the events JSON asynchronously
    const fileContent = await fs.readFile(dataPath, "utf-8");
    const events = JSON.parse(fileContent);

    // Generate UID for each event
    for (const event of events) {
      const titleSlug = slugify(event.title || "");
      const dateSlug = slugify(event.date || "");
      event.uid = `${titleSlug}-${dateSlug}`;
    }

    // Write the updated events back to file asynchronously
    await fs.writeFile(dataPath, JSON.stringify(events, null, 2), "utf-8");

    console.log("UIDs generated successfully!");
  } catch (error) {
    console.error("Error generating UIDs:", error);
  }
}

// Run the function
generateUIDs();