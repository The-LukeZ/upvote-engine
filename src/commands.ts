import { APIChatInputApplicationCommandInteraction, ApplicationCommandOptionType } from "discord-api-types/v10";
import { ModalBuilder } from "@discordjs/builders";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { guilds } from "./db/schema";
import { ChatInputCommandInteraction } from "./discord/ChatInputInteraction";

export async function handleCommand(interaction: ChatInputCommandInteraction, env: Env) {
  switch (interaction.commandName) {
    case "ping":
      return interaction.reply({ content: "Pong!" }, true);
    case "config":
      return handleConfig(interaction, env);
    default:
      return interaction.reply({ content: `Unknown command: ${interaction.commandName}` }, true);
  }
}

async function handleConfig(ctx: ChatInputCommandInteraction, env: Env) {
  // Currently, there is only one subcommand group for config: "app"
  const subcommand = ctx.options.getSubcommand(true) as "list" | "add" | "remove";
  const db = drizzle(env.vote_handler);

  console.log(`Handling config subcommand: ${subcommand}`);
  if (subcommand === "add") {
    await ctx.deferReply(true);
    const bot = ctx.options.getString("bot", true);
    const guildId = ctx.guildId!;
    // Insert the new guild configuration into the database
    await ctx.editReply({ content: `App with bot ID ${bot} added to guild configuration.` });
    return;
  }

  if (subcommand === "remove") {
    return ctx.showModal(
      new ModalBuilder({
        title: "Remove App",
        custom_id: "remove_app_modal",
      }),
    );
  }
}
