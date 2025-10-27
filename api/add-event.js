import { Octokit } from "@octokit/rest";
import { createOrUpdateTextFile } from "@octokit/plugin-create-or-update-text-file";

const ExtendedOctokit = Octokit.plugin(createOrUpdateTextFile);

export default async function handler(req, res) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	try {
		const { name, date, website, registration, description, location } =
			req.body;

		const octokit = new ExtendedOctokit({
			auth: process.env.GITHUB_TOKEN,
		});
		const eventsData = {
			date: formatDate(date),
			title: name,
			mainLink: website,
			registrationLink: registration,
			description: description,
			image: "",
			location: location,
			uid: generateUID(name, date)
		};

		// Read existing data
		const { data: currentFile } = await octokit.repos.getContent({
			owner: "derberg",
			repo: "zatyrani.pl",
			path: "src/data/events.json",
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
			path: "src/data/events.json",
			content: JSON.stringify(events, null, 2),
			message: `chore(events): added event ${name}`,
		});

		res.status(200).json({ success: true });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "Failed to process request" });
	}
}

//needed as for returns 2025-01-09 and I need 09/01/2025
export function formatDate(dateString) {
  if (typeof dateString !== 'string') {
    throw new TypeError(`formatDate expected a string but got ${typeof dateString}`);
  }

  const datePart = dateString.split("T")[0];
  const [year, month, day] = datePart.split("-");

  const dayPadded = day.padStart(2, "0");
  const monthPadded = month.padStart(2, "0");

  return `${dayPadded}/${monthPadded}/${year}`;
}


export function generateUID(title, date) {
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