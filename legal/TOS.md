# Terms of Service

These Terms of Service ("Terms") govern your use of the UpvoteEngine Discord Bot (the "bot", "app", "service") provided by The-LukeZ ("I", "me", or "my"). By using the bot, you agree to be bound by these Terms. If you do not agree to these Terms, do not use the bot.

For information on how we handle your data, please refer to our Privacy Policy.

## 1. Service Description

The bot processes vote webhooks from top.gg and assigns or removes roles in a configured Discord server, based on the configuration set by the server managers.

This works by getting a generated secret from the bot and setting it up in the top.gg webhook settings for your bot, along with a desired webhook URL to the app.

When a user votes for your bot on top.gg, top.gg sends a notification to the webhook URL, which the bot processes to assign or remove roles in your Discord server.

This role assignment and removal is either temporary (for a duration specified in the configuration) or permanent, depending on your setup.

This service is provided "as is" and "as available" without any warranties of any kind, either express or implied.

This bot is NOT affiliated with or endorsed by Discord or top.gg.

## 2. Service Limitations

You can only have a maximum of 25 active application configurations per Discord server. However, one application configuration can only have one discord server associated with it.

The role reward duration has to be between 1 hour and 336 hours (14 days) if set.

The bot must have proper permissions and role hierarchy to assign roles in your Discord server. That means it must be above the roles it is supposed to assign in the role hierarchy.

Service availability is not guaranteed. Processing the webhooks may take some time, depending on load and other factors. Since I rely on Cloudflare Queues, there may be delays in processing webhooks during high traffic periods.

## 3. User Responsibilities

Only use the service for legitimate Top.gg vote rewards.

Don't abuse the webhook system or attempt to send fraudulent votes.

Ensure that you comply with Discord's Terms of Service and Community Guidelines when using the bot.

Maintain proper bot configuration on Top.gg - that means setting up the correct webhook URL and secret.

## 4. Limitation of Liability

To the maximum extent permitted by law, I shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from:

I. your use or inability to use the bot;  
II. any unauthorized access to or use of my servers and/or any personal information stored therein;  
III. any bugs, viruses, trojan horses, or the like that may be transmitted to or through the bot by any third party;  
IV. any errors or omissions in any content or for any loss or damage incurred as a result of the use of any content posted, emailed, transmitted, or otherwise made available through the bot;  
V. the defamatory, offensive, or illegal conduct of any third party;  
VI. failed role assignments due to insufficient bot permissions, incorrect role hierarchy, or Discord API limitations;  
VII. delayed or failed vote processing due to webhook delivery issues, queue processing delays, or third-party service outages;  
VIII. loss or exposure of webhook secrets;  
IX. any actions taken by Discord or Top.gg that affect the bot's functionality; and/or  
X. any changes to or discontinuation of Discord's or Top.gg's APIs or services.

In no event shall my total liability exceed the amount you paid to use this service (which is zero for free services).

## 5. Service Modifications & Termination

I reserve the right to modify, suspend, or discontinue the bot at any time without prior notice.

I may also update these Terms from time to time. Continued use of the bot after any such changes constitutes your acceptance of the new Terms.

I may terminate or suspend your access to the bot at my sole discretion, without prior notice, for conduct that I believe violates these Terms or is harmful to other users of the bot, me, or third parties.

## 6. Third-Party Services

By using the bot, you acknowledge that it may interact with third-party services such as Discord and Top.gg.

I am not responsible for the actions or policies of these third-party services.

You must comply with the terms of service and policies of these third-party services when using the bot.

## 7. Age Requirements

You must meet Discord's minimum age requirement (13+ or regional equivalent) to use the bot.

## 8. Indemnification

You agree to indemnify and hold harmless The-LukeZ and its affiliates, officers, agents, and employees from any claim or demand, including reasonable attorneys' fees, made by any third party due to or arising out of your use of the bot, your violation of these Terms, or your violation of any rights of another.

## 9. Contact Information

If you have any questions or concerns about these Terms, please contact me on Discord at `@thelukez`.

## 10. Governing Law

These Terms shall be governed by and construed in accordance with the laws of Germany, without regard to its conflict of law principles. Any disputes arising under or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts located in Germany.

The last updated date can be found in the version control history of this document.
