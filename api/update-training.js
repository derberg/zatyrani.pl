import { Octokit } from "@octokit/rest";
import { createOrUpdateTextFile } from "@octokit/plugin-create-or-update-text-file";
import { formatDateTime } from "./add-training.js";

const ExtendedOctokit = Octokit.plugin(createOrUpdateTextFile);

export function updateTrainingByUid(dataForChange, trainings, uid) {
  const trainingIndex = trainings.findIndex(training => training.uid === uid);

  trainings[trainingIndex] = {
    ...trainings[trainingIndex],
    ...dataForChange
  };
  return trainings;
}

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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

    const { data: currentFile } = await octokit.repos.getContent({
      owner: "derberg",
      repo: "zatyrani.pl",
      path: "src/data/trainings.json",
    });

    const raw = Buffer.from(currentFile.content, "base64").toString();
    const trainings = JSON.parse(raw || "[]");
    
    const updatedTrainings = updateTrainingByUid(dataForChange, trainings, uid);

    await octokit.createOrUpdateTextFile({
      owner: "derberg",
      repo: "zatyrani.pl",
      path: "src/data/trainings.json",
      message: `chore(trainings): updated training with UID ${uid}`,
      content: JSON.stringify(updatedTrainings, null, 2),
    });

    res.status(200).json({ success: true, message: `Training with UID ${uid} updated successfully.` });
  } catch (error) {
    console.error("Error updating training:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
}
