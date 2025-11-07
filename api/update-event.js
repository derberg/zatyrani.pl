import { Octokit } from "@octokit/rest";
import { createOrUpdateTextFile } from "@octokit/plugin-create-or-update-text-file";
import { readExistingEventsData, updateEventsFile } from "../src/utils/events.js";

const ExtendedOctokit = Octokit.plugin(createOrUpdateTextFile);

export function updateEventByUid(dataForChange, events, uid) {
  // Find the index of the event to update
  const eventIndex = events.findIndex(event => event.uid === uid);

  // Update the event data
  events[eventIndex] = {
    ...events[eventIndex], // Keep existing fields like image
    ...dataForChange
  };
  return events;
}

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { uid, name, date, website, registration, description, location } = req.body;
  const dataForChange = { name, date, website, registration, description, location };
  try {
    const octokit = new ExtendedOctokit({
      auth: process.env.GITHUB_TOKEN,
    });

    let events = await readExistingEventsData(octokit);
    const updatedEvents = updateEventByUid(dataForChange, events, uid);;
    await updateEventsFile(
      octokit,
      `chore(events): updated event with UID ${uid}`,
      updatedEvents
    );

    res.status(200).json({ success: true, message: `Event with UID ${uid} updated successfully.` });
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
}
