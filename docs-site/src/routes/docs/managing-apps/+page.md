---
title: Managing Your Apps
description: View, edit, reset, and remove app configurations.
section: Getting Started
order: 4
---

<script>
  import { Callout } from 'svelte-docsmith';
</script>

## View All Configured Bots

Use `/app list` to see all bots configured in your server, their vote role, and role duration.

## Edit an Existing Configuration

Use `/app edit` to change the role or duration for any configured bot.

## Reset a Webhook Secret

Use `/app reset-secret` if you lost the secret or suspect it leaked. For both **DBL** and **Top.gg**, a new secret is generated and applied immediately — no dashboard visit needed.

## Remove a Bot Configuration

Use `/app remove` to stop rewarding votes for a bot. This will:

- Stop assigning roles to new voters
- Remove all vote history for that bot
- Delete any webhook forwarding settings

<Callout variant="warning">

Removing a **DBL** configuration only deletes it on UpvoteEngine's side — you still need to delete/disable the webhook on DBL's dashboard yourself, there's no way for the bot to do that from its side. **Top.gg** configurations are cleaned up automatically: the webhook and OAuth authorization are removed from Top.gg as part of `/app remove`.

</Callout>

## Limits

- Maximum of 25 app configurations per server
- Role duration: 1 hour minimum, 14 days (336 hours) maximum
