// src/pages/api/treningi.js
import { Octokit } from "@octokit/rest";
import { createOrUpdateTextFile } from "@octokit/plugin-create-or-update-text-file";

const ExtendedOctokit = Octokit.plugin(createOrUpdateTextFile);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      type,
      datetime,
      location,
      locationLink,
      comment,
      phone,
      distance,
      pace
    } = req.body;

    const octokit = new ExtendedOctokit({
      auth: process.env.GITHUB_TOKEN,
    });

    // przygotuj obiekt treningu
    const trainingData = {
      type,
      datetime: formatDateTime(datetime),
      location,
      locationLink,
      comment: comment || "",
      phone,
      distance: Number(distance),
      pace: Number(pace),
    };

    // pobierz istniejące treści
    const { data: currentFile } = await octokit.repos.getContent({
      owner: "derberg",
      repo: "zatyrani.pl",
      path: "src/data/trainings.json",
    });

    const raw = Buffer.from(currentFile.content, "base64").toString();
    const trainings = JSON.parse(raw || "[]");

    trainings.push(trainingData);

    // zapisz plik z nową listą
    await octokit.createOrUpdateTextFile({
      owner: "derberg",
      repo: "zatyrani.pl",
      path: "src/data/trainings.json",
      message: `chore(trainings): added training ${trainingData.datetime} @ ${location}`,
      content: JSON.stringify(trainings, null, 2),
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error saving training:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
}

// Formatuje date-time na: DD/MM/YYYY HH:MM
function formatDateTime(dateTimeString) {
  const d = new Date(dateTimeString);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${mins}`;
}