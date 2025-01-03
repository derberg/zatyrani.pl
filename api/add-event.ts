import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Octokit } from '@octokit/rest';
import { createOrUpdateTextFile } from '@octokit/plugin-create-or-update-text-file';

const ExtendedOctokit = Octokit.plugin(createOrUpdateTextFile);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, date, website, registration } = req.body;
    
    const octokit = new ExtendedOctokit({
      auth: process.env.GITHUB_TOKEN
    });

    const eventsData = {
      name,
      date,
      website,
      registration,
      addedAt: new Date().toISOString()
    };

    // Read existing data
    const { data: currentFile } = await octokit.repos.getContent({
      owner: 'derberg',
      repo: 'zatyrani.pl',
      path: 'src/data/events.json'
    });

    let events = [];
    if (currentFile) {
      const content = Buffer.from(currentFile.content, 'base64').toString();
      events = JSON.parse(content);
    }

    events.push(eventsData);

    // Sort by date
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    await octokit.createOrUpdateTextFile({
      owner: 'derberg',
      repo: 'zatyrani.pl',
      path: 'src/data/events.json',
      content: JSON.stringify(events, null, 2),
      message: `Added new event: ${name}`
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process request' });
  }
}