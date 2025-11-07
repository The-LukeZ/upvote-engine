# Discord Vote Handler

Automatically assign and remove roles based on user votes on top.gg.

How it's done:

- Cloudflare Worker built with Hono
- Webhook endpoint for top.gg vote notifications
- Cloudflare Queues for processing role assignments and removals
- @discordjs packages for Discord API interactions
  - @discordjs/rest
  - @discordjs/core
  - @discordjs/builders
  - @discordjs/collection
  - discord-api-types

If you want to contribute, feel free to open issues or pull requests!
