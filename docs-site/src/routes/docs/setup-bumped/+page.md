---
title: Bumped.gg Vote Rewards
description: Configure vote rewards for a Bumped.gg-listed bot.
section: Configuration
order: 12
---

Bumped.gg generates the webhook secret itself, so you hand it to UpvoteEngine instead of the other way around.

1. Open your bot's edit page on Bumped.gg and set the webhook URL to `https://upvote-engine.thelukez.com/webhook/bumped/<your bot's application ID>`
2. Copy the webhook secret Bumped.gg shows you
3. Use `/app create`, select the bot, choose **Bumped.gg** as the source, pick a role (required), paste the secret into the `secret` option, and optionally set a duration in hours
4. If you're not yet verified/the owner, you'll be asked to verify ownership first (see [Permissions & Ownership](/docs/permissions/))
5. Done. Use the **Send test vote** button on Bumped.gg to check it works (you need the bot installed as a user app to receive the test confirmation DM)

If you skip the `secret` option in step 3, the configuration is still created, but votes are rejected until you set the secret with `/app reset-secret` (source **Bumped.gg**, `secret` option).

If you regenerate the secret on Bumped.gg, run `/app reset-secret` with the new secret in the `secret` option.
