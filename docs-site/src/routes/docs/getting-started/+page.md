---
title: Getting Started
description: Set up Upvote Engine for your Discord bot.
section: Getting Started
order: 0
---

UpvoteEngine handles Top.gg, DBL and Bumped.gg votes and applies roles, either temporary or permanently, in your associated Discord server.

## Currently supported platforms

- Top.gg
- DBL (Discord Bot List)
- Bumped.gg

There are more platforms planned, but not added yet (because every platform requires a completely new handler).

## How to use the bot

Use the `/app` command to configure your application. This command requires **Manage Server** permissions by default — but permission alone isn't enough to configure a specific bot, see [Permissions & Ownership](/docs/permissions/) for details.

You can have up to 25 applications per server, but only one server can be configured per application + source combination.

## Commands

| Command                  | Description                                                                       |
| ------------------------ | --------------------------------------------------------------------------------- |
| `/help`                  | Shows info and useful links about the bot                                         |
| `/app list`              | List all app configurations for the server                                        |
| `/app create`            | Create a new app configuration for the server                                     |
| `/app edit`              | Edit an existing app configuration                                                |
| `/app reset-secret`      | Reset the webhook secret for an app configuration                                 |
| `/app remove`            | Remove an app configuration for the server                                        |
| `/app forwarding set`    | Set the forwarding configuration for a configured app                             |
| `/app forwarding edit`   | Edit a forwarding configuration                                                   |
| `/app forwarding remove` | Remove a forwarding configuration                                                 |
| `/app forwarding view`   | View the forwarding configuration (secret is sanitized, only first 4 chars shown) |
| `/verify-app-ownership`  | Start ownership verification for a bot application                                |

Always read the descriptions everywhere. Please.

## Next steps

- [Permissions & Ownership](/docs/permissions/) — who can configure an app, and how to verify ownership
- [Setting Up Top.gg Vote Rewards](/docs/setup-topgg/)
- [Setting Up DBL Vote Rewards](/docs/setup-dbl/)
- [Managing Your Apps](/docs/managing-apps/) — viewing, editing, resetting, and removing configurations
- [Webhook Forwarding](/docs/webhook-forwarding/) — relay vote notifications to your own service
- [FAQ](/docs/faq/)
