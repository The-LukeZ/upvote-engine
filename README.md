# Upvote Engine

UpvoteEngine is a performant Discord vote handler built on a FaaS architecture using Cloudflare Workers.
This serverless approach ensures highly performant role management by automatically assigning and removing
roles based on top.gg votes with minimal latency and maximum scalability due to the services used.

> [!IMPORTANT]
> UpvoteEngine now uses Top.gg's Integrations system! The old webhook setup method is deprecated.
> You must connect the UpvoteEngine integration on Top.gg first before you can configure vote rewards in Discord.
>
> **Migration from legacy webhooks:**
> If you're currently using the old webhook system, you'll need to:
>
> 1. Go to your bot's [Top.gg Integrations page](https://top.gg/bot/YOUR_BOT_ID/dashboard/integrations)
> 2. Remove any legacy webhook configurations
> 3. Click **Connect** on the UpvoteEngine integration
> 4. Reconfigure your guild settings using `/integrations configure` in Discord

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

1. **Connect the Integration on Top.gg**
   - Go to your bot's Integrations page on Top.gg
   - Find the **UpvoteEngine** integration and click **Connect**
   - Wait a few seconds for the connection to be established
   - The webhook is now automatically configured!

2. **Configure Guild Settings in Discord**
   - Go to your Discord server where you want vote rewards
   - Run `/integrations configure` command
   - Select your bot, the vote source (Top.gg), the reward role, and optional duration
   - Done! Users will now receive the role when they vote

### Authorization

Only the following users can configure an integration:

- The user who created the integration on Top.gg
- Verified bot owners (use `/integrations ownership-verify` to verify)
- The UpvoteEngine system owner

### Additional Commands

- `/integrations list` - View all configured integrations in your server
- `/integrations edit` - Modify role or duration settings
- `/integrations remove` - Remove an integration configuration
- `/integrations forwarding set/edit/remove/view` - Set up webhook forwarding to your own backend
- `/integrations ownership-verify` - Verify your bot ownership to gain configuration access

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
