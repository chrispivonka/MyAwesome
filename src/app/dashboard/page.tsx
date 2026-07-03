import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, gte } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { RecommendationCard } from "@/components/recommendation-card";
import { db } from "@/lib/db";
import { awesomeLists, listItems, recommendations } from "@/lib/db/schema";
import { FEED_WINDOWS, cutoffDate, resolveFeedWindow } from "@/lib/feed-window";
import { cn } from "@/lib/utils";

const NEW_WITHIN_DAYS = 1;
const FEED_LIMIT = 50;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  const { window: windowParam } = await searchParams;
  const activeWindow = resolveFeedWindow(windowParam);

  const conditions = [eq(recommendations.userId, session.user.id)];
  if (activeWindow.days !== null) {
    conditions.push(gte(listItems.firstSeenAt, cutoffDate(activeWindow.days)));
  }

  const rows = await db
    .select({
      id: recommendations.id,
      score: recommendations.score,
      category: recommendations.category,
      rationale: recommendations.rationale,
      feedback: recommendations.feedback,
      title: listItems.title,
      url: listItems.url,
      firstSeenAt: listItems.firstSeenAt,
      repoFullName: awesomeLists.repoFullName,
    })
    .from(recommendations)
    .innerJoin(listItems, eq(recommendations.itemId, listItems.id))
    .innerJoin(awesomeLists, eq(listItems.listId, awesomeLists.id))
    .where(and(...conditions))
    .orderBy(desc(recommendations.score))
    .limit(FEED_LIMIT);

  const newCutoff = cutoffDate(NEW_WITHIN_DAYS).getTime();

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-12">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your feed
          </h1>
          <p className="text-muted-foreground">
            Signed in as {session.user.name ?? session.user.email}
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>

      <nav className="mx-auto flex w-full max-w-2xl flex-wrap gap-1">
        {FEED_WINDOWS.map((w) => (
          <Link
            key={w.value}
            href={`/dashboard?window=${w.value}`}
            className={cn(
              "rounded-full px-3 py-1 text-sm transition-colors",
              w.value === activeWindow.value
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {w.label}
          </Link>
        ))}
      </nav>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        {rows.length === 0 ? (
          <p className="text-muted-foreground">
            {activeWindow.value === "all"
              ? "No recommendations yet — the discovery and ranking pipelines haven't run for your account."
              : `Nothing new in "${activeWindow.label}" — try a wider time range, or check back after the next discovery run.`}
          </p>
        ) : (
          rows.map((row) => (
            <RecommendationCard
              key={row.id}
              id={row.id}
              title={row.title}
              url={row.url}
              rationale={row.rationale}
              category={row.category}
              repoFullName={row.repoFullName}
              isNew={row.firstSeenAt.getTime() > newCutoff}
              feedback={row.feedback}
            />
          ))
        )}
      </div>
    </div>
  );
}
