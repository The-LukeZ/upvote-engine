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

Top.gg changed how their webhook system works. New webhooks created via the Top.gg dashboard today are **v1** (signed) webhooks — that's what the setup steps below walk you through, and UpvoteEngine auto-detects and validates them. Older **Legacy (v0)** webhooks, set up before Top.gg's revamp, keep working but can no longer be newly created, and Top.gg will stop supporting them entirely at the end of 2026.

</Callout>

1. Use `/app create`, select the bot, choose **Top.gg** as the source, pick a role, and optionally set a duration in hours
2. If you're not yet verified/the owner, you'll be asked to verify ownership first (see [Permissions & Ownership](/docs/permissions/))
3. The bot replies with setup instructions: go to the bot's [Top.gg Integrations Page](https://top.gg/bot/<bot-id>/dashboard/integrations), click **Create** to add a legacy webhook, and paste the shown webhook URL into Top.gg
4. Enable the **Vote Created** event on Top.gg and save — Top.gg then shows you a secret
5. Copy that secret and click the button in the Discord message to paste it in — this finishes the setup

## Testing Your Setup

Top.gg lets you send test votes to make sure everything works. Visit the bot's integrations page on Top.gg and trigger a test vote — since test payloads are only delivered to users, you need to have the bot installed as a **user app** to receive the test vote confirmation as a DM.
