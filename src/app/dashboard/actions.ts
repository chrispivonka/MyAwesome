"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { recommendations } from "@/lib/db/schema";

export async function submitFeedback(recommendationId: string, feedback: "up" | "down") {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");

  await db
    .update(recommendations)
    .set({ feedback })
    .where(
      and(
        eq(recommendations.id, recommendationId),
        eq(recommendations.userId, session.user.id),
      ),
    );

  revalidatePath("/dashboard");
}
