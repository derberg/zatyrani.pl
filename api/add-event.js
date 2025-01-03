import { Octokit } from '@octokit/rest';
import { createOrUpdateTextFile } from '@octokit/plugin-create-or-update-text-file';

const ExtendedOctokit = Octokit.plugin(createOrUpdateTextFile);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, date, website, registration, description, location } = req.body;
    
    const octokit = new ExtendedOctokit({
      auth: process.env.GITHUB_TOKEN
    });

    const eventsData = {
      date: formatDate(date),
      title: name,
      mainLink: website,
      registrationLink: registration,
      description: description,
      image: '',
      location: location,
    };

    // Read existing data
    const { data: currentFile } = await octokit.repos.getContent({
      owner: 'derberg',
      repo: 'zatyrani.pl',
      path: 'src/data/events.json'
    });

    const content = currentFile.content;

    let events = [];
    if (currentFile) {
      const eventsFileContent = Buffer.from(content, 'base64').toString();
      events = JSON.parse(eventsFileContent);
    }

    events.push(eventsData);

    await octokit.createOrUpdateTextFile({
      owner: 'derberg',
      repo: 'zatyrani.pl',
      path: 'src/data/events.json',
      content: JSON.stringify(events, null, 2),
      message: `chore(events): added event ${name}`
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process request' });
  }
};

//needed as for returns 2025-01-09 and I need 09/01/2025 
function formatDate(dateString) {
  const date = new Date(dateString);
  
  const day = String(date.getDate()).padStart(2, '0'); // Ensures two digits
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
}