import { db } from "@/lib/db";
import { awesomeLists } from "@/lib/db/schema";
import { octokit } from "@/lib/github/client";
import { parseAwesomeMarkdown } from "@/lib/parsing/awesome-list";

const BOOTSTRAP_LIMIT = Number(process.env.DISCOVER_BOOTSTRAP_LIMIT ?? 200);
const SEARCH_LIMIT = Number(process.env.DISCOVER_SEARCH_LIMIT ?? 50);
const ENRICH_CONCURRENCY = 10;

const REPO_URL_RE = /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+)\/?$/i;
const SKIP_OWNERS = new Set([
  "topics",
  "sponsors",
  "marketplace",
  "orgs",
  "sindresorhus",
]);

interface Candidate {
  owner: string;
  name: string;
  fullName: string;
  stars?: number;
  description?: string | null;
}

function parseRepoUrl(url: string): { owner: string; name: string } | null {
  const match = REPO_URL_RE.exec(url.trim());
  if (!match) return null;
  const owner = match[1];
  const name = match[2].replace(/\.git$/, "");
  if (SKIP_OWNERS.has(owner.toLowerCase())) return null;
  return { owner, name };
}

async function fetchReadme(owner: string, repo: string): Promise<string> {
  const { data } = await octokit.rest.repos.getReadme({ owner, repo });
  return Buffer.from(data.content, "base64").toString("utf-8");
}

/**
 * sindresorhus/awesome is itself a hand-curated meta-list of ~2000 awesome
 * lists — a much higher signal seed than a raw GitHub search.
 */
async function discoverFromBootstrap(): Promise<Candidate[]> {
  console.log("Fetching sindresorhus/awesome (bootstrap meta-list)...");
  const readme = await fetchReadme("sindresorhus", "awesome");
  const items = parseAwesomeMarkdown(readme);
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const item of items) {
    const repo = parseRepoUrl(item.url);
    if (!repo) continue;
    const fullName = `${repo.owner}/${repo.name}`.toLowerCase();
    if (seen.has(fullName)) continue;
    seen.add(fullName);
    candidates.push({ ...repo, fullName });
    if (candidates.length >= BOOTSTRAP_LIMIT) break;
  }
  console.log(`  found ${candidates.length} candidate repos`);
  return candidates;
}

/** Catches newer/independent awesome-lists not (yet) linked from the meta-list. */
async function discoverFromTopicSearch(): Promise<Candidate[]> {
  console.log("Searching GitHub for topic:awesome-list...");
  const { data } = await octokit.rest.search.repos({
    q: "topic:awesome-list",
    sort: "stars",
    order: "desc",
    per_page: Math.min(SEARCH_LIMIT, 100),
  });
  console.log(`  found ${data.items.length} candidate repos`);
  return data.items
    .filter((repo) => repo.owner)
    .map((repo) => ({
      owner: repo.owner!.login,
      name: repo.name,
      fullName: repo.full_name.toLowerCase(),
      stars: repo.stargazers_count,
      description: repo.description,
    }));
}

/** Bootstrap candidates only have a URL — backfill stars/description. */
async function enrichWithStars(candidates: Candidate[]): Promise<Candidate[]> {
  const needsEnrichment = candidates.filter((c) => c.stars === undefined);
  if (needsEnrichment.length === 0) return candidates;
  console.log(`Fetching star counts for ${needsEnrichment.length} repos...`);

  let cursor = 0;
  async function worker() {
    while (cursor < needsEnrichment.length) {
      const candidate = needsEnrichment[cursor++];
      try {
        const { data } = await octokit.rest.repos.get({
          owner: candidate.owner,
          repo: candidate.name,
        });
        candidate.stars = data.stargazers_count;
        candidate.description = data.description;
      } catch {
        candidate.stars = 0;
        candidate.description = null;
      }
    }
  }
  await Promise.all(
    Array.from({ length: ENRICH_CONCURRENCY }, () => worker()),
  );
  return candidates;
}

async function main() {
  const [bootstrap, search] = await Promise.all([
    discoverFromBootstrap(),
    discoverFromTopicSearch(),
  ]);

  const byFullName = new Map<string, Candidate>();
  for (const candidate of [...search, ...bootstrap]) {
    if (!byFullName.has(candidate.fullName)) {
      byFullName.set(candidate.fullName, candidate);
    }
  }

  const candidates = await enrichWithStars([...byFullName.values()]);

  for (const candidate of candidates) {
    await db
      .insert(awesomeLists)
      .values({
        repoFullName: candidate.fullName,
        description: candidate.description ?? null,
        stars: candidate.stars ?? 0,
      })
      .onConflictDoUpdate({
        target: awesomeLists.repoFullName,
        set: {
          stars: candidate.stars ?? 0,
          description: candidate.description ?? null,
        },
      });
  }

  console.log(`Discovery complete: ${candidates.length} awesome-lists tracked.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
