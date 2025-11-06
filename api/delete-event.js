import { Octokit } from "@octokit/rest";
import { createOrUpdateTextFile } from "@octokit/plugin-create-or-update-text-file";

import { readExistingEventsData, updateEventsFile } from "../src/utils/events.js";

const ExtendedOctokit = Octokit.plugin(createOrUpdateTextFile);

export function deleteEventByUid(events, uid) {
  const initialLength = events.length;
  const updatedEvents = events.filter(event => event.uid !== uid);

  if (updatedEvents.length === initialLength) {
    return null; // Or throw an error, depending on desired behavior
  }

  return updatedEvents;
}

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { uid } = req.body; // Get UID from request body

  if (!uid) {
    return res.status(400).json({ error: "Event UID is missing" });
  }

  try {
    const octokit = new ExtendedOctokit({
      auth: process.env.GITHUB_TOKEN,
    });

    // Fetch existing events
    let events = await readExistingEventsData(octokit);

    // Filter out the event with the matching UID
    const updatedEvents = deleteEventByUid(events, uid);

    if (updatedEvents === null) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Update the events.json file
    		await updateEventsFile(
    			octokit,
    			`chore(events): deleted event with UID ${uid}`,
    			JSON.stringify(updatedEvents, null, 2)
    		);
    res.status(200).json({ success: true, message: `Event with UID ${uid} deleted successfully.` });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
}
