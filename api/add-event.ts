import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Octokit } from '@octokit/rest';
import { createOrUpdateTextFile } from '@octokit/plugin-create-or-update-text-file';
import type { Events } from '../src/data/events';

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

    const eventsData: Events = {
      date: date,
      title: name,
      mainLink: website,
      registrationLink: registration,
      description: '',
      image: '',
      location: '',
    };

    // Read existing data
    const { data: currentFile } = await octokit.repos.getContent({
      owner: 'derberg',
      repo: 'zatyrani.pl',
      path: 'src/data/events.json'
    });

    const content = (currentFile as { content: string }).content;

    let events: Events[] = [];
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
      message: `Added new event: ${name}`
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process request' });
  }
}