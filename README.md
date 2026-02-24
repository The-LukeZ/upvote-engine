# Upvote Engine

UpvoteEngine is a performant Discord vote handler built on a FaaS architecture using Cloudflare Workers.
This serverless approach ensures highly performant role management by automatically assigning and removing
roles based on top.gg votes with minimal latency and maximum scalability due to the services used.

> [!IMPORTANT]
> Top.gg has changed their webhook system, and the legacy webhook configuration is no longer supported for new setups.
> Use `/app create` and follow the instructions to set up new webhooks with the new system.
>
> Existing legacy webhook configurations continue to be supported until the end of 2026, but they can no longer be newly configured or modified.

## How it's done

- Cloudflare Worker built with Hono
  - Fetch handler by Hono
  - Queue handler native to Cloudflare Workers: This is used to process role assignments and removals asynchronously.

  - Cron Scheduler native to Cloudflare Workers: This is used to run periodic tasks like cleaning up old votes and invalid guilds.

- Webhook endpoint for top.gg vote notifications
- Cloudflare Queues for processing role assignments and removals
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

## License

PolyForm Internal Use License 1.0.0

In plain terms, you can use and modify the software for you or your organization's internal projects,
but you cannot ship your own product or service that competes with the original software,
nor can you use it in a public production environment (and especially not commercial).

---

### TODO

- [ ] Cut down on Logs (only log errors and **really** important info) - currently there are about 60 logs in the whole project, which is excessive for production
