import { Octokit } from "@octokit/rest";
import { createOrUpdateTextFile } from "@octokit/plugin-create-or-update-text-file";

const ExtendedOctokit = Octokit.plugin(createOrUpdateTextFile);

export default async function handler(req, res) {
  if (req.method !== "POST") {
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

    // Fetch existing events
    const { data: currentFile } = await octokit.repos.getContent({
      owner: "derberg",
      repo: "zatyrani.pl",
      path: "src/data/events.json",
    });

    const raw = Buffer.from(currentFile.content, "base64").toString();
    let events = JSON.parse(raw || "[]");

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

    // Update the events.json file
    await octokit.createOrUpdateTextFile({
      owner: "derberg",
      repo: "zatyrani.pl",
      path: "src/data/events.json",
      message: `chore(events): updated event with UID ${uid}`,
      content: JSON.stringify(events, null, 2),
      sha: currentFile.sha, // Required for updating existing file
    });

    res.status(200).json({ success: true, message: `Event with UID ${uid} updated successfully.` });
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
}
