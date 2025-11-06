import { codeBlock, ModalBuilder, StringSelectMenuOptionBuilder } from "@discordjs/builders";
import { and, count, eq } from "drizzle-orm";
import { APIEmbed } from "discord-api-types/v10";
import { DrizzleDB, MyContext } from "../types";
import { ChatInputCommandInteraction } from "./discord/ChatInputInteraction";
import { applications, ApplicationCfg } from "./db/schema";
import { randomStringWithSnowflake } from "./utils";
import dayjs from "dayjs";
import { Colors } from "./discord/colors";
import { makeDB } from "./db/util";

const MAX_APPS_PER_GUILD = 25;

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
  const subcommand = ctx.options.getSubcommand(true) as "list" | "add" | "edit" | "remove";
  const db = makeDB(c.env);

  console.log("Handling config subcommand:", subcommand);
  if (subcommand === "add") {
    return handleAddApp(ctx, db);
  }
  if (subcommand === "edit") {
    return handleEditApp(ctx, db);
  }

  if (subcommand === "list") {
    return handleListApps(ctx, db);
  }

  if (subcommand === "remove") {
    const bot = ctx.options.getUser("bot", true);
    return ctx.showModal(
      new ModalBuilder({
        title: "Remove App",
        custom_id: "remove_app_modal",
      })
        .addLabelComponents((l) =>
          l
            .setLabel("Bot")
            .setDescription("Bot to remove")
            .setUserSelectMenuComponent((us) => us.setCustomId("bot").setDisabled(true).setDefaultUsers(bot.id).setRequired(true)),
        )
        .addLabelComponents((l) =>
          l
            .setLabel("Confirmation")
            .setDescription(`Type "remove ${bot.username}" to confirm removal of this app configuration.`)
            .setStringSelectMenuComponent((ss) =>
              ss.setCustomId("confirmation").setOptions(
                new StringSelectMenuOptionBuilder({
                  label: `Remove ${bot.global_name}`,
                  emoji: {
                    name: "🗑️",
                  },
                  value: "1",
                }),
                new StringSelectMenuOptionBuilder({
                  label: "Cancel",
                  emoji: {
                    name: "🚫",
                  },
                  value: "0",
                }),
              ),
            ),
        ),
    );
  }

  return ctx.reply({ content: "Invalid subcommand." }, true);
}

async function handleListApps(ctx: ChatInputCommandInteraction, db: DrizzleDB) {
  console.log("Listing configured apps for guild");
  const guildId = ctx.guildId!;
  try {
    const configs = await db.select().from(applications).where(eq(applications.guildId, guildId));
    if (configs.length === 0) {
      return ctx.reply({ content: "No apps configured for this guild." }, true);
    }

    const embed: APIEmbed = {
      title: "Configured Apps",
      color: Colors.Blurple,
      fields: configs.map((cfg) => ({
        name: `<@${cfg.applicationId}>`,
        value: [
          `- Vote Role: <@&${cfg.voteRoleId}>`,
          `- Role Duration: ${Math.floor(cfg.roleDurationSeconds / 3600)} hour(s)`,
          `- Created At: ${dayjs(cfg.createdAt).format("YYYY-MM-DD HH:mm:ss")}`,
        ].join("\n"),
      })),
    };
    return ctx.reply({ embeds: [embed] }, true);
  } catch (error) {
    console.error("Error listing configurations:", error);
    return ctx.reply({ content: "Failed to list configurations. Please try again." }, true);
  }
}

async function handleAddApp(ctx: ChatInputCommandInteraction, db: DrizzleDB) {
  await ctx.deferReply(true);

  console.log("Adding app to guild configuration");

  try {
    const bot = ctx.options.getUser("bot", true);
    if (!validateBot(bot, ctx.applicationId)) {
      return ctx.editReply({ content: "The selected user is not a bot." });
    }

    // check if already 25 apps are configured for this guild
    const guildAppCount = await db.select({ count: count() }).from(applications).where(eq(applications.guildId, ctx.guildId!)).get();
    if (guildAppCount && guildAppCount.count >= MAX_APPS_PER_GUILD) {
      return ctx.editReply({
        content: `This guild has reached the maximum number of configured apps (${MAX_APPS_PER_GUILD}).\nYou can't add any more applications.`,
      });
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

    const generatedSecret = randomStringWithSnowflake(32);

    try {
      await db
        .insert(applications)
        .values({
          guildId: guildId,
          applicationId: bot.id,
          voteRoleId: roleId,
          roleDurationSeconds: durationSeconds,
          secret: generatedSecret,
        })
        .returning()
        .get();
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        return ctx.editReply({ content: "This bot is already configured for this guild." });
      }
      throw error;
    }

    const embeds: APIEmbed[] = [
      {
        title: "App Configured",
        color: Colors.Green,
        description: `Successfully added configuration for bot <@${bot.id}> in this server.`,
        fields: [
          {
            name: "Vote Role",
            value: `<@&${roleId}>\n-# :warning: **Make sure I have permission to assign this role and am above it in the role hierarchy!**`,
            inline: false,
          },
          {
            name: "Role Duration",
            value: `${Math.floor(durationSeconds / 3600)} hour(s)`,
            inline: false,
          },
        ],
      },
      {
        title: "Webhook Secret",
        color: Colors.Yellow,
        description: [
          `Add the following configuration to your bot on Top.gg to enable vote role rewards:`,
          "### Webhook URL",
          codeBlock(`https://vote-handler.lukez.workers.dev/topgg/${bot.id}`),
          "### Secret",
          codeBlock(generatedSecret),
          "",
          ":warning: **Keep this secret safe! It will not be shown again. If you lose it, you have to regenerate it.**",
        ].join("\n"),
      },
    ];

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

async function handleEditApp(ctx: ChatInputCommandInteraction, db: DrizzleDB) {
  console.log("Deferring reply for edit subcommand");
  await ctx.deferReply(true);

  try {
    console.log("Editing app configuration for guild");

    const bot = ctx.options.getUser("bot", true);
    if (!validateBot(bot, ctx.applicationId)) {
      return ctx.editReply({ content: "The selected user is not a bot." });
    }

    const role = ctx.options.getRole("role", true);
    const roleId = role.id;

    const durationHours = ctx.options.getInteger("duration", true);
    const durationSeconds = Math.min(durationHours * 3600, 3600);
    const guildId = ctx.guildId;
    console.log("Extracted parameters:", { bot, roleId, durationSeconds, guildId });

    if (!guildId) {
      return ctx.editReply({ content: "This command can only be used in a server." });
    }

    let newSecret: string | undefined = undefined;
    let updateFields: Partial<ApplicationCfg> = {
      voteRoleId: roleId,
      roleDurationSeconds: durationSeconds,
    };
    if (!!ctx.options.getBoolean("generate-secret", true)) {
      newSecret = randomStringWithSnowflake(32);
      updateFields.secret = newSecret;
    }

    const result: ApplicationCfg[] = await db
      .update(applications)
      .set(updateFields)
      .where(and(eq(applications.guildId, guildId), eq(applications.applicationId, bot.id)))
      .returning();

    if (result.length === 0) {
      return ctx.editReply({ content: "No existing configuration found for this bot in this guild. Use `/config app add` to add it." });
    }

    const embeds: APIEmbed[] = [
      {
        title: "App Configuration Updated",
        color: Colors.Green,
        description: `Successfully updated configuration for bot <@${bot.id}> in this server.`,
        fields: [
          {
            name: "Vote Role",
            value: `<@&${roleId}>\n-# :warning: **Make sure I have permission to assign this role and am above it in the role hierarchy!**`,
            inline: false,
          },
          {
            name: "Role Duration",
            value: `${Math.floor(durationSeconds / 3600)} hour(s)`,
            inline: false,
          },
        ],
      },
    ];

    if (newSecret) {
      embeds.push({
        title: "New Webhook Secret",
        color: Colors.Yellow,
        description: [
          `A new secret has been generated for your bot. Update your Top.gg webhook configuration with the following secret:`,
          codeBlock(newSecret),
          "",
          ":warning: **Keep this secret safe! It will not be shown again. If you lose it, you have to regenerate it.**",
        ].join("\n"),
      });
    }

    await ctx.editReply({
      embeds: embeds,
    });
    console.log("Guild configuration updated in database");
  } catch (error) {
    console.error("Error in handleEditApp:", error);
    return ctx.editReply({ content: `Failed to edit app configuration: ${error instanceof Error ? error.message : "Unknown error"}` });
  }
}

function validateBot(bot: object & { bot?: boolean; id: string }, ownApplicationId: string): boolean {
  return !!(bot.bot && bot.id !== ownApplicationId);
}
