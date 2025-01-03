import fetch from "node-fetch";
import { promises as fsPromises } from "fs";
import * as path from "path";

/**
 * Get the current directory of the module (replaces __dirname in ES modules).
 */
const __dirname = process.cwd();

interface Post {
	full_picture?: string;
	message?: string;
	created_time?: string;
	id?: string;
}

interface NewsItem {
	date: string;
	message?: string;
	id?: string;
	image?: string;
	postUrl?: string;
	oryginalDate?: string;
}

interface FacebookResponse {
	data: Post[];
}

interface AccessTokenResponse {
	access_token: string;
}

interface PageDetailsResponse {
	access_token: string;
}

/**
 * Fetch the long-lived access token from Facebook's Graph API.
 */
async function getAccessToken(): Promise<string> {
	const url = "https://graph.facebook.com/oauth/access_token";
	const params = new URLSearchParams({
		grant_type: "fb_exchange_token",
		client_id: process.env.FB_CLIENT_ID!,
		client_secret: process.env.FB_CLIENT_SECRET!,
		fb_exchange_token: process.env.FB_EXCHANGE_TOKEN!,
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

		const data: AccessTokenResponse =
			(await response.json()) as AccessTokenResponse;
		return data.access_token;
	} catch (error) {
		console.error("Error fetching the access token:", error);
		throw error;
	}
}

/**
 * Fetch details about a Facebook page using the access token.
 * @param {string} token - The access token to use for authentication.
 */
async function getPageDetails(token: string): Promise<string> {
	const url = "https://graph.facebook.com/v19.0/107588201276090";
	const params = new URLSearchParams({
		fields: "name,access_token",
		access_token: token,
	});

	try {
		const response = await fetch(`${url}?${params.toString()}`, {
			method: "GET",
		});

		if (!response.ok) {
			throw new Error(`HTTP error! Status: ${response.status}`);
		}

		const data: PageDetailsResponse =
			(await response.json()) as PageDetailsResponse;
		return data.access_token; // Return the page's access token
	} catch (error) {
		console.error("Error fetching the page details:", error);
		throw error;
	}
}

/**
 * Fetch the latest post from a Facebook page's feed using the page's access token.
 * @param {string} pageToken - The page access token.
 * @returns {Array} Array of new posts (if any).
 */
async function getPagePosts(pageToken: string): Promise<NewsItem[]> {
	const url = "https://graph.facebook.com/v19.0/107588201276090/feed";
	const params = new URLSearchParams({
		fields: "id,full_picture,message,created_time",
		limit: "5",
		access_token: pageToken,
	});

	try {
		const response = await fetch(`${url}?${params.toString()}`, {
			method: "GET",
		});

		if (!response.ok) {
			throw new Error(`HTTP error! Status: ${response.status}`);
		}

		const data: FacebookResponse = (await response.json()) as FacebookResponse;
		const posts: Post[] = data.data;
		const newPosts: NewsItem[] = [];

		for (const post of posts) {
			if (post.full_picture && post.created_time) {
				const folderName = new Date(post.created_time)
					.toISOString()
					.replace(/[^a-zA-Z0-9\-]/g, "");
				const dirPath = path.join(__dirname, "public", "facebook", folderName);

				await fsPromises.mkdir(dirPath, { recursive: true });

				// Download the image and save it to the directory
				const imageFullPath = await downloadImage(
					post.full_picture,
					path.join(dirPath)
				);

				// Add the new post to the array
				newPosts.push({
					date: new Date(post.created_time).toLocaleDateString("pl-PL", {
						year: "numeric",
						month: "long",
						day: "numeric",
					}),
					message: post.message!,
					id: post.id,
					image: `facebook/${folderName}/${path.basename(imageFullPath)}`,
					postUrl: getPostURL(post.id!),
					oryginalDate: post.created_time,
				});
			}
		}

		return newPosts; // Return the collected posts
	} catch (error) {
		console.error("Error fetching the page posts:", error);
		throw error;
	}
}

function getPostURL(post: string): string {
	const postId = post.split("_")[1];
	const pageId = post.split("_")[0];
	const postUrl = `https://www.facebook.com/${pageId}/posts/${postId}`;

	return postUrl;
}

/**
 * Downloads an image from a URL and saves it to the specified path.
 * @param {string} url - The URL of the image.
 * @param {string} dest - The destination path where the image will be saved.
 */
async function downloadImage(url: string, dest: string): Promise<string> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch image: ${response.statusText}`);
	}

	// Extract file extension from the image URL
	const lastPathElement = url.split("/").pop()!.split("?")[0];
	const extname = path.extname(lastPathElement).toLowerCase() || ".jpg";

	if (!extname) {
		throw new Error("Could not determine file extension from URL" + url);
	}

	// Set the filename to "image" with the correct extension
	const filename = path.join(dest, `image${extname}`);

	// Get the image data as an ArrayBuffer
	const arrayBuffer = await response.arrayBuffer();

	// Convert ArrayBuffer to Buffer
	const imageBuffer = Buffer.from(arrayBuffer);

	// Write the Buffer to the file
	await fsPromises.writeFile(filename, imageBuffer);

	return filename;
}

/**
 * Updates the `news.ts` file with the new posts.
 * @param {Array} newPosts - Array of new posts to add to the news.ts file.
 */
async function updateNews(newPosts: NewsItem[]): Promise<void> {
	const newsFilePath = path.join(__dirname, "src", "data", "news.json");

	const newsData = JSON.parse(await fsPromises.readFile(newsFilePath, "utf-8"));

	// Filter out new posts that already exist in the newsData based on the 'id' field
	const uniqueNewPosts = newPosts.filter(
		(newPost) =>
			!newsData.some((existingPost: NewsItem) => existingPost.id === newPost.id)
	);
	// Add the new posts to the existing news
	newsData.push(...uniqueNewPosts);

	// Sort the combined news data by 'oryginalDate', newest first
	newsData.sort((a: NewsItem, b: NewsItem) => {
		const dateA = new Date(a.oryginalDate || 0).getTime();
		const dateB = new Date(b.oryginalDate || 0).getTime();
		return dateB - dateA;
	});

	await fsPromises.writeFile(
		newsFilePath,
		JSON.stringify(newsData, null, 2),
		"utf-8"
	);
}

// Main execution flow
(async () => {
	try {
		const accessToken = await getAccessToken(); // Fetch the user access token
		const pageToken = await getPageDetails(accessToken); // Fetch the page access token
		const newPosts = await getPagePosts(pageToken); // Fetch the latest posts and download images
		if (newPosts.length > 0) {
			await updateNews(newPosts); // After processing, update the news.ts file with new posts
		}
	} catch (error) {
		console.error("Error in main flow:", error);
	}
})();
