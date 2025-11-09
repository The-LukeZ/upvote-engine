import { SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder } from "@discordjs/builders";
import { REST } from "@discordjs/rest";
import { ApplicationIntegrationType, RESTPutAPIApplicationCommandsResult, Routes } from "discord-api-types/v10";
import { supportedPlatforms } from "./constants";

const commands: SlashCommandSubcommandsOnlyBuilder[] = [
  new SlashCommandBuilder()
    .setName("help")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setDescription("Get help with using the bot"),
  new SlashCommandBuilder()
    .setName("ping")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setDescription("Replies with Pong!"),
  new SlashCommandBuilder()
    .setName("app")
    .setDescription("Configure the application connections for this server")
    .setContexts(0)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setDefaultMemberPermissions(32) // Manage Server
    .addSubcommand((sub) => sub.setName("list").setDescription("List all configured apps"))
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a new app")
        .addUserOption((opt) => opt.setName("bot").setDescription("The bot user to add").setRequired(true))
        .addStringOption((opt) =>
          opt
            .setName("source")
            .setDescription("The bot listing source")
            .setRequired(true)
            .addChoices(
              Object.keys(supportedPlatforms).map((key) => ({
                name: supportedPlatforms[key as keyof typeof supportedPlatforms],
                value: key,
              })),
            ),
        )
        .addRoleOption((opt) => opt.setName("role").setDescription("Role to assign on vote").setRequired(true))
        .addIntegerOption(
          (op) =>
            op
              .setName("duration")
              .setDescription("Duration in hours (!) for which the role will be active")
              .setRequired(false)
              .setMinValue(1)
              .setMaxValue(336), // 14 days
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("Edit an existing app")
        .addUserOption((opt) => opt.setName("bot").setDescription("The bot user to edit").setRequired(true))
        .addStringOption((opt) =>
          opt
            .setName("source")
            .setDescription("The bot listing source")
            .setRequired(true)
            .addChoices(
              Object.keys(supportedPlatforms).map((key) => ({
                name: supportedPlatforms[key as keyof typeof supportedPlatforms],
                value: key,
              })),
            ),
        )
        .addRoleOption((opt) => opt.setName("role").setDescription("Role to assign on vote").setRequired(false))
        .addIntegerOption((op) =>
          op
            .setName("duration")
            .setDescription("Duration in hours (!) for which the role will be active")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(336),
        )
        .addBooleanOption((opt) =>
          opt.setName("generate-secret").setDescription("Whether to generate a new webhook secret").setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove an app")
        .addUserOption((opt) => opt.setName("bot").setDescription("The bot user to remove").setRequired(true))
        .addStringOption((opt) =>
          opt
            .setName("source")
            .setDescription("The bot listing source")
            .setRequired(true)
            .addChoices(
              Object.keys(supportedPlatforms).map((key) => ({
                name: supportedPlatforms[key as keyof typeof supportedPlatforms],
                value: key,
              })),
            ),
        ),
    )
    .addSubcommandGroup((group) =>
      group
        .setName("forwarding")
        .setDescription("Manage webhook forwarding for an application")
        .addSubcommand((sub) =>
          sub
            .setName("set")
            .setDescription("Set the forwarding configuration")
            .addUserOption((opt) => opt.setName("bot").setDescription("The bot user").setRequired(true))
            .addStringOption((opt) => opt.setName("url").setDescription("The target webhook URL").setRequired(true))
            .addStringOption((opt) => opt.setName("secret").setDescription("The webhook secret").setRequired(true)),
        )
        .addSubcommand((sub) =>
          sub
            .setName("edit")
            .setDescription("Edit the forwarding configuration")
            .addUserOption((opt) => opt.setName("bot").setDescription("The bot user").setRequired(true))
            .addStringOption((opt) => opt.setName("url").setDescription("The new target webhook URL").setRequired(false))
            .addStringOption((opt) => opt.setName("secret").setDescription("The new webhook secret").setRequired(false)),
        )
        .addSubcommand((sub) =>
          sub
            .setName("remove")
            .setDescription("Remove the forwarding configuration")
            .addUserOption((opt) => opt.setName("bot").setDescription("The bot user").setRequired(true)),
        )
        .addSubcommand((sub) =>
          sub
            .setName("view")
            .setDescription("View the forwarding configuration")
            .addUserOption((opt) => opt.setName("bot").setDescription("The bot user").setRequired(true)),
        ),
    )
    .addSubcommandGroup((group) =>
      group
        .setName("guild-blacklist")
        .setDescription("Manage blacklisted guilds")
        .addSubcommand((sub) =>
          sub
            .setName("add")
            .setDescription("Add a guild to the blacklist")
            .addStringOption((opt) => opt.setName("guild-id").setDescription("The guild ID to blacklist").setRequired(true)),
        )
        .addSubcommand((sub) =>
          sub
            .setName("remove")
            .setDescription("Remove a guild from the blacklist")
            .addStringOption((opt) => opt.setName("guild-id").setDescription("The guild ID to remove").setRequired(true)),
        )
        .addSubcommand((sub) =>
          sub.setName("list").setDescription("List all blacklisted guilds"),
        ),
    )
    .addSubcommandGroup((group) =>
      group
        .setName("user-blacklist")
        .setDescription("Manage blacklisted users")
        .addSubcommand((sub) =>
          sub
            .setName("add")
            .setDescription("Add a user to the blacklist")
            .addUserOption((opt) => opt.setName("user").setDescription("The user to blacklist").setRequired(true)),
        )
        .addSubcommand((sub) =>
          sub
            .setName("remove")
            .setDescription("Remove a user from the blacklist")
            .addUserOption((opt) => opt.setName("user").setDescription("The user to remove").setRequired(true)),
        )
        .addSubcommand((sub) =>
          sub.setName("list").setDescription("List all blacklisted users"),
        ),
    )
    .addSubcommandGroup((group) =>
      group
        .setName("app-blacklist")
        .setDescription("Manage blacklisted applications")
        .addSubcommand((sub) =>
          sub
            .setName("add")
            .setDescription("Add an application to the blacklist")
            .addUserOption((opt) => opt.setName("bot").setDescription("The bot to blacklist").setRequired(true)),
        )
        .addSubcommand((sub) =>
          sub
            .setName("remove")
            .setDescription("Remove an application from the blacklist")
            .addUserOption((opt) => opt.setName("bot").setDescription("The bot to remove").setRequired(true)),
        )
        .addSubcommand((sub) =>
          sub.setName("list").setDescription("List all blacklisted applications"),
        ),
    ),
];

/**
 * This file is meant to be run from the command line, and is not used by the
 * application server.  It's allowed to use node.js primitives, and only needs
 * to be run once.
 */

const token = process.env.DISCORD_TOKEN;
const applicationId = process.env.DISCORD_APP_ID;

if (!token) {
  throw new Error("The DISCORD_APP_TOKEN environment variable is required.");
}
if (!applicationId) {
  throw new Error("The DISCORD_APP_ID environment variable is required.");
}

/**
 * Register all commands globally.  This can take o(minutes), so wait until
 * you're sure these are the commands you want.
 */
async function registerGlobalCommands() {
  const rest = new REST({ version: "10" }).setToken(token!);
  const response = (await rest.put(Routes.applicationCommands(applicationId!), {
    body: commands.map((cmd) => cmd.toJSON()),
  })) as RESTPutAPIApplicationCommandsResult;

  if (response) {
    console.log("Registered all commands");
  } else {
    console.error("Error registering commands");
    console.error(response);
  }
  return response;
}

await registerGlobalCommands();
