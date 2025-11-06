import { ModalBuilder } from "@discordjs/builders";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { guilds } from "./db/schema";
import { ChatInputCommandInteraction } from "./discord/ChatInputInteraction";

export async function handleCommand(interaction: ChatInputCommandInteraction, env: Env) {
  console.log("Handling command:", interaction.commandName);
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

  console.log("Handling config subcommand:", subcommand);
  if (subcommand === "add") {
    await ctx.deferReply(true);
    console.log("Adding app to guild configuration");
    const bot = ctx.options.getString("bot", true);
    const roleId = ctx.options.getRole("role", true).id;
    const durationHours = ctx.options.getInteger("duration_hours", true);
    const durationSeconds = Math.min(durationHours * 3600, 3600); // Minimum of 1 hour
    const guildId = ctx.guildId!;
    // Insert the new guild configuration into the database
    console.log("Inserting guild configuration into database");
    await db
      .insert(guilds)
      .values({
        guildId,
        voteRoleId: roleId,
        roleDurationSeconds: durationSeconds,
      })
      .onConflictDoUpdate({
        target: guilds.guildId,
        set: {
          voteRoleId: roleId,
          roleDurationSeconds: durationSeconds,
        },
      });
    await ctx.editReply({ content: `App with bot ID ${bot} added to guild configuration.` }).catch(console.error);
    console.log("Guild configuration inserted into database");
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

  if (subcommand === "list") {
    console.log("Listing configured apps for guild");
    const guildId = ctx.guildId!;
    const configs = await db.select().from(guilds).where(eq(guilds.guildId, guildId));
    if (configs.length === 0) {
      return ctx.reply({ content: "No apps configured for this guild." }, true);
    }
    const appList = configs.map((config) => `- Role: <@&${config.voteRoleId}>`).join("\n");
    return ctx.reply({ content: `Configured apps for this guild:\n${appList}` }, true);
  }

  return ctx.reply({ content: "Invalid subcommand." }, true);
}
