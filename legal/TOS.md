# Terms of Service

These Terms of Service ("Terms") govern your use of the Vote Handler Discord Bot (the "bot", "app") provided by The-LukeZ ("I", "me", or "my").
By using the bot, you agree to be bound by these Terms. If you do not agree to these Terms, do not use the bot.

## 1. Service Description

The bot processes vote webhooks from top.gg and assigns or removes roles in a configured Discord server, based on the configuration set by the server managers.

This works by getting a generated secret from the bot and setting it up in the top.gg webhook settings for your bot, along with a desired webhook URL to the app.

When a user votes for your bot on top.gg, top.gg sends a notification to the webhook URL, which the bot processes to assign or remove roles in your Discord server.

This role assignment and removal is either temporary (for a duration specified in the configuration) or permanent, depending on your setup.

