import { Octokit } from "@octokit/rest";
import { createOrUpdateTextFile } from "@octokit/plugin-create-or-update-text-file";
import { verifyUser } from "../src/utils/auth.js";

const ExtendedOctokit = Octokit.plugin(createOrUpdateTextFile);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Verify user is logged in
    await verifyUser(req);

    const { name, surname, club, location, year } = req.body;

    const octokit = new ExtendedOctokit({
      auth: process.env.GITHUB_TOKEN,
    });

    const eventsData = {
      year: year,
      firstname: name,
      lastname: surname,
      club: club,
      location: location,
    };

    // Read existing data
    const { data: currentFile } = await octokit.repos.getContent({
      owner: "derberg",
      repo: "zatyrani.pl",
      path: "src/data/rajdnw-participants.json",
    });

    const content = currentFile.content;

    let events = [];
    if (currentFile) {
      const eventsFileContent = Buffer.from(content, "base64").toString();
      events = JSON.parse(eventsFileContent);
    }

    events.push(eventsData);

    await octokit.createOrUpdateTextFile({
      owner: "derberg",
      repo: "zatyrani.pl",
      path: "src/data/rajdnw-participants.json",
      content: JSON.stringify(events, null, 2),
      message: `chore(nwrajd-participants): added participant ${name} ${surname}`,
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to process request" });
  }
}
