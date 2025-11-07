import { bold, codeBlock, ContainerBuilder, heading, ModalBuilder, StringSelectMenuOptionBuilder } from "@discordjs/builders";
import { and, count, eq } from "drizzle-orm";
import { APIEmbed, MessageFlags } from "discord-api-types/v10";
import { DrizzleDB, MyContext } from "../types";
import { ChatInputCommandInteraction } from "./discord/ChatInputInteraction";
import { applications, ApplicationCfg, forwardings, ForwardingCfg } from "./db/schema";
import { randomStringWithSnowflake, sanitizeSecret } from "./utils";
import dayjs from "dayjs";
import { Colors } from "./discord/colors";
import { makeDB } from "./db/util";
import { GetSupportedPlatform, PlatformWebhookUrl } from "./constants";
import { ForwardingPayload } from "../types/webhooks";

const MAX_APPS_PER_GUILD = 25;

export async function handleCommand(c: MyContext) {
  const ctx = c.get("command");
  console.log("Handling command:", ctx.commandName);
  try {
    switch (ctx.commandName) {
      case "ping":
        return ctx.reply({ content: "Pong!" }, true);
      case "app":
        return handleApp(c, ctx);
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

async function handleApp(c: MyContext, ctx: ChatInputCommandInteraction) {
  // base command: "app"
  const subgroup = ctx.options.getSubcommandGroup() as "forwarding" | null;
  const db = makeDB(c.env);

  if (subgroup === "forwarding") {
    return handleForwarding(c, ctx, db);
  }

  const subcommand = ctx.options.getSubcommand(true) as "list" | "add" | "edit" | "remove";
  console.log("Handling app subcommand:", subcommand);
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
    console.log("Showing remove app modal", { options: ctx.options.data });
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
            ss
              .setCustomId("source")
              .setOptions(
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
              )
              .setRequired(true),
          ),
        )
        .addLabelComponents((l) =>
          l.setLabel("Confirmation").setStringSelectMenuComponent((ss) =>
            ss.setCustomId("confirmation").setOptions(
              new StringSelectMenuOptionBuilder({
                label: `Remove ${bot.username} (${GetSupportedPlatform(source)})`.slice(0, 100),
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
      .select()
      .from(applications)
      .where(and(eq(applications.applicationId, bot.id)))
      .limit(1)
      .get();

    if (existingApp && existingApp.guildId === ctx.guildId && existingApp.source === source) {
      return ctx.editReply({ content: "This bot is already configured for this server for this source." });
    } else if (existingApp && existingApp.source === source && existingApp.guildId !== ctx.guildId) {
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
    } catch (error: any) {
      console.error("Error inserting app configuration into database:", error);
      return ctx.editReply({ content: error.message || "Failed to add app configuration. Please try again." });
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
    return ctx.editReply({
      content: "No existing configuration found for this bot in this guild for this source. Use `/config app add` to add it.",
    });
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
        heading("Webhook Data", 2),
        heading("Webhook Endpoint", 3),
        "-# Add the following webhook URL to your bot listing platform's webhook configuration.",
        codeBlock(PlatformWebhookUrl(cfg.source, cfg.applicationId)),
        heading("Webhook Secret", 3),
        "-# Add the following secret to your bot listing platform's webhook configuration.",
        codeBlock(cfg.secret),
        ":warning: **Keep this secret safe! It will not be shown again. If you lose it, you have to regenerate it.**",
      ].join("\n"),
      color: Colors.Yellow,
    });
  }

  return {
    embeds,
  };
}

async function handleForwarding(c: MyContext, ctx: ChatInputCommandInteraction, db: DrizzleDB) {
  const subcommand = ctx.options.getSubcommand(true) as "set" | "edit" | "remove" | "view";
  console.log("Handling forwarding subcommand:", subcommand);

  switch (subcommand) {
    case "set":
      return handleSetForwarding(ctx, db);
    case "edit":
      return handleEditForwarding(ctx, db);
    case "remove":
      return handleRemoveForwarding(ctx, db);
    case "view":
      return handleViewForwarding(ctx, db);
    default:
      return ctx.reply({ content: "Invalid forwarding subcommand." }, true);
  }
}

async function handleSetForwarding(ctx: ChatInputCommandInteraction, db: DrizzleDB) {
  await ctx.deferReply(true);

  console.log("Setting forwarding configuration");

  try {
    const bot = ctx.options.getUser("bot", true);
    if (!validateBot(bot, ctx.applicationId)) {
      return ctx.editReply({ content: "The selected user is not a bot." });
    }

    const source = ctx.options.getString<"topgg" | "dbl">("source", true);
    const targetUrl = ctx.options.getString("url", true);
    const forwardingSecret = ctx.options.getString("secret", true);
    const guildId = ctx.guildId!;

    // Validate URL format
    try {
      new URL(targetUrl);
    } catch {
      return ctx.editReply({ content: "Invalid URL format provided." });
    }

    // Check if app configuration exists
    const appConfig = await db
      .select()
      .from(applications)
      .where(and(eq(applications.applicationId, bot.id), eq(applications.source, source), eq(applications.guildId, guildId)))
      .get();

    if (!appConfig) {
      return ctx.editReply({
        content: `No app configuration found for <@${bot.id}> (${GetSupportedPlatform(
          source,
        )}).\nPlease add the app configuration first using \`/app add\`.`,
      });
    }

    // Check if forwarding already exists
    const existingForwarding = await db.select().from(forwardings).where(eq(forwardings.applicationId, bot.id)).get();

    if (existingForwarding) {
      return ctx.editReply({
        content: `Forwarding configuration already exists for <@${bot.id}> (${GetSupportedPlatform(
          source,
        )}).\nUse \`/app forwarding edit\` to modify it.`,
      });
    }

    // Testing the forwarding configuration
    const testError = await testForwarding(targetUrl, forwardingSecret);
    if (testError) {
      await ctx.editReply({
        content:
          "Failed to verify forwarding configuration:\n" +
          codeBlock(testError) +
          "\nPlease ensure the target URL is reachable and the secret is correct.",
      });
      return;
    }

    const newForwarding = await db
      .insert(forwardings)
      .values({
        applicationId: bot.id,
        targetUrl: targetUrl,
        secret: forwardingSecret,
      })
      .returning()
      .get();

    const embed: APIEmbed = {
      description: [
        heading(`Forwarding configuration created for <@${bot.id}>`, 3),
        `Successfully configured vote forwarding for ${bold(GetSupportedPlatform(source))}.`,
      ].join("\n"),
      color: Colors.Green,
      fields: [
        {
          name: "Target URL",
          value: codeBlock(newForwarding.targetUrl),
          inline: false,
        },
        {
          name: "Forwarding Secret",
          value: [codeBlock(newForwarding.secret), ":warning: **Keep this secret safe! It will not be shown again.**"].join("\n"),
          inline: false,
        },
      ],
    };

    return ctx.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error setting forwarding configuration:", error);
    return ctx.editReply({
      content: `Failed to set forwarding configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

/**
 * Tests the forwarding configuration by sending a test payload
 *
 * @returns An error message if the test fails, otherwise undefined
 */
async function testForwarding(url: string, secret: string): Promise<string | undefined> {
  console.log("Testing forwarding configuration");

  const result = await sendTestPayload(url, secret);
  if (!result.success) {
    return result.error;
  }
  return;
}

async function sendTestPayload(url: string, secret: string): Promise<{ success: boolean; error?: string }> {
  const payload: ForwardingPayload<"test"> = {
    source: "test",
    timestamp: dayjs().toISOString(),
    payload: null,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: secret,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 204) {
      return { success: true };
    }
    throw new Error(`Unexpected response status: ${response.status}`);
  } catch (error) {
    console.error("Error sending test payload:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function handleEditForwarding(ctx: ChatInputCommandInteraction, db: DrizzleDB) {
  await ctx.deferReply(true);

  console.log("Editing forwarding configuration");

  try {
    const bot = ctx.options.getUser("bot", true);
    if (!validateBot(bot, ctx.applicationId)) {
      return ctx.editReply({ content: "The selected user is not a bot." });
    }

    const source = ctx.options.getString<"topgg" | "dbl">("source", true);
    const targetUrl = ctx.options.getString("url");
    const regenerateSecret = ctx.options.getBoolean("generate-secret");

    if (!targetUrl && !regenerateSecret) {
      return ctx.editReply({ content: "Please provide either a new URL or request to regenerate the secret." });
    }

    // Validate URL format if provided
    if (targetUrl) {
      try {
        new URL(targetUrl);
      } catch {
        return ctx.editReply({ content: "Invalid URL format provided." });
      }
    }

    let updateFields: Partial<ForwardingCfg> = {};
    if (targetUrl) {
      updateFields.targetUrl = targetUrl;
    }
    if (regenerateSecret) {
      updateFields.secret = randomStringWithSnowflake(32);
    }

    const result = await db.update(forwardings).set(updateFields).where(eq(forwardings.applicationId, bot.id)).returning().get();

    if (!result) {
      return ctx.editReply({
        content: `No forwarding configuration found for <@${bot.id}> (${GetSupportedPlatform(
          source,
        )}).\nUse \`/app forwarding set\` to create one.`,
      });
    }

    const fields: APIEmbed["fields"] = [
      {
        name: "Target URL",
        value: codeBlock(result.targetUrl),
        inline: false,
      },
    ];

    if (regenerateSecret) {
      fields.push({
        name: "New Forwarding Secret",
        value: [codeBlock(result.secret), ":warning: **Keep this secret safe! It will not be shown again.**"].join("\n"),
        inline: false,
      });
    }

    const embed: APIEmbed = {
      description: [
        heading(`Forwarding configuration updated for <@${bot.id}>`, 3),
        `Successfully updated vote forwarding for ${bold(GetSupportedPlatform(source))}.`,
      ].join("\n"),
      color: Colors.Yellow,
      fields,
    };

    return ctx.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error editing forwarding configuration:", error);
    return ctx.editReply({
      content: `Failed to edit forwarding configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

async function handleRemoveForwarding(ctx: ChatInputCommandInteraction, db: DrizzleDB) {
  console.log("Showing remove forwarding modal");

  const bot = ctx.options.getUser("bot", true);
  const source = ctx.options.getString<"topgg" | "dbl">("source", true);

  return ctx.showModal(
    new ModalBuilder({
      title: "Remove Forwarding",
      custom_id: "remove_forwarding_modal",
    })
      .addLabelComponents((l) =>
        l.setLabel("Bot").setUserSelectMenuComponent((us) => us.setCustomId("bot").setDefaultUsers(bot.id).setRequired(true)),
      )
      .addLabelComponents((l) =>
        l.setLabel("Source").setStringSelectMenuComponent((ss) =>
          ss
            .setCustomId("source")
            .setOptions(
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
            )
            .setRequired(true),
        ),
      )
      .addLabelComponents((l) =>
        l.setLabel("Confirmation").setStringSelectMenuComponent((ss) =>
          ss.setCustomId("confirmation").setOptions(
            new StringSelectMenuOptionBuilder({
              label: `Remove forwarding for ${bot.username} (${GetSupportedPlatform(source)})`.slice(0, 100),
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
      .addTextDisplayComponents((t) => t.setContent("### :warning: This will remove the forwarding configuration!")),
  );
}

async function handleViewForwarding(ctx: ChatInputCommandInteraction, db: DrizzleDB) {
  await ctx.deferReply(true);

  console.log("Viewing forwarding configuration");

  try {
    const bot = ctx.options.getUser("bot");
    const source = ctx.options.getString<"topgg" | "dbl">("source");
    const guildId = ctx.guildId!;

    // If bot and source are specified, show specific forwarding
    if (bot && source) {
      if (!validateBot(bot, ctx.applicationId)) {
        return ctx.editReply({ content: "The selected user is not a bot." });
      }

      const forwarding = await db.select().from(forwardings).where(eq(forwardings.applicationId, bot.id)).get();

      if (!forwarding) {
        return ctx.editReply({
          content: `No forwarding configuration found for <@${bot.id}> (${GetSupportedPlatform(source)}).`,
        });
      }

      const embed: APIEmbed = {
        description: heading(`Forwarding configuration for <@${bot.id}>`, 3),
        color: Colors.Blurple,
        fields: [
          {
            name: "Source Platform",
            value: GetSupportedPlatform(source),
            inline: false,
          },
          {
            name: "Target URL",
            value: codeBlock(forwarding.targetUrl),
            inline: false,
          },
          {
            name: "Secret Status",
            value: "Secret is configured (hidden for security)",
            inline: false,
          },
        ],
      };

      return ctx.editReply({ embeds: [embed] });
    }

    // Otherwise, list all forwardings for this guild
    const appConfigs = await db.select().from(applications).where(eq(applications.guildId, guildId));

    if (appConfigs.length === 0) {
      return ctx.editReply({ content: "No apps configured for this guild." });
    }

    const forwardingConfigs = await db.select().from(forwardings);

    if (forwardingConfigs.length === 0) {
      return ctx.editReply({ content: "No forwarding configurations found." });
    }

    const container = new ContainerBuilder()
      .setAccentColor(Colors.Blurple)
      .addTextDisplayComponents((t) => t.setContent("## Forwarding Configurations"));

    forwardingConfigs.forEach((fwd) => {
      // Only show if the app belongs to this guild
      const appInGuild = appConfigs.find((app) => app.applicationId === fwd.applicationId);

      if (appInGuild) {
        container.addTextDisplayComponents((t) =>
          t.setContent(
            [`### <@${fwd.applicationId}>`, `- Target URL: \`${fwd.targetUrl}\``, `- Secret: ${sanitizeSecret(fwd.secret)}`, ""].join("\n"),
          ),
        );
      }
    });

    return ctx.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [container.toJSON()],
    });
  } catch (error) {
    console.error("Error viewing forwarding configuration:", error);
    return ctx.editReply({
      content: `Failed to view forwarding configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

// TODO: test new commands + update wiki pages + add wiki page for forwarding (must be a really detailed one)
