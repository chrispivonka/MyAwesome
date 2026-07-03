import {
  pgTable,
  text,
  timestamp,
  integer,
  primaryKey,
  vector,
  real,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// Embedding dimension for Xenova/all-MiniLM-L6-v2 (local, via @huggingface/transformers)
export const EMBEDDING_DIMENSIONS = 384;

// --- Auth.js required tables (Drizzle adapter schema for Postgres) ---

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  ],
);

// --- App tables ---

export const githubProfiles = pgTable("github_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  starredLangs: text("starred_langs").array().notNull().default([]),
  starredTopics: text("starred_topics").array().notNull().default([]),
  profileText: text("profile_text").notNull().default(""),
  profileEmbedding: vector("profile_embedding", {
    dimensions: EMBEDDING_DIMENSIONS,
  }),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow(),
});

export const awesomeLists = pgTable("awesome_list", {
  id: uuid("id").primaryKey().defaultRandom(),
  repoFullName: text("repo_full_name").notNull().unique(),
  description: text("description"),
  stars: integer("stars").notNull().default(0),
  discoveredAt: timestamp("discovered_at", { mode: "date" })
    .notNull()
    .defaultNow(),
  lastIngestedAt: timestamp("last_ingested_at", { mode: "date" }),
});

export const listItems = pgTable(
  "list_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id")
      .notNull()
      .references(() => awesomeLists.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url").notNull(),
    description: text("description").notNull().default(""),
    section: text("section").notNull().default(""),
    contentHash: text("content_hash").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    firstSeenAt: timestamp("first_seen_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("list_item_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    index("list_item_list_id_idx").on(table.listId),
    uniqueIndex("list_item_list_id_url_idx").on(table.listId, table.url),
  ],
);

export const recommendations = pgTable(
  "recommendation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => listItems.id, { onDelete: "cascade" }),
    score: real("score").notNull(),
    category: text("category").notNull().default(""),
    rationale: text("rationale").notNull(),
    generatedAt: timestamp("generated_at", { mode: "date" })
      .notNull()
      .defaultNow(),
    feedback: text("feedback", { enum: ["up", "down"] }),
  },
  (table) => [
    index("recommendation_user_id_idx").on(table.userId),
    uniqueIndex("recommendation_user_id_item_id_idx").on(
      table.userId,
      table.itemId,
    ),
  ],
);
