import { ModalBuilder } from "@discordjs/builders";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { guilds } from "./db/schema";
import { InteractionResponseType } from "discord-api-types/v10";
import { MyContext } from "../types";
import { ChatInputCommandInteraction } from "./discord/ChatInputInteraction";

export async function handleCommand(c: MyContext) {
  const ctx = c.get("command");
  console.log("Handling command:", ctx.commandName);
  switch (ctx.commandName) {
    case "ping":
      return ctx.reply({ content: "Pong!" }, true);
    case "config":
      return handleConfig(c, ctx);
    default:
      return ctx.reply({ content: `Unknown command: ${ctx.commandName}` }, true);
  }
}

async function handleConfig(c: MyContext, ctx: ChatInputCommandInteraction) {
  // Currently, there is only one subcommand group for config: "app"
  const subcommand = ctx.options.getSubcommand(true) as "list" | "add" | "remove";
  const db = drizzle(c.env.vote_handler);

  console.log("Handling config subcommand:", subcommand);
  if (subcommand === "add") {
    console.log("Deferring reply for add subcommand");
    await fetch(`https://discord.com/api/v10/interactions/${ctx.id}/${ctx.token}/callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bot ${c.env.DISCORD_TOKEN}`,
      },
      body: JSON.stringify({
        type: InteractionResponseType.DeferredChannelMessageWithSource,
        data: {
          flags: 64,
        },
      }),
    });

    console.log("Adding app to guild configuration");

    try {
      const bot = ctx.options.getUser("bot", true);
      console.log("Bot extracted:", bot);

      const role = ctx.options.getRole("role", true);
      console.log("Role extracted:", role);
      const roleId = role.id;

      const durationHours = ctx.options.getInteger("duration", true);
      console.log("Duration extracted:", durationHours);

      const durationSeconds = Math.min(durationHours * 3600, 3600); // Minimum of 1 hour
      const guildId = ctx.guildId;
      console.log("Extracted parameters:", { bot, roleId, durationSeconds, guildId });

      if (!guildId) {
        return ctx.editReply({ content: "This command can only be used in a server." });
      }

      console.log("Inserting guild configuration into database");
      // await db
      //   .insert(guilds)
      //   .values({
      //     guildId: guildId,
      //     voteRoleId: roleId,
      //     roleDurationSeconds: durationSeconds,
      //   })
      //   .onConflictDoUpdate({
      //     target: guilds.guildId,
      //     set: {
      //       voteRoleId: roleId,
      //       roleDurationSeconds: durationSeconds,
      //     },
      //   });
      await ctx.editReply({ content: `App with bot ID ${bot} added to guild configuration.` });
      console.log("Guild configuration inserted into database");
    } catch (error) {
      console.error("Error extracting parameters or adding app configuration:", error);
      await ctx.editReply({ content: `Failed to add app configuration: ${error instanceof Error ? error.message : "Unknown error"}` });
    }
    return;
  }

  if (subcommand === "list") {
    console.log("Listing configured apps for guild");
    const guildId = ctx.guildId!;
    try {
      const configs = await db.select().from(guilds).where(eq(guilds.guildId, guildId));
      if (configs.length === 0) {
        return ctx.reply({ content: "No apps configured for this guild." }, true);
      }
      const appList = configs.map((config) => `- Role: <@&${config.voteRoleId}>`).join("\n");
      return ctx.reply({ content: `Configured apps for this guild:\n${appList}` }, true);
    } catch (error) {
      console.error("Error listing configurations:", error);
      return ctx.reply({ content: "Failed to list configurations. Please try again." }, true);
    }
  }

  if (subcommand === "remove") {
    return ctx.showModal(
      new ModalBuilder({
        title: "Remove App",
        custom_id: "remove_app_modal",
      }).addLabelComponents((l) =>
        l
          .setLabel("Bot")
          .setDescription("Bot to remove")
          .setUserSelectMenuComponent((us) => us.setCustomId("bot")),
      ),
    );
  }

  return ctx.reply({ content: "Invalid subcommand." }, true);
}
