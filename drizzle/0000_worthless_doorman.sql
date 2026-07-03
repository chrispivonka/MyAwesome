CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "awesome_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_full_name" text NOT NULL,
	"description" text,
	"stars" integer DEFAULT 0 NOT NULL,
	"discovered_at" timestamp DEFAULT now() NOT NULL,
	"last_ingested_at" timestamp,
	CONSTRAINT "awesome_list_repo_full_name_unique" UNIQUE("repo_full_name")
);
--> statement-breakpoint
CREATE TABLE "github_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"starred_langs" text[] DEFAULT '{}' NOT NULL,
	"starred_topics" text[] DEFAULT '{}' NOT NULL,
	"profile_text" text DEFAULT '' NOT NULL,
	"profile_embedding" vector(384),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "list_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"section" text DEFAULT '' NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" vector(384),
	"first_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"item_id" uuid NOT NULL,
	"score" real NOT NULL,
	"rationale" text NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"feedback" text
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_profile" ADD CONSTRAINT "github_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_item" ADD CONSTRAINT "list_item_list_id_awesome_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."awesome_list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_item_id_list_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."list_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "list_item_embedding_idx" ON "list_item" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "list_item_list_id_idx" ON "list_item" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "recommendation_user_id_idx" ON "recommendation" USING btree ("user_id");