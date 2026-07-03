import { Octokit } from "octokit";

// Unauthenticated GitHub API calls are capped at 60/hr; GITHUB_TOKEN (a
// personal access token with no scopes needed — just raises the rate limit)
// bumps that to 5000/hr, which matters for the discovery/ingestion scripts.
export const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN || undefined,
});
