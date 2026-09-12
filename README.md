# Upvote Engine

UpvoteEngine is a performant Discord vote handler built on a FaaS architecture using Cloudflare Workers.
This serverless approach ensures highly performant role management by automatically assigning and removing
roles based on Top.gg/Discord Bot List (DBL) votes with minimal latency and maximum scalability due to the
services used.

Docs, setup guides, and legal pages are published at [upvote-engine.thelukez.com/docs](https://upvote-engine.thelukez.com/docs/getting-started/).

> [!IMPORTANT]
> Top.gg has changed their webhook system, and the legacy webhook configuration is no longer supported for new setups.
> Use `/app create` and follow the instructions to set up new webhooks with the new system.
>
> Existing legacy webhook configurations continue to be supported until the end of 2026, but they can no longer be newly configured or modified.

## How it's done

- Cloudflare Worker built with Hono
  - Fetch handler by Hono
  - Slash-command/component interactions handled by [honocord](https://www.npmjs.com/package/@honocord/cache-do), a Hono-based Discord interaction framework (not raw discord-interactions routing)
  - Queue handler native to Cloudflare Workers: processes role assignments/removals and webhook forwarding asynchronously
  - Cron Scheduler native to Cloudflare Workers: expires votes, purges old vote rows, and cleans up guilds the bot is no longer in

- Webhook endpoints for Top.gg (`v0`, `v1`, and a legacy alias) and DBL vote notifications
- Cloudflare Queues for processing role assignments, removals, and webhook forwarding
- Cloudflare D1 (via Drizzle ORM) for application configs, votes, blacklist, and verified bot ownership
- Durable Objects for in-memory blacklist caching and the honocord interaction cache
- Docs site (`docs-site/`, SvelteKit + svelte-docsmith) built and served as the Worker's static assets at `/docs/*` and `/legal/*`
- @discordjs packages for Discord API interactions
  - @discordjs/rest
  - @discordjs/core
  - @discordjs/builders
  - @discordjs/collection
  - discord-api-types

If you want to contribute, feel free to open issues or pull requests!

## Setup Workflow

### For Bot Owners

1. **Configure in Discord**
   - Run the `/app create` command in your Discord server.
   - Select the bot to configure, the vote source (e.g., Top.gg), the reward role, and optional duration.
2. **Follow On-Screen Instructions**
   - The bot will provide a webhook URL and secret.
   - Follow the provided instructions to add the webhook on the voting site (Top.gg/DBL).
   - Once configured, votes will be processed automatically!

### Authorization

Only the following users can configure an app:

- Verified bot owners (use `/verify-app-ownership` to verify)
- The UpvoteEngine system owner

### Additional Commands

- `/app list` - View all configured apps in your server
- `/app edit` - Modify role or duration settings for an app
- `/app remove` - Remove an app configuration
- `/app forwarding set/edit/remove/view` - Set up webhook forwarding to your own backend
- `/verify-app-ownership` - Verify your bot ownership to gain configuration access

## Notes

- When setting this up yourself, you need to modify the `wrangler.jsonc` file to include your own bindings, account_id, and other necessary configurations.
- Make sure to set up your database, environment variables, and queues as needed.
- `./public/` is generated (git-ignored) by building `docs-site/` — `pnpm deploy`/`pnpm build` run `pnpm docs:build` first, which the Worker then serves via its `ASSETS` binding. Run `pnpm docs:dev` to work on the docs site standalone.

## License

Elastic License 2.0

In plain terms, you can use, modify, distribute, and run this software in commercial or production environments.
You are restricted from offering the software to third parties as a hosted or managed service that provides access to its features,
and from circumventing any license-key functionality; a few other minor conditions apply too, such as passing along the license terms
and preserving copyright notices. See the [LICENSE](./LICENSE) file for full terms.

---

### TODO

- [ ] Cut down on Logs (only log errors and **really** important info) - currently there are about 60 logs in the whole project, which is excessive for production
