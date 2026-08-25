---
title: FAQ
description: Common questions and troubleshooting steps.
section: Getting Started
order: 7
---

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
