import { Octokit } from "@octokit/rest";
import { createOrUpdateTextFile } from "@octokit/plugin-create-or-update-text-file";
import { readExistingEventsData, updateEventsFile } from "../src/utils/events.js";

const ExtendedOctokit = Octokit.plugin(createOrUpdateTextFile);

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { uid, name, date, website, registration, description, location } = req.body;

  if (!uid) {
    return res.status(400).json({ error: "Event UID is missing" });
  }

  try {
    const octokit = new ExtendedOctokit({
      auth: process.env.GITHUB_TOKEN,
    });

    let events = await readExistingEventsData(octokit);

    // Find the index of the event to update
    const eventIndex = events.findIndex(event => event.uid === uid);

    if (eventIndex === -1) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Update the event data
    events[eventIndex] = {
      ...events[eventIndex], // Keep existing fields like image
      title: name,
      date: date, // Assuming date is already formatted as DD/MM/YYYY
      location: location,
      description: description,
      mainLink: website,
      registrationLink: registration,
    };

    await updateEventsFile(
      octokit,
      `chore(events): updated event with UID ${uid}`,
      JSON.stringify(events, null, 2)
    );

    res.status(200).json({ success: true, message: `Event with UID ${uid} updated successfully.` });
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
}
