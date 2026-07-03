import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { githubProfiles, recommendations } from "@/lib/db/schema";
import { anthropic, buildBatchRequest, parseScoreResult, type RankCandidate } from "@/lib/ai/rank";

const SHORTLIST_SIZE = Number(process.env.RANK_SHORTLIST_SIZE ?? 150);
const CHUNK_SIZE = 25;
const MIN_SCORE_TO_STORE = 30;
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_MS = 15 * 60 * 1000;

interface ShortlistRow extends Record<string, unknown> {
  id: string;
  title: string;
  section: string;
  description: string;
}

async function getShortlist(userId: string, embedding: number[]): Promise<ShortlistRow[]> {
  const rows = await db.execute<ShortlistRow>(sql`
    SELECT li.id, li.title, li.section, li.description
    FROM list_item li
    WHERE li.embedding IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM recommendation r WHERE r.item_id = li.id AND r.user_id = ${userId}
      )
    ORDER BY li.embedding <=> ${JSON.stringify(embedding)}::vector
    LIMIT ${SHORTLIST_SIZE}
  `);
  return [...rows];
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  const profiles = await db.select().from(githubProfiles);
  console.log(`Ranking for ${profiles.length} user(s)...`);

  interface Job {
    userId: string;
    customId: string;
    candidates: RankCandidate[];
  }
  const jobs: Job[] = [];

  for (const profile of profiles) {
    if (!profile.profileEmbedding) continue;
    const shortlist = await getShortlist(profile.userId, profile.profileEmbedding);
    if (shortlist.length === 0) continue;

    chunk(shortlist, CHUNK_SIZE).forEach((batch, i) => {
      jobs.push({
        userId: profile.userId,
        customId: `${profile.userId}--${i}`,
        candidates: batch.map((item) => ({
          id: item.id,
          title: item.title,
          section: item.section,
          description: item.description,
        })),
      });
    });
  }

  if (jobs.length === 0) {
    console.log("Nothing to rank.");
    return;
  }

  console.log(`Submitting ${jobs.length} batch request(s)...`);
  const profileTextByUser = new Map(profiles.map((p) => [p.userId, p.profileText]));

  const batch = await anthropic.messages.batches.create({
    requests: jobs.map((job) =>
      buildBatchRequest(job.customId, profileTextByUser.get(job.userId) ?? "", job.candidates),
    ),
  });

  console.log(`Batch ${batch.id} submitted, polling...`);
  const start = Date.now();
  let status = batch;
  while (status.processing_status !== "ended") {
    if (Date.now() - start > MAX_POLL_MS) {
      throw new Error(`Batch ${batch.id} did not finish within ${MAX_POLL_MS}ms`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    status = await anthropic.messages.batches.retrieve(batch.id);
    console.log(`  ${status.processing_status}...`);
  }

  const candidateIdsByCustomId = new Map(jobs.map((job) => [job.customId, new Set(job.candidates.map((c) => c.id))]));
  const userIdByCustomId = new Map(jobs.map((job) => [job.customId, job.userId]));

  let stored = 0;
  for await (const entry of await anthropic.messages.batches.results(batch.id)) {
    if (entry.result.type !== "succeeded") {
      console.error(`  ${entry.custom_id}: ${entry.result.type}`);
      continue;
    }
    const userId = userIdByCustomId.get(entry.custom_id);
    const validIds = candidateIdsByCustomId.get(entry.custom_id);
    if (!userId || !validIds) continue;

    const scores = parseScoreResult(entry.result.message);
    for (const result of scores) {
      if (!validIds.has(result.id)) continue;
      if (result.score < MIN_SCORE_TO_STORE) continue;

      await db
        .insert(recommendations)
        .values({
          userId,
          itemId: result.id,
          score: result.score,
          category: result.category ?? "",
          rationale: result.rationale,
          generatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [recommendations.userId, recommendations.itemId],
          set: {
            score: result.score,
            category: result.category ?? "",
            rationale: result.rationale,
            generatedAt: new Date(),
          },
        });
      stored++;
    }
  }

  console.log(`Ranking complete: ${stored} recommendations stored.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
