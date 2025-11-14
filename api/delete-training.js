import { Octokit } from "@octokit/rest";
import { createOrUpdateTextFile } from "@octokit/plugin-create-or-update-text-file";
import { readExistingData, updateFile, deleteByUid } from "../src/utils/events.js";

const ExtendedOctokit = Octokit.plugin(createOrUpdateTextFile);

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ error: "Training UID is missing" });
  }

  try {
    const octokit = new ExtendedOctokit({
      auth: process.env.GITHUB_TOKEN,
    });

    const trainings = await readExistingData(octokit, true);

    const updatedTrainings = deleteByUid(trainings, uid);

    if (updatedTrainings === null) {
      return res.status(404).json({ error: "Training not found" });
    }

    await updateFile(octokit, `chore(trainings): deleted training with UID ${uid}`, updatedTrainings, true);

    res.status(200).json({ success: true, message: `Training with UID ${uid} deleted successfully.` });
  } catch (error) {
    console.error("Error deleting training:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
}
