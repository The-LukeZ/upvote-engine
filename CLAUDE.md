# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

UpvoteEngine — Discord vote-role bot on Cloudflare Workers. Users vote for a Discord bot on Top.gg/Discord Bot List (DBL); this worker receives the webhook, assigns a Discord role, and removes it after the configured duration expires. Slash-command interface (`/app create|list|edit|remove`, `/app forwarding ...`, `/verify-app-ownership`) lets bot owners self-configure webhooks per guild.

## Commands

- `pnpm dev` / `pnpm start` — `wrangler dev` local dev server
- `pnpm deploy` — deploy to Cloudflare
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm test` — run vitest (single file: `pnpm test src/test/webhook.test.ts`)
- `pnpm gen` — regenerate `worker-configuration.d.ts` from `wrangler.jsonc` bindings and `secrets.required` (previously referred to as `cf-typegen` — that script name doesn't exist, use `gen`)
- `pnpm register` — register Discord slash commands (`tsx --env-file=.env src/registerCommands.ts`)
- `pnpm migrate` — apply D1 migrations remotely (`wrangler d1 migrations apply vote_handler --remote`)
- `pnpm drizzle:generate` — generate a new migration from `src/db/schema.ts` changes
- `pnpm bulk-secrets` — push `.env` contents as Worker secrets (`wrangler secret bulk .env`)

There is no lint script; formatting is via Prettier (`.prettierrc`).

## Architecture

**Entry point** `src/index.ts` wires a Hono app plus three other Cloudflare Worker export surfaces on the same file:

- `fetch` — the Hono app (`app.fetch`)
- `scheduled` — cron handler, dispatched by matching `controller.cron` against the two schedules in `wrangler.jsonc` (`*/5 * * * *` expires votes + purges votes >90 days old; `0 3 * * 1` cleans up guilds the bot is no longer in and reports guild count to Top.gg)
- `queue` — dispatched by `batch.queue` name (`voteapply`, `voteremove`, `forwardwebhook`) to handlers in `src/queueHandlers.ts`
- Two Durable Object classes: `BlacklistCacheDO` (in-memory guild/user/bot blacklist, hydrated from D1 on construction) and `HonocordCacheDO` (from the `@honocord/cache-do` package, used by the Discord interaction framework)

**Routing** (`src/routes/`):

- `webhooks/` — public webhook endpoints. `webhooks/topgg/` has three routes for the same event: `/v1/:applicationId` (current), `/v0/:applicationId` (deprecated but supported), and a legacy unversioned `/:applicationId` alias to v0. Don't collapse these — the README states legacy configs are supported through end of 2026. `webhooks/dbl/` is the DBL equivalent, single version.
- `discord/` — slash commands and message components, built on `honocord` (a Hono-based Discord interaction framework) rather than raw discord-interactions routing. Commands live in `discord/commands/*.ts`, components (buttons/selects/modals) in `discord/components/*.ts`, both exported as named exports collected via `Object.values()` in `discord/index.ts` and registered with `bot.loadHandlers(handlers)`.
- `discord/ownershipVerifyCallback.ts` — OAuth callback for the bot-ownership verification flow (ties a Discord user to an application via `owners`/`verifications` tables).

**Data layer** (`src/db/`):

- `schema.ts` — Drizzle ORM schema for D1 (SQLite). Key tables: `applications` (per-guild webhook config, PK is `(applicationId, source)` since one bot can have both a Top.gg and DBL config), `votes` (one row per vote event, `hasRole` tracks whether the role is currently applied, `expiresAt` drives removal), `forwardings` (optional user-configured relay of webhook payloads to their own backend, secret stored encrypted), `blacklist`, `verifications`, `owners` (encrypted OAuth tokens for verified bot owners).
- `util.ts` — `makeDB(d1)` wraps `drizzle()` with the schema; always construct the DB this way rather than calling `drizzle()` directly, so typings stay consistent.
- `Cryptor` class (in `schema.ts`) — AES-GCM encrypt/decrypt for secrets at rest (forwarding secrets, owner access tokens). Uses `env.ENCRYPTION_KEY`.
- Migrations are hand/tool-generated into `drizzle/migrations/` via `drizzle-kit`, applied with `wrangler d1 migrations apply`. `drizzle.config.ts` uses the `d1-http` driver (no local SQLite file — reads/writes remote D1 directly via API token).

**Vote lifecycle** (the core flow):

1. Webhook arrives at `routes/webhooks/{topgg,dbl}` → validates signature/secret against the app's `applications` row → inserts a `votes` row (snowflake ID from `src/snowflake.ts`) → enqueues to `VOTE_APPLY` queue (and `FORWARD_WEBHOOK` if the app has forwarding configured).
2. `voteapply` queue consumer (`queueHandlers.ts::handleVoteApply`) assigns the Discord role via REST, sets `hasRole = true`. Drops messages older than 12h. Acks on `UnknownMember`, retries with backoff otherwise.
3. Cron (`*/5 * * * *`) finds votes whose `expiresAt` has passed and no other active vote exists for that user+guild+role, enqueues to `VOTE_REMOVE`.
4. `voteremove` queue consumer removes the role only if no other active (non-expired, `hasRole=true`) vote exists for that user+guild+role combo, then flips `hasRole = false` for the batch.
5. `forwardwebhook` queue consumer relays the original payload to a user-configured `targetUrl`, decrypting the stored secret first; gives up (acks) after exceeding `delaySeconds` backoff table (`src/utils.ts`) or if the payload is >2h old.

**Queue message bodies** are typed in `types/index.d.ts` (`QueueMessageBody`) and `types/webhooks.d.ts` (`ForwardingPayload`, `ForwardingQueuePayload`) — check these when changing what a queue producer sends vs. what the consumer expects.

**Bindings**: all Cloudflare bindings (D1, queues, DOs, KV, rate limiters) are declared in `wrangler.jsonc`. After changing bindings, run `pnpm gen` to regenerate `worker-configuration.d.ts` (the `Env` type) — don't hand-edit that generated file.

**Secrets/env vars**: required secret names live in `wrangler.jsonc`'s `secrets.required` array (feeds directly into the generated `Env` type via `pnpm gen`) and are mirrored in `.env.example`. Adding a new `env.X` reference in code means adding `X` to both.

## Conventions worth knowing

- IDs (Discord snowflakes, vote IDs) are stored and passed as `string`, not `bigint`/`number`, to avoid precision loss across JSON/queue boundaries — keep new code consistent with this.
- `console.log`/`console.error` is the only logging; the project TODO notes there's an open goal to cut down on log volume (~60 calls) to reduce noise in production — avoid adding new non-error logs unless they're genuinely load-bearing for debugging.
- Queue consumers are defensive about partial-batch failures: always ack/retry per-message rather than failing the whole batch, and prefer acking (giving up) over infinite retries once a backoff table is exhausted.
