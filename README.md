# MyAwesome

An AI-powered curator that transforms GitHub Awesome Lists and new tech
releases into your own personalized discovery feed.

[![CI](https://github.com/chrispivonka/MyAwesome/actions/workflows/ci.yml/badge.svg)](https://github.com/chrispivonka/MyAwesome/actions/workflows/ci.yml)
[![Discover](https://github.com/chrispivonka/MyAwesome/actions/workflows/discover.yml/badge.svg)](https://github.com/chrispivonka/MyAwesome/actions/workflows/discover.yml)
[![Daily Sync](https://github.com/chrispivonka/MyAwesome/actions/workflows/daily-sync.yml/badge.svg)](https://github.com/chrispivonka/MyAwesome/actions/workflows/daily-sync.yml)
[![License: MIT](https://img.shields.io/github/license/chrispivonka/MyAwesome)](LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/chrispivonka/MyAwesome)](https://github.com/chrispivonka/MyAwesome/commits/main)
[![Issues](https://img.shields.io/github/issues/chrispivonka/MyAwesome)](https://github.com/chrispivonka/MyAwesome/issues)
[![Stars](https://img.shields.io/github/stars/chrispivonka/MyAwesome?style=social)](https://github.com/chrispivonka/MyAwesome/stargazers)

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![Bun](https://img.shields.io/badge/Bun-1.3-000000?logo=bun)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?logo=postgresql&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F)
![Claude](https://img.shields.io/badge/Claude-Haiku_4.5-D97757?logo=anthropic&logoColor=white)

It discovers "awesome-\*" lists on GitHub, parses their contents, builds a
profile from your starred repos, and uses local embeddings + Claude Haiku to
rank items that are actually relevant to you — with a feed you can filter to
"what's new today / this week / this month / this year / all time" so it
stays worth checking back on instead of showing the same items forever.

Designed to run for ~$0/month — see [Cost](#cost) below.

## How it works

```
┌──────────────┐   weekly    ┌───────────┐   daily   ┌─────────┐   daily   ┌────────┐
│  Discover     │ ─────────▶ │  Ingest    │ ────────▶ │  Embed   │ ────────▶ │  Rank   │
│  awesome-*    │            │  READMEs   │           │ locally  │           │ (Haiku) │
│  repos        │            │ into items │           │ (free)   │           │         │
└──────────────┘            └───────────┘           └─────────┘           └───┬────┘
                                                                                │
                                                                                ▼
                                                                        Your personalized
                                                                          feed (/dashboard)
```

## Stack

Bun · Next.js 16 · Tailwind v4 + shadcn/ui · Postgres (pgvector) + Drizzle ·
Auth.js (GitHub OAuth) · Octokit · local embeddings via Transformers.js ·
Claude Haiku 4.5 via the Anthropic Batch API · GitHub Actions cron · AWS
(Lambda + CloudFront + S3) via SST v4

## Local setup

1. Install [Bun](https://bun.sh) and Docker.
2. Start local Postgres with pgvector:
   ```sh
   docker compose up -d
   ```
3. Copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL` — the docker-compose default works out of the box:
     `postgresql://myawesome:myawesome@localhost:5432/myawesome`
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — create an OAuth App at
     https://github.com/settings/developers with callback URL
     `http://localhost:3000/api/auth/callback/github`
   - `AUTH_SECRET` — any random string (`openssl rand -base64 33`)
   - `ANTHROPIC_API_KEY` — only needed to run the ranking script
4. Install deps and push the schema:
   ```sh
   bun install
   bun run db:push
   ```
5. Run the pipeline once to get data to look at:
   ```sh
   bun run discover   # find awesome-lists
   bun run ingest      # parse their READMEs into items
   bun run embed        # locally embed items (free, no API key)
   ```
6. Start the app:
   ```sh
   bun run dev
   ```
   Sign in with GitHub, then run `bun run rank` to generate your personalized
   recommendations (this one calls the Anthropic API).

## Scripts

| Command | What it does |
|---|---|
| `bun run discover` | Finds awesome-list repos (bootstraps from `sindresorhus/awesome` + a GitHub topic search) |
| `bun run ingest` | Parses each tracked list's README into items, diffing for new entries |
| `bun run embed` | Embeds any items missing a vector, fully local |
| `bun run rank` | Builds a personalized shortlist per user via pgvector, then scores it with Claude Haiku 4.5 over the Batch API |
| `bun run db:push` / `db:generate` / `db:migrate` / `db:studio` | Drizzle schema management |
| `bun run lint` | ESLint (includes React Compiler purity checks) |

## GitHub Actions

| Workflow | Trigger | What it does |
|---|---|---|
| [`ci.yml`](.github/workflows/ci.yml) | push to `main`, every PR | Lint, typecheck, and build — self-contained, no secrets required |
| [`discover.yml`](.github/workflows/discover.yml) | weekly (Mondays) | Runs `bun run discover` |
| [`daily-sync.yml`](.github/workflows/daily-sync.yml) | daily | Runs `bun run ingest` → `embed` → `rank` in sequence |

All three are also manually runnable from the **Actions** tab
(`workflow_dispatch`).

## Production deployment (AWS via SST v4)

The app deploys to AWS as a Lambda function behind CloudFront, with static
assets on S3 — all provisioned from [`sst.config.ts`](sst.config.ts).

1. Use [Neon](https://neon.tech) for Postgres (free tier, works from any
   host) — enable the `vector` extension and run `bun run db:migrate`
   against it once.
2. Authenticate the AWS CLI locally (however your account is set up —
   `aws sso login`, `aws configure`, etc.) so `aws sts get-caller-identity`
   succeeds.
3. Set secrets for the stage you're deploying (SST stores these encrypted
   in AWS SSM, not in the repo):
   ```sh
   bunx sst secret set DatabaseUrl "<neon-connection-string>" --stage production
   bunx sst secret set GithubClientId "<from the GitHub OAuth app>" --stage production
   bunx sst secret set GithubClientSecret "<from the GitHub OAuth app>" --stage production
   bunx sst secret set AuthSecret "$(openssl rand -base64 33)" --stage production
   bunx sst secret set AnthropicApiKey "<your key>" --stage production
   ```
4. Deploy:
   ```sh
   bunx sst deploy --stage production
   ```
   This prints the CloudFront URL for the app.
5. Create the GitHub OAuth App at
   [github.com/settings/developers](https://github.com/settings/developers)
   using that URL — homepage `https://<cloudfront-url>`, callback
   `https://<cloudfront-url>/api/auth/callback/github` — then re-run the
   `GithubClientId`/`GithubClientSecret` secret commands above with the
   real values and redeploy.
6. Set the same repo secrets as before for the `discover.yml` /
   `daily-sync.yml` GitHub Actions workflows (**Settings → Secrets and
   variables → Actions**): `DATABASE_URL`, `ANTHROPIC_API_KEY`.
   (`GITHUB_TOKEN` is provided automatically — no PAT needed.)

**Security notes**: enable MFA on the AWS account/IAM user doing the
deploy; SST's `sst.Secret` values are stored encrypted in AWS SSM Parameter
Store and never committed to the repo; `removal: "retain"` and
`protect: true` are set for the `production` stage in `sst.config.ts` so a
stray `sst remove` can't accidentally delete it.

## Cost

Neon free tier, GitHub Actions cron, and local embeddings are all $0.
AWS Lambda's free tier (1M requests + 400,000 GB-seconds/month) doesn't
expire, and CloudFront/S3 usage at this traffic level (one person
occasionally checking a feed) stays well under a dollar a month even after
their 12-month free tier lapses. The only real cost is the Haiku ranking
pass, which is deliberately kept tiny: pgvector pre-filters to ~150
candidates before any LLM call, it runs through the 50%-off Batch API, and
the shared instructions are prompt-cached. Expect low cents/month for
personal use — turn down `RANK_SHORTLIST_SIZE` or the ranking cadence if
you want it even lower.

## License

[MIT](LICENSE)
