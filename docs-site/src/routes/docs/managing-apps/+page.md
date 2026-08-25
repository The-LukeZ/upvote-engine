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

Use `/app reset-secret` if you lost the secret or suspect it leaked.

- For **DBL**, a new secret is generated immediately.
- For **Top.gg**, you first have to reset the webhook secret on Top.gg's dashboard yourself, then paste the new secret into the modal the bot shows you.

## Remove a Bot Configuration

Use `/app remove` to stop rewarding votes for a bot. This will:

- Stop assigning roles to new voters
- Remove all vote history for that bot
- Delete any webhook forwarding settings

<Callout variant="warning">

Removing a configuration only deletes it on UpvoteEngine's side. You still need to delete/disable the webhook on Top.gg's or DBL's dashboard yourself — there's no way for the bot to do that from its side.

</Callout>

## Limits

- Maximum of 25 app configurations per server
- Role duration: 1 hour minimum, 14 days (336 hours) maximum
