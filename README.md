# Upvote Engine

UpvoteEngine is a performant Discord vote handler built on a FaaS architecture using Cloudflare Workers.
This serverless approach ensures highly performant role management by automatically assigning and removing
roles based on top.gg votes with minimal latency and maximum scalability due to the services used.

> [!IMPORTANT]
> If you are using the top.gg webhook, you need to execute `/app edit generate-secret:True` again because Top.gg has changed their API and webhooks.
> It now requires a different logic to validate the incoming webhook requests, which is implemented in the latest version of UpvoteEngine.
>
> The legacy webhook validation logic still available but is not recommended to use due to security reasons. In short, topgg webhooks going to the `/topgg` or `/topgg/v0` endpoint are validated with the legacy logic, while new webhooks going to the `/topgg/v1` endpoint are validated with the new logic.
>
> At some point in the future, the legacy logic and structure will be changed again to only support the v1 structure and logic - only `/topgg` and `/topgg/v1` endpoints will be available and are subject to the v1 validation logic. So it's recommended to switch to the new structure and logic as soon as possible.

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
