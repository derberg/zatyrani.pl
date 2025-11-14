import { Octokit } from "@octokit/rest";
import { createOrUpdateTextFile } from "@octokit/plugin-create-or-update-text-file";

const ExtendedOctokit = Octokit.plugin(createOrUpdateTextFile);

export function deleteTrainingByUid(trainings, uid) {
  const initialLength = trainings.length;
  const updatedTrainings = trainings.filter(training => training.uid !== uid);

  if (updatedTrainings.length === initialLength) {
    return null;
  }

  return updatedTrainings;
}

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

    const { data: currentFile } = await octokit.repos.getContent({
      owner: "derberg",
      repo: "zatyrani.pl",
      path: "src/data/trainings.json",
    });

    const raw = Buffer.from(currentFile.content, "base64").toString();
    const trainings = JSON.parse(raw || "[]");
    
    const updatedTrainings = deleteTrainingByUid(trainings, uid);

    if (updatedTrainings === null) {
      return res.status(404).json({ error: "Training not found" });
    }

    await octokit.createOrUpdateTextFile({
      owner: "derberg",
      repo: "zatyrani.pl",
      path: "src/data/trainings.json",
      message: `chore(trainings): deleted training with UID ${uid}`,
      content: JSON.stringify(updatedTrainings, null, 2),
    });

    res.status(200).json({ success: true, message: `Training with UID ${uid} deleted successfully.` });
  } catch (error) {
    console.error("Error deleting training:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
}
