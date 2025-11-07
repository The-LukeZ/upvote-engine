# Privacy Policy

This Privacy Policy describes how The-LukeZ ("I", "me", or "my") collects, uses, and protects your information when you use the Vote Handler Discord Bot (the "bot", "app", "service").

For terms governing your use of the service, please refer to our Terms of Service.

## 1. Information We Collect

### Automatically Collected Information

When you use the bot, I automatically collect the following information:

- **Discord User IDs** of users who vote for bots using our service
- **Discord Server IDs** where the bot operates and assigns/removes roles
- **Application IDs** of the applications using the bot service
- **Vote timestamps** indicating when votes are received
- **Role assignment/removal timestamps** for tracking temporary role durations
- **Unique vote identifiers** provided by top.gg webhooks

### Configuration Data

- Server-specific bot configurations set by server managers
- Webhook secrets (stored securely and not displayed after generation)
- Role assignment settings and durations

## 2. How We Use Your Information

Your information is used solely for:

- Processing vote webhooks from top.gg
- Assigning and removing Discord roles based on votes
- Maintaining temporary role assignments with proper expiration
- Improving the bot's functionality and reliability
- Ensuring proper service operation and security

## 3. Data Storage and Security

- Data is stored using Cloudflare D1 database services
- Webhook secrets are securely stored and not displayed after initial generation
- I implement reasonable security measures to protect your data
- However, no system is completely secure, and I cannot guarantee absolute data security

You are responsible for keeping your webhook secrets secure. If you believe your webhook secret has been compromised, you should generate a new one using the bot. I am not responsible for any unauthorized access to your webhook or Discord server resulting from a compromised webhook secret by anyone but myself.

## 4. Data Retention

- **Vote Data**: Retained until the bot is removed from your Discord server. This includes information about the user who voted, the application for which the vote was cast, the timestamp of the vote, the timestamp for when the role should expire (if applicable), and the unique vote ID.
- **Application Configurations**: Retained until the bot is removed from your Discord server
- All associated data is deleted when you use commands like `/config app remove` and set the option to delete vote data as well.

### When is your data deleted?

After removing the bot from your Discord server, no data is deleted immediately. A scheduled task runs every Sunday on 3 AM UTC to clean up data for guilds where the bot is no longer present. This includes deleting all vote data and application configurations associated with those guilds.

## 5. Data Sharing

I do not sell, trade, or share your personal information with third parties, except:

- When required by law or legal process
- To protect the rights, property, or safety of the service, users, or others
- With your explicit consent

## 6. Third-Party Services

The bot interacts with:

- **Discord**: Subject to Discord's Privacy Policy
- **Top.gg**: Subject to Top.gg's Privacy Policy
- **Cloudflare**: For data storage and processing

You are responsible for reviewing these third-party privacy policies.

## 7. Your Rights

### General Rights

- Request information about data we collect about you
- Request deletion of your data using bot commands
- Contact me with privacy concerns

### GDPR Rights (EEA Residents)

If you are located in the European Economic Area, you have additional rights under GDPR:

- **Right of Access**: Request copies of your personal data
- **Right of Rectification**: Request correction of inaccurate data
- **Right of Erasure**: Request deletion of your personal data
- **Right of Portability**: Request transfer of your data
- **Right to Object**: Object to processing of your personal data

To exercise these rights, use the `/config app remove` command or contact me directly.

## 8. Changes to This Privacy Policy

I may update this Privacy Policy from time to time. Continued use of the bot after changes constitutes acceptance of the updated policy.

## 9. Contact Information

For privacy-related questions or to exercise your rights, contact me on Discord at `@thelukez`.

## 10. Governing Law

This Privacy Policy is governed by German law and subject to the jurisdiction of German courts.

The last updated date can be found in the version control history of this document.
