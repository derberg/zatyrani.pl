import { Octokit } from "@octokit/rest";
import { createOrUpdateTextFile } from "@octokit/plugin-create-or-update-text-file";

import { readExistingData, updateFile, normalizeEventData, generateUID } from "../src/utils/events.js";
import { verifyUser } from "../src/utils/auth.js";

export { generateUID, normalizeEventData };

const ExtendedOctokit = Octokit.plugin(createOrUpdateTextFile);

export default async function handler(req, res) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	try {
		// Verify user is logged in
		await verifyUser(req);
		const eventsData = normalizeEventData(req.body);

		const octokit = new ExtendedOctokit({
			auth: process.env.GITHUB_TOKEN,
		});

		let events = await readExistingData(octokit);

		events.push(eventsData);

		await updateFile(
			octokit,
			`chore(events): added event ${eventsData.title}`,
			events
		);

		res.status(200).json({ success: true });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "Failed to process request" });
	}
}
