import { Octokit } from "@octokit/rest";
import { createOrUpdateTextFile } from "@octokit/plugin-create-or-update-text-file";
import fetch from "node-fetch";
import https from "https";

const ExtendedOctokit = Octokit.plugin(createOrUpdateTextFile);

export default async function handler(req, res) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	try {
		const octokit = new ExtendedOctokit({
			auth: process.env.GITHUB_TOKEN,
		});

		const eventsData = buildEventData(req.body);

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
			message: `chore(events): added event ${eventsData.title}`,
		});

		res.status(200).json({ success: true });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "Failed to process request" });
	}
}

//needed as for returns 2025-01-09 and I need 09/01/2025
function formatDate(dateString) {
	const date = new Date(dateString);

	const day = String(date.getDate()).padStart(2, "0"); // Ensures two digits
	const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
	const year = date.getFullYear();

	return `${day}/${month}/${year}`;
}

async function buildEventData(formData) {
	
  const {
		name,
		date,
		website,
		registration,
		description,
		location,
		facebook_event,
		facebook_event_url,
	} = formData;

	if (!facebook_event) {
		return {
			date: formatDate(date),
			title: name,
			mainLink: website,
			registrationLink: registration,
			description: description,
			image: "",
			location: location,
		};
	}

	const eventId = extractEventId(facebook_event_url);
	const eventData = await getEventDetails(eventId);

  return {
    date: formatDate(eventData.start_time),
    title: eventData.name,
    mainLink: facebook_event_url,
    registrationLink: registration,
    description: eventData.description,
    image: eventData.image,
    location: eventData.place.location.city,
  };
}

/*
  Explanation of the regex pattern:
  - https:\/\/www\.facebook\.com\/events\/ matches the start of the URL (https://www.facebook.com/events/).
  - (?:s\/[\w-]+\/)? optionally matches the /s/ part that might appear in some URLs, followed by a string of word characters or hyphens. This part is non-capturing, meaning it doesn't return anything from this section but ensures the URL format is correct.
  -(\d+) captures the event ID (a sequence of digits) in a capturing group.
*/
function extractEventId(url) {
	const regex = /https:\/\/www\.facebook\.com\/events\/(?:s\/[\w-]+\/)?(\d+)/;
	const match = url.match(regex);

	if (match) {
		return match[1]; // Return the event ID
	} else {
		return null; // Return null if the URL doesn't match
	}
}

// Function to fetch event details and download the cover image
async function getEventDetails(eventId) {
	const accessToken = process.env.FB_APP_TOKEN;

	try {
		// Fetch the event details from the Facebook Graph API
		const url = `https://graph.facebook.com/${eventId}?fields=name,start_time,description,place,cover&access_token=${accessToken}`;
		const response = await fetch(url);
		const eventData = await response.json();

		if (eventData.error) {
			throw new Error(`Error fetching event: ${eventData.error.message}`);
		}

		// Log the event details
		console.log("Event Details:", eventData);

		// Get the cover image URL
		const coverImageUrl = eventData.cover ? eventData.cover.source : null;
		const localImagePath = `public/events/${eventId}_cover.jpg`;
		// If there's a cover image, download it
		if (coverImageUrl) {
			await downloadImage(coverImageUrl, localImagePath);
		}

    eventData.image = localImagePath;

		return eventData;
	} catch (error) {
		console.error("Error:", error);
	}
}

// Function to download an image
function downloadImage(url, filename) {
	return new Promise((resolve, reject) => {
		const file = fs.createWriteStream(filename);
		https
			.get(url, (response) => {
				response.pipe(file);
				file.on("finish", () => {
					file.close();
					resolve();
				});
			})
			.on("error", (err) => {
				fs.unlink(filename, () => {}); // Delete the file if there's an error
				reject(err);
			});
	});
}

/**
 * Fetch the long-lived access token from Facebook's Graph API.
 */
async function getAccessToken() {
	const url = "https://graph.facebook.com/oauth/access_token";
	const params = new URLSearchParams({
		grant_type: "fb_exchange_token",
		client_id: process.env.FB_CLIENT_ID,
		client_secret: process.env.FB_CLIENT_SECRET,
		fb_exchange_token: process.env.FB_EXCHANGE_TOKEN,
	});

	if (
		!process.env.FB_CLIENT_ID ||
		!process.env.FB_CLIENT_SECRET ||
		!process.env.FB_EXCHANGE_TOKEN
	) {
		throw new Error(
			"Required environment variables are missing. Please set FB_CLIENT_ID, FB_CLIENT_SECRET, and FB_EXCHANGE_TOKEN."
		);
	}

	try {
		const response = await fetch(`${url}?${params.toString()}`, {
			method: "GET",
		});

		if (!response.ok) {
			throw new Error(`HTTP error! Status: ${response.status}`);
		}

		const data = await response.json();
		return data.access_token;
	} catch (error) {
		console.error("Error fetching the access token:", error);
		throw error;
	}
}
