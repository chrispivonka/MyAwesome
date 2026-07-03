import { eq, isNull, lt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { awesomeLists, listItems } from "@/lib/db/schema";
import { octokit } from "@/lib/github/client";
import { contentHash } from "@/lib/hash";
import { parseAwesomeMarkdown } from "@/lib/parsing/awesome-list";

const STALE_AFTER_HOURS = Number(process.env.INGEST_STALE_AFTER_HOURS ?? 24);
const CONCURRENCY = 5;
const forceAll = process.argv.includes("--all");

async function fetchReadme(owner: string, repo: string): Promise<string> {
  const { data } = await octokit.rest.repos.getReadme({ owner, repo });
  return Buffer.from(data.content, "base64").toString("utf-8");
}

async function ingestList(list: typeof awesomeLists.$inferSelect) {
  const [owner, repo] = list.repoFullName.split("/");
  let readme: string;
  try {
    readme = await fetchReadme(owner, repo);
  } catch (err) {
    console.error(`  ${list.repoFullName}: failed to fetch README (${(err as Error).message})`);
    return;
  }

  const parsed = parseAwesomeMarkdown(readme);

  for (const item of parsed) {
    const hash = contentHash([item.title, item.url, item.description]);
    await db
      .insert(listItems)
      .values({
        listId: list.id,
        title: item.title,
        url: item.url,
        description: item.description,
        section: item.section,
        contentHash: hash,
      })
      .onConflictDoUpdate({
        target: [listItems.listId, listItems.url],
        // first_seen_at is deliberately excluded from `set` — it marks when
        // we first saw this item, which powers "what's new" surfacing.
        set: {
          title: item.title,
          description: item.description,
          section: item.section,
          contentHash: hash,
        },
      });
  }

  await db
    .update(awesomeLists)
    .set({ lastIngestedAt: new Date() })
    .where(eq(awesomeLists.id, list.id));

  console.log(`  ${list.repoFullName}: parsed ${parsed.length} items`);
}

async function main() {
  const staleCutoff = new Date(Date.now() - STALE_AFTER_HOURS * 60 * 60 * 1000);

  const lists = forceAll
    ? await db.select().from(awesomeLists)
    : await db
        .select()
        .from(awesomeLists)
        .where(
          or(
            isNull(awesomeLists.lastIngestedAt),
            lt(awesomeLists.lastIngestedAt, staleCutoff),
          ),
        );

  console.log(`Ingesting ${lists.length} awesome-lists...`);

  let cursor = 0;
  async function worker() {
    while (cursor < lists.length) {
      const list = lists[cursor++];
      await ingestList(list);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  console.log("Ingestion complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
