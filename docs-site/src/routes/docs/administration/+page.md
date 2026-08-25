---
title: Administration
description: Blacklisting guilds, users, and bots.
section: Getting Started
order: 2
---

<script>
  import { Callout } from 'svelte-docsmith';
</script>

# Administration

<Callout variant="note" title="Restricted command">

`/admin` is only registered in the guild configured via the `ADMIN_GUILD_ID` environment variable — it isn't available to regular server admins anywhere else. On the public bot, that's a private admin server.

</Callout>

The `/admin` command manages three separate blacklists, each with `add`, `remove`, and `list` subcommands:

| Subcommand group         | Blocks                                           |
| ------------------------ | ------------------------------------------------ |
| `/admin guild-blacklist` | The guild from using any bot commands            |
| `/admin user-blacklist`  | The user from using any bot commands             |
| `/admin bot-blacklist`   | The application from being configured via `/app` |

Examples:

- `/admin guild-blacklist add guild-id:<id>` / `remove` / `list`
- `/admin user-blacklist add user-id:<id>` / `remove` / `list`
- `/admin bot-blacklist add bot-id:<id>` / `remove` / `list`

Blacklist entries are cached in a Durable Object for fast lookups and kept in sync with the database on every add/remove.
