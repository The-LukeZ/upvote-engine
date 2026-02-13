import { bold, codeBlock, heading } from "@discordjs/builders";
import { and, count, eq } from "drizzle-orm";
import { APIEmbed, APIUser, ApplicationCommandOptionType, MessageFlags } from "discord-api-types/v10";
import { DrizzleDB, MyContext } from "../../../../types";
import {
  applications,
  ApplicationCfg,
  forwardings,
  ForwardingCfg,
  isUserVerifiedForApplication,
  integrations,
  Integration,
} from "../../../db/schema";
import { sanitizeSecret } from "../../../utils";
import dayjs from "dayjs";
import {
  GetSupportedPlatform,
  getTestNoticeForPlatform,
  hostnamePattern,
  platformsWithTests,
  supportedPlatforms,
} from "../../../constants";
import { ForwardingPayload } from "../../../../types/webhooks";
import { ChatInputCommandInteraction, Colors, ContainerBuilder, ModalBuilder, StringSelectMenuOptionBuilder } from "honocord";
import { appCommand as appCommandData } from "./integrationsCommandData";

const MAX_APPS_PER_GUILD = 25;

async function validateBot(bot: APIUser, ownApplicationId: string, byOwner: boolean): Promise<boolean> {
  return !!bot.bot && (byOwner || bot.id !== ownApplicationId);
}

export const appCommand = appCommandData.addHandler(async function handleApp(ctx: ChatInputCommandInteraction<MyContext>) {
  const subgroup = ctx.options.getSubcommandGroup() as "forwarding" | null;
  const db = ctx.context.get("db");

  if (subgroup === "forwarding") {
    return handleForwarding(ctx.context, ctx, db);
  }

  const subcommand = ctx.options.getSubcommand(true) as "list" | "create" | "edit" | "remove";

  const blCache = ctx.context.env.BLACKLIST.getByName("blacklist");
  const botOption = ctx.options.get("bot", ApplicationCommandOptionType.User, false);
  if (botOption?.value) {
    const isBlBot = await blCache.isBlacklisted(botOption?.value, "b");
    if (isBlBot) {
      return ctx.reply({ content: "The selected bot cannot be configured, because it is blacklisted." }, true);
    }
  }

  if (subcommand === "create") {
    return handleCreateIntegration(ctx, db);
  }

  if (subcommand === "edit") {
    return handleEditIntegration(ctx, db);
  }

  if (subcommand === "list") {
    return handleListIntegrations(ctx, db);
  }

  if (subcommand === "remove") {
    console.log("Showing remove app modal", { options: ctx.options.data });
    const bot = ctx.options.getUser("bot", true);
    const source = ctx.options.getString<"topgg" | "dbl">("source", true);

    return ctx.showModal(
      new ModalBuilder({
        title: "Remove App",
        custom_id: "remove_integration_modal",
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
});

async function checkIntegrationAuthorization(
  db: DrizzleDB,
  applicationId: string,
  source: keyof typeof supportedPlatforms,
  guildId: string,
  userId: string,
  isOwner: boolean,
): Promise<{ authorized: boolean; integration?: typeof integrations.$inferSelect; message?: string }> {
  let isIntegrationOwner = false;
  let integration: Integration | undefined;
  if (source === "topgg") {
    // Check if integration exists
    integration = await db.select().from(integrations).where(eq(integrations.applicationId, applicationId)).limit(1).get();

    if (!integration) {
      return {
        authorized: false,
        message:
          "No integration found for this bot. The bot owner must first connect the UpvoteEngine integration on Top.gg.\n" +
          `Visit the [Integrations Page](https://top.gg/bot/${applicationId}/dashboard/integrations) and click **Connect** on the UpvoteEngine integration.`,
      };
    }
    isIntegrationOwner = integration.userId === userId;
  }

  // Check if user is authorized (integration creator or verified owner)
  if (!isOwner && !isIntegrationOwner) {
    const isVerified = await isUserVerifiedForApplication(db, applicationId, guildId, userId);
    if (!isVerified) {
      return {
        authorized: false,
        message:
          "You are not authorized to configure this bot. Only the integration creator or verified owners can configure this bot.\n" +
          `Use \`/verify-app-ownership\` to verify your ownership of <@${applicationId}>.`,
      };
    }
  }

  return { authorized: true, integration };
}

async function handleListIntegrations(ctx: ChatInputCommandInteraction<MyContext>, db: DrizzleDB) {
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
        components: [container as any],
      },
      true,
    );
  } catch (error) {
    console.error("Error listing configurations:", error);
    return ctx.reply({ content: "Failed to list configurations. Please try again." }, true);
  }
}

async function handleCreateIntegration(ctx: ChatInputCommandInteraction, db: DrizzleDB) {
  await ctx.deferReply(true);

  const bot = ctx.options.getUser("bot", true);
  if (!(await validateBot(bot, ctx.applicationId, ctx.context.env.OWNER_ID === ctx.user.id))) {
    return ctx.editReply({ content: "The selected user is not a bot." });
  }

  const isOwner = ctx.context.env.OWNER_ID === ctx.user.id;
  const guildId = ctx.guildId!;
  const source = ctx.options.getString<"topgg" | "dbl">("source", true);

  // For topgg, check if integration exists and show notice
  if (source === "topgg") {
    const integration = await db.select().from(integrations).where(eq(integrations.applicationId, bot.id)).limit(1).get();

    if (!integration) {
      return ctx.editReply({
        content:
          "No integration found for this bot. The bot owner must first connect the UpvoteEngine integration on Top.gg.\n\n" +
          `**Steps to set up the integration:**\n` +
          `1. Visit the [Integrations Page](https://top.gg/bot/${bot.id}/dashboard/integrations)\n` +
          `2. Click **Connect** on the UpvoteEngine integration\n` +
          `3. Once connected, come back and use \`/app edit\` to configure the integration for this server`,
        flags: MessageFlags.SuppressEmbeds,
      });
    }

    // Integration exists, show notice to use edit instead
    return ctx.editReply(
      `An integration already exists for <@${bot.id}>.\n\n` + `Please use \`/app edit\` to configure the bot for this server.`,
    );
  }

  // For non-topgg sources (like dbl), create the configuration directly
  const role = ctx.options.getRole("role");
  const roleId = role?.id;

  const durationHours = ctx.options.getInteger("duration");
  const durationSeconds = durationHours ? Math.max(durationHours * 3600, 3600) : null;

  if (!roleId) {
    return ctx.editReply({ content: "Please provide a role to assign on vote." });
  }

  console.log("Creating app configuration:", { bot: bot.id, source, roleId, durationSeconds, guildId });

  // Check if configuration already exists
  const existing = await db
    .select()
    .from(applications)
    .where(and(eq(applications.applicationId, bot.id), eq(applications.source, source), eq(applications.guildId, guildId)))
    .limit(1)
    .get();

  if (existing) {
    return ctx.editReply({
      content: `A configuration already exists for <@${bot.id}> (${GetSupportedPlatform(source)}) in this guild.\nUse \`/app edit\` to modify it.`,
    });
  }

  // Check guild app limit
  const guildAppCount = await db.select({ count: count() }).from(applications).where(eq(applications.guildId, guildId)).get();

  if (guildAppCount && guildAppCount.count >= MAX_APPS_PER_GUILD) {
    return ctx.editReply({
      content: `This guild has reached the maximum limit of ${MAX_APPS_PER_GUILD} app configurations.`,
    });
  }

  // Create the configuration
  const newConfig = await db
    .insert(applications)
    .values({
      applicationId: bot.id,
      source: source,
      guildId: guildId,
      voteRoleId: roleId,
      roleDurationSeconds: durationSeconds,
    })
    .returning()
    .get();

  await ctx.editReply(buildIntegrationInfo(ctx.applicationId, newConfig, "create"));
  console.log("App configuration created in database");
}

async function handleEditIntegration(ctx: ChatInputCommandInteraction, db: DrizzleDB) {
  await ctx.deferReply(true);

  const bot = ctx.options.getUser("bot", true);
  if (!(await validateBot(bot, ctx.applicationId, ctx.context.env.OWNER_ID === ctx.user.id))) {
    return ctx.editReply({ content: "The selected user is not a bot." });
  }

  const isOwner = ctx.context.env.OWNER_ID === ctx.user.id;
  const guildId = ctx.guildId!;
  const source = ctx.options.getString<"topgg" | "dbl">("source", true);

  // For topgg, check integration authorization
  if (source === "topgg") {
    const authCheck = await checkIntegrationAuthorization(db, bot.id, source, guildId, ctx.user.id, isOwner);
    if (!authCheck.authorized) {
      return ctx.editReply({ content: authCheck.message, flags: MessageFlags.SuppressEmbeds });
    }
  }
  const role = ctx.options.getRole("role");
  const roleId = role?.id;

  const durationHours = ctx.options.getInteger("duration");
  const durationSeconds = durationHours ? Math.max(durationHours * 3600, 3600) : null;

  console.log("Extracted parameters:", { bot, roleId, durationSeconds, guildId });

  if (!roleId && durationSeconds === null) {
    return ctx.editReply({ content: "Please provide at least one field to update." });
  }

  let updateFields: Partial<ApplicationCfg> = {};
  if (roleId) {
    updateFields.voteRoleId = roleId;
  }
  if (durationSeconds !== null) {
    updateFields.roleDurationSeconds = durationSeconds;
  }

  const result = await db
    .update(applications)
    .set(updateFields)
    .where(and(eq(applications.guildId, guildId), eq(applications.applicationId, bot.id), eq(applications.source, source)))
    .returning()
    .get();

  if (!result) {
    return ctx.editReply({
      content: "No existing configuration found for this bot in this guild for this source. Use `/app create` to add it.",
    });
  }

  await ctx.editReply(buildIntegrationInfo(ctx.applicationId, result, "edit"));
  console.log("Guild configuration updated in database");
}

function buildIntegrationInfo(clientId: string, cfg: ApplicationCfg, action: "edit" | "create"): { embeds: APIEmbed[] } {
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

  if (platformsWithTests.includes(cfg.source)) {
    fields.push({
      name: "Test Vote Notice",
      value: getTestNoticeForPlatform(cfg.source, clientId),
      inline: false,
    });
  }

  const embed: APIEmbed = {
    description: [
      heading(`Configuration ${action === "create" ? "created" : "updated"} for bot <@${cfg.applicationId}>`, 3),
      `Successfully ${action === "create" ? "configured" : "updated"} <@${cfg.applicationId}> in this server for ${bold(
        GetSupportedPlatform(cfg.source),
      )}.`,
      "",
      action === "create"
        ? ":white_check_mark: The bot is now ready to receive vote webhooks. Votes will automatically grant the configured role."
        : ":white_check_mark: Configuration updated successfully.",
    ].join("\n"),
    color: action === "create" ? Colors.Green : Colors.Yellow,
    fields: fields,
  };

  return {
    embeds: [embed],
  };
}

async function handleForwarding(c: MyContext, ctx: ChatInputCommandInteraction, db: DrizzleDB) {
  const subcommand = ctx.options.getSubcommand(true) as "set" | "edit" | "remove" | "view";
  console.log("Handling forwarding subcommand:", subcommand);

  const urlOrigin = new URL(c.req.url).origin;
  const urlOption = ctx.options.getString("url");
  if (urlOption && !isValidForwardingUrl(urlOrigin, urlOption)) {
    return ctx.reply(
      {
        content:
          "The provided URL is not valid for forwarding.\n" +
          "Please ensure it is a valid URL and not pointing to localhost, an IP address, or this service's own domain.",
      },
      true,
    );
  }

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

  try {
    const bot = ctx.options.getUser("bot", true);
    if (!(await validateBot(bot, ctx.applicationId, ctx.context.env.OWNER_ID === ctx.user.id))) {
      return ctx.editReply("The selected user is not a bot.");
    }

    const isOwner = ctx.context.env.OWNER_ID === ctx.user.id;
    const guildId = ctx.guildId!;

    const appCfg = await db.select({ source: applications.source }).from(applications).where(eq(applications.applicationId, bot.id)).get();
    const source = appCfg?.source;

    if (!source) {
      return ctx.editReply(
        "No existing configuration found for this bot in this guild. Use `/app create` to add it before setting up forwarding.",
      );
    }

    // Check integration authorization
    const authCheck = await checkIntegrationAuthorization(db, bot.id, source, guildId, ctx.user.id, isOwner);
    if (!authCheck.authorized) {
      return ctx.editReply({ content: authCheck.message, flags: MessageFlags.SuppressEmbeds });
    }

    const targetUrl = ctx.options.getString("url", true);
    const forwardingSecret = ctx.options.getString("secret", true);

    // Validate URL format
    try {
      new URL(targetUrl);
    } catch {
      return ctx.editReply({ content: "Invalid URL format provided." });
    }

    // Check if app configuration exists
    const appConfig = await db
      .select({ count: count() })
      .from(applications)
      .where(and(eq(applications.applicationId, bot.id), eq(applications.guildId, guildId)))
      .get();

    if (!appConfig || appConfig.count === 0) {
      return ctx.editReply({
        content: `No app configuration found for <@${bot.id}>.\nPlease configure the app first using \`/app create\`.`,
      });
    }

    // Check if forwarding already exists
    const existingForwarding = await db.select().from(forwardings).where(eq(forwardings.applicationId, bot.id)).get();

    if (existingForwarding) {
      return ctx.editReply({
        content: `Forwarding configuration already exists for <@${bot.id}>\nUse \`/app forwarding edit\` to modify it.`,
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
      description: heading(`Forwarding configuration created for <@${bot.id}>`, 3),
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
    if (!(await validateBot(bot, ctx.applicationId, ctx.context.env.OWNER_ID === ctx.user.id))) {
      return ctx.editReply({ content: "The selected user is not a bot." });
    }

    const isOwner = ctx.context.env.OWNER_ID === ctx.user.id;
    const guildId = ctx.guildId!;

    const appCfg = await db.select({ source: applications.source }).from(applications).where(eq(applications.applicationId, bot.id)).get();
    const source = appCfg?.source;

    if (!source) {
      return ctx.editReply(
        "No existing configuration found for this bot in this guild. Use `/app create` to add it before setting up forwarding.",
      );
    }

    // Check integration authorization
    const authCheck = await checkIntegrationAuthorization(db, bot.id, source, guildId, ctx.user.id, isOwner);
    if (!authCheck.authorized) {
      return ctx.editReply({ content: authCheck.message, flags: MessageFlags.SuppressEmbeds });
    }

    const targetUrl = ctx.options.getString("url");
    const newSecret = ctx.options.getString("secret");

    if (!targetUrl && !newSecret) {
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
    if (newSecret) {
      updateFields.secret = newSecret;
    }

    const result = await db.update(forwardings).set(updateFields).where(eq(forwardings.applicationId, bot.id)).returning().get();

    if (!result) {
      return ctx.editReply({
        content: `No forwarding configuration found for <@${bot.id}>.\nUse \`/app forwarding set\` to create one.`,
      });
    }

    const fields: APIEmbed["fields"] = [
      {
        name: "Target URL",
        value: codeBlock(result.targetUrl),
        inline: false,
      },
    ];

    if (newSecret) {
      fields.push({
        name: "New Forwarding Secret",
        value: [codeBlock(result.secret), ":warning: **Keep this secret safe! It will not be shown again.**"].join("\n"),
        inline: false,
      });
    }

    const embed: APIEmbed = {
      description: heading(`Forwarding configuration updated for <@${bot.id}>`, 3),
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

  return ctx.showModal(
    new ModalBuilder({
      title: "Remove Forwarding",
      custom_id: "remove_forwarding_modal",
    })
      .addLabelComponents((l) =>
        l.setLabel("Bot").setUserSelectMenuComponent((us) => us.setCustomId("bot").setDefaultUsers(bot.id).setRequired(true)),
      )
      .addLabelComponents((l) =>
        l.setLabel("Confirmation").setStringSelectMenuComponent((ss) =>
          ss.setCustomId("confirmation").setOptions(
            new StringSelectMenuOptionBuilder({
              label: `Remove forwarding for ${bot.username}`.slice(0, 100),
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
    const bot = ctx.options.getUser("bot", true);
    const guildId = ctx.guildId!;

    // If bot is specified, show specific forwarding
    if (!(await validateBot(bot, ctx.applicationId, ctx.context.env.OWNER_ID === ctx.user.id))) {
      return ctx.editReply({ content: "The selected user is not a bot." });
    }

    const forwarding = await db.select().from(forwardings).where(eq(forwardings.applicationId, bot.id)).get();

    if (!forwarding) {
      return ctx.editReply({
        content: `No forwarding configuration found for <@${bot.id}>.`,
      });
    }

    const embed: APIEmbed = {
      description: heading(`Forwarding configuration for <@${bot.id}>`, 3),
      color: Colors.Blurple,
      fields: [
        {
          name: "Target URL",
          value: codeBlock(forwarding.targetUrl),
          inline: false,
        },
        {
          name: "Secret Status",
          value: codeBlock(sanitizeSecret(forwarding.secret)),
          inline: false,
        },
      ],
    };

    return ctx.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error viewing forwarding configuration:", error);
    return ctx.editReply({
      content: `Failed to view forwarding configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

function isValidForwardingUrl(currentOrigin: string, url: string): boolean {
  // 1. Is it even a url?
  try {
    const _url = new URL(url);
    // 2. Do NOT allow localhost, ips and not the current origin
    if (_url.origin === currentOrigin) {
      return false;
    } else if (_url.hostname === "localhost" || _url.hostname === "127.0.0.1" || _url.hostname === "::1") {
      return false;
    } else if (!hostnamePattern.test(_url.hostname)) {
      return false;
    }
  } catch {
    return false;
  }
  return true;
}
