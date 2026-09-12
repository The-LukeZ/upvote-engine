---
title: Top.gg Vote Rewards
description: Configure vote rewards for a Top.gg-listed bot.
section: Configuration
order: 10
---

<script>
  import { Callout } from 'svelte-docsmith';
</script>

<Callout variant="note" title="Legacy (v0) webhooks are being phased out">

Existing **v1** (signed) webhooks and older **Legacy (v0)** webhooks continue to work unchanged — nothing is required from you. New setups now go through Top.gg's OAuth authorization flow (the steps below) instead. Top.gg will stop supporting v0 entirely at the end of 2026.

</Callout>

1. Use `/app create`, select the bot, choose **Top.gg** as the source, pick a role, and optionally set a duration in hours
2. If you're not yet verified/the owner, you'll be asked to verify ownership first (see [Permissions & Ownership](/docs/permissions/))
3. The bot replies with a link to authorize UpvoteEngine on Top.gg
4. Click the link and approve — Top.gg and the bot exchange the webhook automatically, no secret to copy, no dashboard visit needed

## Switching an Existing Config to OAuth

Optional — only worth doing if you want `/app reset-secret` to work without a Top.gg dashboard visit, or `/app remove` to also tear down the webhook on Top.gg's side. There's no in-place upgrade: `/app create` refuses if a config already exists for that bot, so you'd need to `/app remove` it (this deletes vote history and forwarding settings) and run `/app create` again to go through the OAuth flow above.

## Testing Your Setup

Top.gg lets you send test votes to make sure everything works. Trigger a test vote from Top.gg's testing tools — since test payloads are only delivered to users, you need to have the bot installed as a **user app** to receive the test vote confirmation as a DM.
