import { SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder } from "@discordjs/builders";
import { REST } from "@discordjs/rest";
import { RESTPutAPIApplicationCommandsResult, Routes } from "discord-api-types/v10";

const commands: SlashCommandSubcommandsOnlyBuilder[] = [
  new SlashCommandBuilder().setName("ping").setDescription("Replies with Pong!"),
  new SlashCommandBuilder()
    .setName("config")
    .setDescription("Configure the bot for this server")
    .setContexts(0)
    .setDefaultMemberPermissions(32) // Manage Server
    .addSubcommandGroup((group) =>
      group
        .setName("app")
        .setDescription("Configure apps for this server")
        .addSubcommand((sub) => sub.setName("list").setDescription("List all configured apps"))
        .addSubcommand((sub) =>
          sub
            .setName("add")
            .setDescription("Add a new app")
            .addUserOption((opt) => opt.setName("bot").setDescription("The bot user to add").setRequired(true))
            .addRoleOption((opt) => opt.setName("role").setDescription("Role to assign on vote").setRequired(true))
            .addIntegerOption(
              (op) =>
                op
                  .setName("duration")
                  .setDescription("Duration in hours (!) for which the role will be active")
                  .setRequired(true)
                  .setMinValue(1)
                  .setMaxValue(336), // 14 days
            ),
        )
        .addSubcommand((sub) => sub.setName("remove").setDescription("Remove an app")),
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
