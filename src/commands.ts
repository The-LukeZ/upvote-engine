import { bold, codeBlock, ContainerBuilder, heading, ModalBuilder, StringSelectMenuOptionBuilder } from "@discordjs/builders";
import { and, count, eq } from "drizzle-orm";
import { APIContainerComponent, APIEmbed, MessageFlags } from "discord-api-types/v10";
import { DrizzleDB, MyContext } from "../types";
import { ChatInputCommandInteraction } from "./discord/ChatInputInteraction";
import { applications, ApplicationCfg } from "./db/schema";
import { randomStringWithSnowflake } from "./utils";
import dayjs from "dayjs";
import { Colors } from "./discord/colors";
import { makeDB } from "./db/util";
import { PlatformWebhookUrl, GetSupportedPlatform } from "./constants";

const MAX_APPS_PER_GUILD = 25;

export async function handleCommand(c: MyContext) {
  const ctx = c.get("command");
  console.log("Handling command:", ctx.commandName);
  try {
    switch (ctx.commandName) {
      case "ping":
        return ctx.reply({ content: "Pong!" }, true);
      case "config":
        return handleConfig(c, ctx);
      default:
        return ctx.reply({ content: `Unknown command: ${ctx.commandName}` }, true);
    }
  } catch (error) {
    console.error("Error handling command:", error);
    return ctx.reply(
      { content: `An error occurred while processing the command: ${error instanceof Error ? error.message : "Unknown error"}` },
      true,
    );
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
    const source = ctx.options.getString<"topgg" | "dbl">("source", true);
    return ctx.showModal(
      new ModalBuilder({
        title: "Remove App",
        custom_id: "remove_app_modal",
      })
        .addLabelComponents((l) =>
          l.setLabel("Bot").setUserSelectMenuComponent((us) => us.setCustomId("bot").setDefaultUsers(bot.id).setRequired(true)),
        )
        .addLabelComponents((l) =>
          l.setLabel("Source").setStringSelectMenuComponent((ss) =>
            ss.setCustomId("source").setOptions(
              new StringSelectMenuOptionBuilder({
                label: GetSupportedPlatform("topgg"),
                value: "topgg",
                default: source === "topgg",
              }),
              new StringSelectMenuOptionBuilder({
                label: GetSupportedPlatform("dbl"),
                value: "dbl",
                default: source === "dbl",
              }),
            ).setRequired(true),
          ),
        )
        .addLabelComponents((l) =>
          l
            .setLabel("Confirmation")
            .setDescription(`Type "remove ${bot.username} (${GetSupportedPlatform(source)})" to confirm removal of this app configuration.`)
            .setStringSelectMenuComponent((ss) =>
              ss.setCustomId("confirmation").setOptions(
                new StringSelectMenuOptionBuilder({
                  label: `Remove ${bot.username} (${GetSupportedPlatform(source)})`,
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
                  default: true,
                }),
              ),
            ),
        )
        .addTextDisplayComponents((t) =>
          t.setContent("### :warning: This will remove the app configuration __and__ all associated votes!"),
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

    const container = new ContainerBuilder()
      .setAccentColor(Colors.Blurple)
      .addTextDisplayComponents((t) => t.setContent("## Configured Apps"));

    configs.forEach((cfg) => {
      const durationText = cfg.roleDurationSeconds ? `${Math.floor(cfg.roleDurationSeconds / 3600)} hour(s)` : "Permanent";
      container.addTextDisplayComponents((t) =>
        t.setContent(
          [
            `### <@${cfg.applicationId}> (${GetSupportedPlatform(cfg.source)})`,
            `- Vote Role: <@&${cfg.voteRoleId}>`,
            `- Role Duration: ${durationText}`,
            `- Created At: <t:${dayjs(cfg.createdAt).unix()}>`,
            "",
          ].join("\n"),
        ),
      );
    });
    return ctx.reply(
      {
        flags: MessageFlags.IsComponentsV2,
        components: [container.toJSON()],
      },
      true,
    );
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

    const source = ctx.options.getString<"topgg" | "dbl">("source", true);

    const existingApp = await db
      .select({ guildId: applications.guildId })
      .from(applications)
      .where(and(eq(applications.applicationId, bot.id), eq(applications.source, source)))
      .limit(1)
      .get();

    if (existingApp && existingApp.guildId === ctx.guildId) {
      return ctx.editReply({ content: "This bot is already configured for this server for this source." });
    } else if (existingApp) {
      return ctx.editReply({ content: "This bot is already configured for another server for this source." });
    }

    const role = ctx.options.getRole("role", true);
    const roleId = role.id;

    const durationHours = ctx.options.getInteger("duration");
    const durationSeconds = durationHours ? Math.max(durationHours * 3600, 3600) : null; // Minimum of 1 hour
    const guildId = ctx.guildId;
    console.log("Extracted parameters:", { bot, roleId, durationSeconds, guildId });

    if (!guildId) {
      return ctx.editReply({ content: "This command can only be used in a server." });
    }

    // Check if a config for the bot already exists

    const generatedSecret = randomStringWithSnowflake(32);

    let newCfg: ApplicationCfg | undefined;
    try {
      newCfg = await db
        .insert(applications)
        .values({
          applicationId: bot.id,
          source: source,
          guildId: guildId,
          voteRoleId: roleId,
          roleDurationSeconds: durationSeconds ? durationSeconds : null,
          secret: generatedSecret,
        })
        .onConflictDoNothing()
        .returning()
        .get();

      if (!newCfg) {
        return ctx.editReply({ content: "This bot is already configured for this server for this source." });
      }
    } catch (error) {
      console.error("Error inserting app configuration into database:", error);
      return ctx.editReply({ content: "Failed to add app configuration. Please try again." });
    }

    await ctx.editReply(buildAppInfo(newCfg, "create"));
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

  console.log("Editing app configuration for guild");

  const bot = ctx.options.getUser("bot", true);
  if (!validateBot(bot, ctx.applicationId)) {
    return ctx.editReply({ content: "The selected user is not a bot." });
  }

  const source = ctx.options.getString<"topgg" | "dbl">("source", true);
  const role = ctx.options.getRole("role");
  const roleId = role?.id;

  const durationHours = ctx.options.getInteger("duration");
  const durationSeconds = durationHours ? Math.max(durationHours * 3600, 3600) : null;
  const guildId = ctx.guildId;
  console.log("Extracted parameters:", { bot, roleId, durationSeconds, guildId });

  if (!guildId) {
    return ctx.editReply({ content: "This command can only be used in a server." });
  }

  let newSecret: string | undefined = undefined;
  let updateFields: Partial<ApplicationCfg> = {};
  if (roleId) {
    updateFields.voteRoleId = roleId;
  }
  if (durationSeconds) {
    updateFields.roleDurationSeconds = durationSeconds;
  }
  if (!!ctx.options.getBoolean("generate-secret")) {
    newSecret = randomStringWithSnowflake(32);
    updateFields.secret = newSecret;
  }

  const result = await db
    .update(applications)
    .set(updateFields)
    .where(and(eq(applications.guildId, guildId), eq(applications.applicationId, bot.id), eq(applications.source, source)))
    .returning()
    .get();

  if (!result) {
    return ctx.editReply({ content: "No existing configuration found for this bot in this guild for this source. Use `/config app add` to add it." });
  }

  await ctx.editReply(buildAppInfo(result, "edit", !!newSecret));
  console.log("Guild configuration updated in database");
}

function validateBot(bot: object & { bot?: boolean; id: string }, ownApplicationId: string): boolean {
  return !!(bot.bot && bot.id !== ownApplicationId);
}

function buildAppInfo(
  cfg: ApplicationCfg,
  action: "edit" | "create",
  secretVisible: boolean = action === "create" ? true : false,
): { embeds: APIEmbed[] } {
  const durationText = cfg.roleDurationSeconds ? `${Math.floor(cfg.roleDurationSeconds / 3600)} hour(s)` : "Permanent";
  const fields = [
    {
      name: "Vote Role",
      value: `<@&${cfg.voteRoleId}>`,
      inline: false,
    },
    {
      name: "Role Duration",
      value: durationText,
      inline: false,
    },
    {
      name: "Created At",
      value: `<t:${dayjs(cfg.createdAt).unix()}>`,
      inline: false,
    },
  ];

  const embeds: APIEmbed[] = [
    {
      description: [
        heading(`Configuration ${action === "create" ? "created" : "updated"} for bot <@${cfg.applicationId}>:`, 3),
        `Successfully updated configuration for bot <@${cfg.applicationId}> in this server for source ${bold(
          GetSupportedPlatform(cfg.source),
        )}.`,
      ].join("\n"),
      color: action === "create" ? Colors.Green : Colors.Yellow,
      fields: fields,
    },
  ];

  if (secretVisible) {
    embeds.push({
      description: [
        `${heading("New Webhook Secret", 3)}`,
        `${codeBlock(cfg.secret)}`,
        ":warning: **Keep this secret safe! It will not be shown again. If you lose it, you have to regenerate it.**",
      ].join("\n"),
      color: Colors.Yellow,
    });
  }

  return {
    embeds,
  };
}
