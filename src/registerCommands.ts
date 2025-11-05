import { SlashCommandBuilder } from "@discordjs/builders";
import { REST } from "@discordjs/rest";
import { RESTPostAPIChatInputApplicationCommandsJSONBody, RESTPutAPIApplicationCommandsResult, Routes } from "discord-api-types/v10";

const commands: SlashCommandBuilder[] = [new SlashCommandBuilder().setName("ping").setDescription("Replies with Pong!")];

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
    body: commands,
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
