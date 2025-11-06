import { Octokit } from "@octokit/rest";
import { createOrUpdateTextFile } from "@octokit/plugin-create-or-update-text-file";

const ExtendedOctokit = Octokit.plugin(createOrUpdateTextFile);

export default async function handler(req, res) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	try {
		const eventsData = normalizeEventData(req.body);

		const octokit = new ExtendedOctokit({
			auth: process.env.GITHUB_TOKEN,
		});

		let events = await readExistingEventsData(octokit);

		events.push(eventsData);

		await updateEventsFile(
			octokit,
			`chore(events): added event ${eventsData.title}`,
			JSON.stringify(events, null, 2)
		);

		res.status(200).json({ success: true });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "Failed to process request" });
	}
}




import { normalizeEventData, readExistingEventsData, updateEventsFile } from "../src/utils/events.js";