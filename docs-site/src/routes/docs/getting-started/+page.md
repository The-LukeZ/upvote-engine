---
title: Getting Started
description: Set up Upvote Engine for your Discord bot.
section: Getting Started
order: 0
---

<script>
  import { Callout } from 'svelte-docsmith';
</script>

# Getting Started

<Callout variant="note" title="Legacy (v0) webhooks are being phased out">

Top.gg changed how their webhook system works. New webhooks created via the Top.gg dashboard today are **v1** (signed) webhooks — that's what the setup steps below walk you through, and UpvoteEngine auto-detects and validates them. Older **Legacy (v0)** webhooks, set up before Top.gg's revamp, keep working but can no longer be newly created, and Top.gg will stop supporting them entirely at the end of 2026.

</Callout>

UpvoteEngine handles Top.gg and DBL votes and applies roles, either temporary or permanently, in your associated Discord server.

## Currently supported platforms

- Top.gg
- DBL (Discord Bot List)

There are more platforms planned, but not added yet (because every platform requires a completely new handler).

## How to use the bot

Use the `/app` command to configure your application. This command requires **Manage Server** permissions by default — but permission alone isn't enough to configure a specific bot, see [Who Can Configure Apps](#who-can-configure-apps) below.

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

## Who Can Configure Apps

Configuring an app (create/edit/remove/reset-secret/forwarding) for **any** platform — Top.gg or DBL — requires one of the following, on top of having Manage Server permission:

- You are the verified owner of the application (use `/verify-app-ownership` to verify, see below)
- You are the global UpvoteEngine service owner

<Callout variant="note">

There's no shortcut for DBL anymore — both Top.gg and DBL configuration require ownership verification. A regular server admin without a verified/owner relationship to the bot will get an "unauthorized" reply.

</Callout>

### Verifying Ownership

1. Run `/verify-app-ownership` and select the bot
2. Click **Authorize Bot** — you authorize the bot with the `applications.entitlements` scope so it can check for an entitlement only the real owner would have
3. Click **Verify Ownership** — the bot checks the entitlement and marks you as verified for that application

Once verified, you (and anyone else who verifies for the same application) can configure it in any server.

## Setting Up Top.gg Vote Rewards

1. Use `/app create`, select the bot, choose **Top.gg** as the source, pick a role, and optionally set a duration in hours
2. If you're not yet verified/the owner, you'll be asked to verify ownership first
3. The bot replies with setup instructions: go to the bot's [Top.gg Integrations Page](https://top.gg/bot/<bot-id>/dashboard/integrations), click **Create** to add a legacy webhook, and paste the shown webhook URL into Top.gg
4. Enable the **Vote Created** event on Top.gg and save — Top.gg then shows you a secret
5. Copy that secret and click the button in the Discord message to paste it in — this finishes the setup

### Testing Your Setup

Top.gg lets you send test votes to make sure everything works. Visit the bot's integrations page on Top.gg and trigger a test vote — since test payloads are only delivered to users, you need to have the bot installed as a **user app** to receive the test vote confirmation as a DM.

## Setting Up DBL Rewards

1. Use `/app create`, select the bot, choose **DBL** as the source, pick a role (required), and optionally set a duration in hours
2. If you're not yet verified/the owner, you'll be asked to verify ownership first
3. Done — a webhook secret is generated automatically. Copy it from the reply and set it in your bot's DBL webhook settings

## Managing Your Apps

### View All Configured Bots

Use `/app list` to see all bots configured in your server, their vote role, and role duration.

### Edit an Existing Configuration

Use `/app edit` to change the role or duration for any configured bot.

### Reset a Webhook Secret

Use `/app reset-secret` if you lost the secret or suspect it leaked.

- For **DBL**, a new secret is generated immediately.
- For **Top.gg**, you first have to reset the webhook secret on Top.gg's dashboard yourself, then paste the new secret into the modal the bot shows you.

### Remove a Bot Configuration

Use `/app remove` to stop rewarding votes for a bot. This will:

- Stop assigning roles to new voters
- Remove all vote history for that bot
- Delete any webhook forwarding settings

<Callout variant="warning">

Removing a configuration only deletes it on UpvoteEngine's side. You still need to delete/disable the webhook on Top.gg's or DBL's dashboard yourself — there's no way for the bot to do that from its side.

</Callout>

## Forwarding Webhooks (Advanced)

Want to send vote data to your own website or service? You can forward vote notifications — see [Webhook Forwarding](/docs/webhook-forwarding/) for the full payload format and retry behavior.

Setting it up (`/app forwarding set`) sends a live test payload to your URL before saving, so the target must already be reachable and responding correctly.

### Security Notes

For your protection, you cannot forward to:

- localhost or private/loopback IP addresses
- UpvoteEngine's own domain
- Invalid or unreachable URLs (the target must resolve to a real hostname over HTTPS)

## Limits

- Maximum of 25 app configurations per server
- Role duration: 1 hour minimum, 14 days (336 hours) maximum

## Common Questions

**Q: Why can't I configure a bot with `/app create`?**

A: You need to be the verified owner of that application (or the global service owner). Run `/verify-app-ownership` first.

**Q: Can I have multiple servers for one bot + source combination?**

A: No — one application configuration (per source) can only be linked to one Discord server at a time.

**Q: What happens if the role gets deleted while someone has it?**

A: The bot will try to assign/remove the configured role. If the role no longer exists, votes are still recorded but the role assignment silently fails.

**Q: Do voters keep the role forever?**

A: Only if you don't set a duration. If you set a duration (e.g. 24 hours), the role is automatically removed after that time via a background job that runs every 5 minutes.

## Need Help?

If something isn't working:

1. Check that the bot is in the server
2. Make sure the role you selected still exists
3. Verify the bot has permission to assign that role (UpvoteEngine's role must be above the reward role in the role hierarchy)
4. Try sending a test vote if the platform supports it

Still stuck? Use `/help` in Discord, or [open a Q&A discussion on GitHub](https://github.com/The-LukeZ/upvote-engine/discussions/new?category=q-a).
