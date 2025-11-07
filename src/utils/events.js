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

export async function updateEventsFile(octokit, message, content) {
    await octokit.createOrUpdateTextFile({
        owner: "derberg",
        repo: "zatyrani.pl",
        path: "src/data/events.json",
        message,
        content: JSON.stringify(content, null, 2),
    });
}

export function formatDate(dateString) {
  const date = new Date(dateString);

  const day = String(date.getDate()).padStart(2, "0"); // Ensures two digits
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}




