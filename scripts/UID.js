// scripts/generate-uids.js

import fs from "fs";
import path from "path";

const dataPath = path.resolve("src/data/events.json");

// Load and parse the events JSON
const events = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

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

// Generate UID for each event
for (const event of events) {
  const titleSlug = slugify(event.title || "");
  const dateSlug = slugify(event.date || "");
  event.uid = `${titleSlug}-${dateSlug}`;
}

// Write the updated events back to file
fs.writeFileSync(dataPath, JSON.stringify(events, null, 2), "utf-8");
