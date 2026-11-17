---
title: Permissions & Ownership
description: Who can configure apps, and how to verify bot ownership.
section: Getting Started
order: 1
---

<script>
  import { Callout } from 'svelte-docsmith';
</script>

## Who Can Configure Apps

Configuring an app (create/edit/remove/reset-secret/forwarding) for **any** platform (Top.gg, DBL or Bumped.gg) requires one of the following, on top of having Manage Server permission:

- You are the verified owner of the application (use `/verify-app-ownership` to verify, see below)
- You are the global UpvoteEngine service owner

<Callout variant="note">

There's no shortcut for DBL anymore — both Top.gg and DBL configuration require ownership verification. A regular server admin without a verified/owner relationship to the bot will get an "unauthorized" reply.

</Callout>

## Verifying Ownership

1. Run `/verify-app-ownership` and select the bot
2. Click **Authorize Bot** — you authorize the bot with the `applications.entitlements` scope so it can check for an entitlement only the real owner would have
3. Click **Verify Ownership** — the bot checks the entitlement and marks you as verified for that application

Once verified, you (and anyone else who verifies for the same application) can configure it in any server.
