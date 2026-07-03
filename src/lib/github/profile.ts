import { Octokit } from "octokit";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, githubProfiles } from "@/lib/db/schema";
import { embed } from "@/lib/ai/embed";

const STAR_PAGES = 3; // 3 * 100 = up to 300 most-recent stars
const TOP_LANGUAGES = 8;
const TOP_TOPICS = 12;

interface StarredRepo {
  language: string | null;
  topics?: string[];
}

function topEntries(counts: Map<string, number>, n: number): string[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key]) => key);
}

async function fetchStarredRepos(accessToken: string): Promise<StarredRepo[]> {
  const octokit = new Octokit({ auth: accessToken });
  const repos: StarredRepo[] = [];

  for (let page = 1; page <= STAR_PAGES; page++) {
    const { data } = await octokit.rest.activity.listReposStarredByAuthenticatedUser({
      per_page: 100,
      page,
      sort: "created",
    });
    if (data.length === 0) break;
    for (const repo of data) {
      repos.push({ language: repo.language ?? null, topics: repo.topics ?? [] });
    }
    if (data.length < 100) break;
  }

  return repos;
}

export async function buildProfileForUser(userId: string): Promise<void> {
  const [account] = await db
    .select({ accessToken: accounts.access_token })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "github")))
    .limit(1);

  if (!account?.accessToken) return;

  const starred = await fetchStarredRepos(account.accessToken);

  const langCounts = new Map<string, number>();
  const topicCounts = new Map<string, number>();
  for (const repo of starred) {
    if (repo.language) {
      langCounts.set(repo.language, (langCounts.get(repo.language) ?? 0) + 1);
    }
    for (const topic of repo.topics ?? []) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }
  }

  const starredLangs = topEntries(langCounts, TOP_LANGUAGES);
  const starredTopics = topEntries(topicCounts, TOP_TOPICS);

  const profileText = [
    starredLangs.length
      ? `Frequently starred languages: ${starredLangs.join(", ")}.`
      : "",
    starredTopics.length
      ? `Frequently starred topics: ${starredTopics.join(", ")}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const profileEmbedding = profileText ? await embed(profileText) : null;

  await db
    .insert(githubProfiles)
    .values({
      userId,
      starredLangs,
      starredTopics,
      profileText,
      profileEmbedding,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: githubProfiles.userId,
      set: { starredLangs, starredTopics, profileText, profileEmbedding, updatedAt: new Date() },
    });
}
