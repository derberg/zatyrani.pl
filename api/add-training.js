import { Octokit } from "@octokit/rest";
import { createOrUpdateTextFile } from "@octokit/plugin-create-or-update-text-file";
import { readExistingData, updateFile, formatDateTime, generateTrainingUID } from "../src/utils/events.js";

export { generateTrainingUID, formatDateTime };

const ExtendedOctokit = Octokit.plugin(createOrUpdateTextFile);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { type, datetime, location, locationLink, comment, phone, distance, pace } = req.body;

    const octokit = new ExtendedOctokit({
      auth: process.env.GITHUB_TOKEN,
    });

    // przygotuj obiekt treningu
    const trainingData = {
      uid: generateTrainingUID(type, datetime, location, distance, pace),
      type,
      datetime: formatDateTime(datetime),
      location,
      locationLink,
      comment: comment || "",
      phone,
      distance: Number(distance),
      pace: Number(pace),
    };

    const trainings = await readExistingData(octokit, true);

    trainings.push(trainingData);

    await updateFile(
      octokit,
      `chore(trainings): added training ${trainingData.datetime} @ ${location}`,
      trainings,
      true
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error saving training:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
}

