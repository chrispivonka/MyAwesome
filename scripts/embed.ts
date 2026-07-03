import { eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { listItems } from "@/lib/db/schema";
import { embedBatch } from "@/lib/ai/embed";

const BATCH_SIZE = 32;
const LIMIT = process.env.EMBED_LIMIT ? Number(process.env.EMBED_LIMIT) : undefined;

function itemText(item: { title: string; description: string; section: string }) {
  return [item.section, item.title, item.description].filter(Boolean).join(". ");
}

async function main() {
  const query = db
    .select({
      id: listItems.id,
      title: listItems.title,
      description: listItems.description,
      section: listItems.section,
    })
    .from(listItems)
    .where(isNull(listItems.embedding));

  const pending = LIMIT ? await query.limit(LIMIT) : await query;

  console.log(`Embedding ${pending.length} list items...`);

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const vectors = await embedBatch(batch.map(itemText));

    await Promise.all(
      batch.map((item, idx) =>
        db
          .update(listItems)
          .set({ embedding: vectors[idx] })
          .where(eq(listItems.id, item.id)),
      ),
    );

    console.log(`  ${Math.min(i + BATCH_SIZE, pending.length)}/${pending.length}`);
  }

  console.log("Embedding complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
