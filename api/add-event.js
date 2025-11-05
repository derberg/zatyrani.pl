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

		await octokit.createOrUpdateTextFile({
			owner: "derberg",
			repo: "zatyrani.pl",
			path: "src/data/events.json",
			content: JSON.stringify(events, null, 2),
			message: `chore(events): added event ${eventsData.title}`,
		});

		res.status(200).json({ success: true });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "Failed to process request" });
	}
}

//needed as for returns 2025-01-09 and I need 09/01/2025
export function formatDate(dateString) {
	const date = new Date(dateString);

	const day = String(date.getDate()).padStart(2, "0"); // Ensures two digits
	const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
	const year = date.getFullYear();

	return `${day}/${month}/${year}`;
}

export function generateEventUID(title, date) {
	// Limit title to 40 characters
	let croppedTitle = title.slice(0, 40);

	// Normalize Polish characters
	const polishMap = {
		'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ż': 'z', 'ź': 'z',
		'Ą': 'a', 'Ć': 'c', 'Ę': 'e', 'Ł': 'l', 'Ń': 'n', 'Ó': 'o', 'Ś': 's', 'Ż': 'z', 'Ź': 'z'
	};
	croppedTitle = croppedTitle.replace(/[ąćęłńóśżźĄĆĘŁŃÓŚŻŹ]/g, match => polishMap[match]);

	// Lowercase and replace spaces/special chars with "-"
	let slug = croppedTitle.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-') // any non-alphanumeric -> "-"
		.replace(/^-+|-+$/g, '');   // trim starting/ending "-"

	return `${slug}-${formatDate(date).replace(/\//g, '-')}`;
}

export function normalizeEventData(body) {
	const { name, date, website, registration, description, location } = body
	return {
		date: formatDate(date),
		title: name,
		mainLink: website,
		registrationLink: registration,
		description: description,
		image: "",
		location: location,
		uid: generateEventUID(name, date)
	};
}


export async function readExistingEventsData(octokit) {

    const { data: currentFile } = await octokit.repos.getContent({
        owner: "derberg",
        repo: "zatyrani.pl",
        path: "src/data/events.json",
    });

    let events = [];
    if (currentFile && currentFile.content) {
        const decoded = Buffer.from(currentFile.content, "base64").toString();
        events = JSON.parse(decoded);
    }

    return events;
}