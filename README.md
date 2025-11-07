# Discord Vote Handler

Automatically assign and remove roles based on user votes on top.gg.

## How it's done

- Cloudflare Worker built with Hono

  - Fetch handler by Hono
  - Queue handler native to Cloudflare Workers
    This is used to process role assignments and removals asynchronously.

  - Cron Scheduler native to Cloudflare Workers
    This is used to run periodic tasks like cleaning up old votes and invalid guilds.

- Webhook endpoint for top.gg vote notifications
- Cloudflare Queues for processing role assignments and removals
- @discordjs packages for Discord API interactions
  - @discordjs/rest
  - @discordjs/core
  - @discordjs/builders
  - @discordjs/collection
  - discord-api-types

If you want to contribute, feel free to open issues or pull requests!

## License

PolyForm Internal Use License 1.0.0

In plain terms, you can use and modify the software for you or your organization's internal projects,
but you cannot ship your own product or service that competes with the original software,
nor can you use it in a production environment.

---

### TODO

- [ ] Cut down on Logs (only log errors and **really** important info)
