import { codeBlock, ModalBuilder } from "@discordjs/builders";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { APIEmbed, InteractionResponseType } from "discord-api-types/v10";
import { MyContext } from "../types";
import { ChatInputCommandInteraction } from "./discord/ChatInputInteraction";
import { votes, applications } from "./db/schema";
import { randomString } from "./utils";
import dayjs from "dayjs";
import { Colors } from "./discord/colors";

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
  const db = drizzle(c.env.vote_handler, { schema: { webhookSecrets: applications, votes } });

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
      if (!bot.bot) {
        return ctx.editReply({ content: "The selected user is not a bot." });
      }

      const role = ctx.options.getRole("role", true);
      const roleId = role.id;

      const durationHours = ctx.options.getInteger("duration", true);
      const durationSeconds = Math.min(durationHours * 3600, 3600); // Minimum of 1 hour
      const guildId = ctx.guildId;
      console.log("Extracted parameters:", { bot, roleId, durationSeconds, guildId });

      if (!guildId) {
        return ctx.editReply({ content: "This command can only be used in a server." });
      }

      // Check if a config for the bot already exists

      const generatedSecret = randomString(64);
      const regenerateSecret = ctx.options.getBoolean("generate-secret") ?? false;

      const result = await db
        .insert(applications)
        .values({
          guildId: guildId,
          applicationId: bot.id,
          voteRoleId: roleId,
          roleDurationSeconds: durationSeconds,
          secret: generatedSecret,
        })
        .onConflictDoUpdate({
          target: [applications.applicationId, applications.guildId],
          set: {
            voteRoleId: roleId,
            roleDurationSeconds: durationSeconds,
            secret: regenerateSecret ? generatedSecret : undefined, // hopefully this doesn't reset every time
            // do not update secret on conflict, because that would invalidate existing webhooks
          },
        })
        .returning()
        .get();

      // consider inserted if created within last 3 seconds (because we don't want to read from the db before to check)
      const isInserted = dayjs(result.createdAt).isAfter(dayjs().subtract(3, "seconds"));

      const embeds: APIEmbed[] = [
        {
          title: isInserted ? "App Configured" : "App Configuration Updated",
          color: Colors.Green,
          description: `Successfully ${isInserted ? "added" : "updated"} configuration for bot <@${bot.id}> in this guild.`,
          fields: [
            {
              name: "Vote Role",
              value: `<@&${roleId}>`,
              inline: true,
            },
            {
              name: "Role Duration",
              value: `${Math.floor(durationSeconds / 3600)} hour(s)`,
              inline: true,
            },
          ],
        },
      ];

      if (isInserted || regenerateSecret) {
        embeds.push({
          title: "Webhook Secret",
          color: Colors.Yellow,
          description: [
            `Add the following configuration your bot on Top.gg to enable vote role rewards:`,
            "",
            "### Webhook URL",
            codeBlock(`https://vote-handler.lukez.workers.dev/topgg/${bot.id}`),
            "",
            "### Secret",
            codeBlock(generatedSecret),
          ].join("\n"),
          footer: {
            text: "Keep this secret safe! It will not be shown again.\nIf you lose it, you have to regenerate it.",
          },
        });
      }

      await ctx.editReply({
        embeds: embeds,
      });
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
      const configs = await db.select().from(applications).where(eq(applications.guildId, guildId));
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
