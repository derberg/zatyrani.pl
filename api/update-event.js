import { Octokit } from "@octokit/rest";
import { createOrUpdateTextFile } from "@octokit/plugin-create-or-update-text-file";
import { readExistingData, updateFile, updateByUid, formatDate } from "../src/utils/events.js";
import { verifyUser } from "../src/utils/auth.js";

const ExtendedOctokit = Octokit.plugin(createOrUpdateTextFile);

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Verify user is logged in
    await verifyUser(req);

    const { uid, name, date, website, registration, description, location } = req.body;

  const newDate = formatDate(date);

  const dataForChange = { title: name, date: newDate, mainLink: website, registrationLink: registration, description, location };
  try {
    const octokit = new ExtendedOctokit({
      auth: process.env.GITHUB_TOKEN,
    });

    const events = await readExistingData(octokit);
    const updatedEvents = updateByUid(events, uid, dataForChange);

    if (updatedEvents === null) {
      return res.status(404).json({ error: "Event not found" });
    }

    await updateFile(
      octokit,
      `chore(events): updated event with UID ${uid}`,
      updatedEvents
    );

    res.status(200).json({ success: true, message: `Event with UID ${uid} updated successfully.` });
  } catch (error) {
    if (error.message && (error.message.includes("Sesja") || error.message.includes("Brak"))) {
      res.status(401).json({ error: error.message });
    } else {
      console.error("Error updating event:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  }
} catch (error) {
  if (error.message && (error.message.includes("Sesja") || error.message.includes("Brak"))) {
    res.status(401).json({ error: error.message });
  } else {
    console.error("Error updating event:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
}
}
