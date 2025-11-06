import { Octokit } from "@octokit/rest";
import { createOrUpdateTextFile } from "@octokit/plugin-create-or-update-text-file";

const ExtendedOctokit = Octokit.plugin(createOrUpdateTextFile);

export async function updateGithubFile(owner, repo, path, message, content, sha) {
  const octokit = new ExtendedOctokit({
    auth: process.env.GITHUB_TOKEN,
  });

  await octokit.createOrUpdateTextFile({
    owner,
    repo,
    path,
    message,
    content,
    sha,
  });
}
