import { Octokit } from "@octokit/rest";
import { createOrUpdateTextFile } from "@octokit/plugin-create-or-update-text-file";
import { readExistingData, updateFile, updateByUid, formatDateTime } from "../src/utils/events.js";
import { verifyUser } from "../src/utils/auth.js";

const ExtendedOctokit = Octokit.plugin(createOrUpdateTextFile);

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Verify user is logged in
    await verifyUser(req);

    const { uid, type, datetime, location, locationLink, comment, phone, distance, pace } = req.body;

  const newDateTime = formatDateTime(datetime);

  const dataForChange = { 
    type, 
    datetime: newDateTime, 
    location, 
    locationLink, 
    comment, 
    phone, 
    distance: Number(distance), 
    pace: Number(pace) 
  };

  try {
    const octokit = new ExtendedOctokit({
      auth: process.env.GITHUB_TOKEN,
    });

    const trainings = await readExistingData(octokit, true);
    const updatedTrainings = updateByUid(trainings, uid, dataForChange);

    if (updatedTrainings === null) {
      return res.status(404).json({ error: "Training not found" });
    }

    await updateFile(
      octokit,
      `chore(trainings): updated training with UID ${uid}`,
      updatedTrainings,
      true
    );

    res.status(200).json({ success: true, message: `Training with UID ${uid} updated successfully.` });
  } catch (error) {
    if (error.message && (error.message.includes("Sesja") || error.message.includes("Brak"))) {
      res.status(401).json({ error: error.message });
    } else {
      console.error("Error updating training:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  }
} catch (error) {
  if (error.message && (error.message.includes("Sesja") || error.message.includes("Brak"))) {
    res.status(401).json({ error: error.message });
  } else {
    console.error("Error updating training:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
}
}
