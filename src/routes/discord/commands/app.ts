import { bold, codeBlock, heading } from "@discordjs/builders";
import { and, count, eq } from "drizzle-orm";
import { APIEmbed, APIUser, ApplicationCommandOptionType, MessageFlags } from "discord-api-types/v10";
import { DrizzleDB, MyContext } from "../../../../types";
import { applications, ApplicationCfg, forwardings, ForwardingCfg, verifications, isUserVerifiedForApplication } from "../../../db/schema";
import { getAuthorizeUrlForOwnershipVerify, randomStringWithSnowflake, sanitizeSecret } from "../../../utils";
import dayjs from "dayjs";
import {
  GetSupportedPlatform,
  getTestNoticeForPlatform,
  hostnamePattern,
  platformsWithTests,
  PlatformWebhookUrl,
} from "../../../constants";
import { ForwardingPayload } from "../../../../types/webhooks";
import {
  ChatInputCommandInteraction,
  Colors,
  ActionRowBuilder,
  ButtonBuilder,
  ContainerBuilder,
  ModalBuilder,
  StringSelectMenuOptionBuilder,
} from "honocord";
import { appCommand as appCommandData } from "./appCommandData";

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

  const subcommand = ctx.options.getSubcommand(true) as "list" | "add" | "edit" | "remove" | "ownership-verify";

  const blCache = ctx.context.env.BLACKLIST.getByName("blacklist");
  const botOption = ctx.options.get("bot", ApplicationCommandOptionType.User, false);
  if (botOption?.value) {
    const isBlBot = await blCache.isBlacklisted(botOption?.value, "b");
    if (isBlBot) {
      return ctx.reply({ content: "The selected bot cannot be configured, because it is blacklisted." }, true);
    }
  }

  if (subcommand === "add") {
    return handleAddApp(ctx, db);
  }
  if (subcommand === "edit") {
    return handleEditApp(ctx, db);
  }

  if (subcommand === "list") {
    return handleListApps(ctx, db);
  }

  if (subcommand === "ownership-verify") {
    return verifyOwnershipHandler(ctx, db);
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
});

function buildAppModal(
  title: string,
  botId: string,
  roleId?: string,
  newSecret: boolean = false,
  durationHours?: number | null,
  edit: boolean = false,
) {
  const modal = new ModalBuilder().setCustomId(`app/${edit ? "edit" : "add"}`).setTitle(title);
  let text: string[] = [];
  if (!edit) {
    text = [
      "Top.gg introduced **Webhooks V1** which works completely different from the previous version.",
      "To set up your app configuration for Top.gg, please follow these steps:",
      `1. Go to the [Integrations Page](https://top.gg/bot/${botId}/dashboard/integrations) of your bot.`,
      "2. Click on **Create** to create a new webhook integration.",
      `3. Set the webhook URL to the following: ${codeBlock(PlatformWebhookUrl("topgg", botId))}`,
      "4. Give it a unique label and toggle the **Vote Created** event to ON.",
      "5. After creating the webhook, copy the generated secret and paste it below.",
    ];
  }
  if (edit && newSecret) {
    text = [
      "Top.gg introduced **Webhooks V1** which works completely different from the previous version. The legacy webhooks will be removed some time in the future, so you need to migrate to the new system to keep receiving vote webhooks.",
      "If you want to generate a new secret, please follow these steps:",
      `1. Go to the [Integrations Page](https://top.gg/bot/${botId}/dashboard/integrations) of your bot.`,
      "",
      "**Remove legacy webhook** (if exists)",
      "2. If you have an existing webhook integration for the old system, please remove it to avoid confusion. Scroll all the way down to find legacy **Legacy Webhooks**.",
      "",
      "**Create new webhook**",
      "1. Scroll up again, click on **Create** to create a new webhook integration.",
      "2. Set the webhook URL to the following:",
      codeBlock(PlatformWebhookUrl("topgg", botId)),
      "3. Give it a unique label and toggle the **Vote Created** event to ON.",
      "4. After creating the webhook, copy the generated secret and paste it below.",
    ];
  }

  if (text.length > 0) {
    modal
      .addTextDisplayComponents((t) => t.setContent(text.join("\n")))
      .addLabelComponents((l) =>
        l.setLabel("Top.gg Webhook Secret").setTextInputComponent((t) => t.setCustomId("secret").setRequired(true).setStyle(1)),
      );
  }

  modal.addLabelComponents((l) =>
    l.setLabel("Bot").setUserSelectMenuComponent((us) => us.setCustomId("bot").setDefaultUsers(botId).setRequired(true)),
  );

  if (roleId || !edit) {
    modal.addLabelComponents((l) =>
      l.setLabel("Reward Role").setRoleSelectMenuComponent((rs) => {
        rs.setCustomId("role").setRequired(true);
        if (roleId) {
          rs.setDefaultRoles(roleId);
        }
        return rs;
      }),
    );
  }

  if (durationHours || !edit) {
    modal.addLabelComponents((l) =>
      l
        .setLabel("Role Duration (Hours)")
        .setDescription("Hours after which the role will be removed; 0 = Don't remove role")
        .setTextInputComponent((t) =>
          t
            .setCustomId("duration")
            .setValue(durationHours ? durationHours.toString() || "0" : "0")
            .setRequired(false)
            .setMinLength(1)
            .setStyle(1),
        ),
    );
  }
  return modal;
}

async function handleListApps(ctx: ChatInputCommandInteraction<MyContext>, db: DrizzleDB) {
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

async function handleAddApp(ctx: ChatInputCommandInteraction, db: DrizzleDB) {
  await ctx.deferReply(true);

  try {
    const bot = ctx.options.getUser("bot", true);
    if (!(await validateBot(bot, ctx.applicationId, ctx.context.env.OWNER_ID === ctx.user.id))) {
      return ctx.editReply({ content: "The selected user is not a bot." });
    }

    // Check if user has verified ownership (skip for owner)
    const isOwner = ctx.context.env.OWNER_ID === ctx.user.id;
    if (!isOwner) {
      const isVerified = await isUserVerifiedForApplication(db, bot.id, ctx.guildId!, ctx.user.id);
      if (!isVerified) {
        return ctx.editReply(
          "You must verify ownership of this application before configuring it.\n" +
            `Use \`/app ownership-verify\` to start the verification process for <@${bot.id}>.`,
        );
      }
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

    if (source === "topgg") {
      // topgg v1 webhooks generate the secret themselves and therefore we need to ask the user for it via a modal
      return ctx.showModal(
        buildAppModal("Add App - Top.gg Webhooks V1 Setup", bot.id, roleId, true, durationHours ? durationHours : undefined, false),
      );
    }

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

    await ctx.editReply(buildAppInfo(ctx.applicationId, newCfg, "create"));
    console.log("Guild configuration inserted into database");
  } catch (error) {
    console.error("Error extracting parameters or adding app configuration:", error);
    await ctx.editReply({ content: `Failed to add app configuration: ${error instanceof Error ? error.message : "Unknown error"}` });
  }
  return;
}

async function handleEditApp(ctx: ChatInputCommandInteraction, db: DrizzleDB) {
  const bot = ctx.options.getUser("bot", true);
  if (!(await validateBot(bot, ctx.applicationId, ctx.context.env.OWNER_ID === ctx.user.id))) {
    return ctx.reply({ content: "The selected user is not a bot." }, true);
  }

  // Check if user has verified ownership (skip for owner)
  const isOwner = ctx.context.env.OWNER_ID === ctx.user.id;
  if (!isOwner) {
    const isVerified = await isUserVerifiedForApplication(db, bot.id, ctx.guildId!, ctx.user.id);
    if (!isVerified) {
      return ctx.reply(
        "You must verify ownership of this application before configuring it.\n" +
          `Use \`/app ownership-verify\` to start the verification process for <@${bot.id}>.`,
        true,
      );
    }
  }

  const source = ctx.options.getString<"topgg" | "dbl">("source", true);
  const role = ctx.options.getRole("role");
  const roleId = role?.id;

  const durationHours = ctx.options.getInteger("duration");
  const durationSeconds = durationHours ? Math.max(durationHours * 3600, 3600) : null;
  const generateNewSecret = ctx.options.getBoolean("generate-secret") ?? false;

  // show modal if source is topgg and user wants to generate new secret
  if (source === "topgg" && generateNewSecret) {
    return ctx.showModal(
      buildAppModal("Edit App - Top.gg Webhooks V1 Setup", bot.id, roleId, true, durationHours !== null ? durationHours : undefined, true),
    );
  }

  await ctx.deferReply(true);

  const guildId = ctx.guildId!;
  console.log("Extracted parameters:", { bot, roleId, durationSeconds, guildId, generateNewSecret });

  if (!roleId && !durationSeconds && !generateNewSecret) {
    return ctx.editReply({ content: "Please provide at least one field to update." });
  }

  let newSecret: string | undefined = undefined;
  let updateFields: Partial<ApplicationCfg> = {};
  if (roleId) {
    updateFields.voteRoleId = roleId;
  }
  if (durationSeconds) {
    updateFields.roleDurationSeconds = durationSeconds;
  }
  if (generateNewSecret) {
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

  await ctx.editReply(buildAppInfo(ctx.applicationId, result, "edit", !!newSecret));
  console.log("Guild configuration updated in database");
}

async function handleRemoveApp(ctx: ChatInputCommandInteraction, db: DrizzleDB) {
  await ctx.deferReply(true);

  console.log("Removing app configuration for guild");

  const bot = ctx.options.getUser("bot", true);
  if (!(await validateBot(bot, ctx.applicationId, ctx.context.env.OWNER_ID === ctx.user.id))) {
    return ctx.editReply({ content: "The selected user is not a bot." });
  }

  // Check if user has verified ownership (skip for owner)
  const isOwner = ctx.context.env.OWNER_ID === ctx.user.id;
  if (!isOwner) {
    const isVerified = await isUserVerifiedForApplication(db, bot.id, ctx.guildId!, ctx.user.id);
    if (!isVerified) {
      return ctx.editReply(
        "You must verify ownership of this application before configuring it.\n" +
          `Use \`/app ownership-verify\` to start the verification process for <@${bot.id}>.`,
      );
    }
  }

  const source = ctx.options.getString<"topgg" | "dbl">("source", true);
  const guildId = ctx.guildId!;

  const result = await db
    .delete(applications)
    .where(and(eq(applications.guildId, guildId), eq(applications.applicationId, bot.id), eq(applications.source, source)));

  if (result.meta.changes === 0) {
    return ctx.editReply({ content: "No existing configuration found for this bot in this guild for this source." });
  }

  console.log("Guild configuration removed from database");
  return ctx.editReply({ content: `Successfully removed app configuration for <@${bot.id}> (${GetSupportedPlatform(source)}).` });
}

export function buildAppInfo(
  clientId: string,
  cfg: ApplicationCfg,
  action: "edit" | "create",
  secretVisible: boolean = false,
): { embeds: APIEmbed[] } {
  secretVisible = secretVisible || action === "create";
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

  const embed1: APIEmbed = {
    description: [
      heading(`Configuration ${action === "create" ? "created" : "updated"} for bot <@${cfg.applicationId}>:`, 3),
      `Successfully updated configuration for bot <@${cfg.applicationId}> in this server for source ${bold(
        GetSupportedPlatform(cfg.source),
      )}.`,
    ].join("\n"),
    color: action === "create" ? Colors.Green : Colors.Yellow,
    fields: fields,
  };

  const embed2: APIEmbed = {
    color: Colors.Yellow,
    description: [
      heading("Webhook Information", 2),
      "You need to configure your bot listing platform to use the following webhook data:",
    ].join("\n"),
    fields: [
      {
        name: "Webhook Endpoint",
        value: codeBlock(PlatformWebhookUrl(cfg.source, cfg.applicationId)),
      },
      {
        name: "Webhook Secret",
        value: [
          codeBlock(secretVisible ? cfg.secret : sanitizeSecret(cfg.secret)),
          ":warning: **Keep this secret safe! It will not be shown again.**",
        ].join("\n"),
      },
    ],
  };

  return {
    embeds: [embed1, embed2],
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

  console.log("Setting forwarding configuration");

  try {
    const bot = ctx.options.getUser("bot", true);
    if (!(await validateBot(bot, ctx.applicationId, ctx.context.env.OWNER_ID === ctx.user.id))) {
      return ctx.editReply({ content: "The selected user is not a bot." });
    }

    // Check if user has verified ownership (skip for owner)
    const isOwner = ctx.context.env.OWNER_ID === ctx.user.id;
    if (!isOwner) {
      const isVerified = await isUserVerifiedForApplication(db, bot.id, ctx.guildId!, ctx.user.id);
      if (!isVerified) {
        return ctx.editReply(
          "You must verify ownership of this application before configuring it.\n" +
            `Use \`/app ownership-verify\` to start the verification process for <@${bot.id}>.`,
        );
      }
    }

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
      .select({ count: count() })
      .from(applications)
      .where(and(eq(applications.applicationId, bot.id), eq(applications.guildId, guildId)))
      .get();

    if (!appConfig || appConfig.count === 0) {
      return ctx.editReply({
        content: `No app configuration found for <@${bot.id}>.\nPlease add the app configuration first using \`/app add\`.`,
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

    // Check if user has verified ownership (skip for owner)
    const isOwner = ctx.context.env.OWNER_ID === ctx.user.id;
    if (!isOwner) {
      const isVerified = await isUserVerifiedForApplication(db, bot.id, ctx.guildId!, ctx.user.id);
      if (!isVerified) {
        return ctx.editReply(
          "You must verify ownership of this application before configuring it.\n" +
            `Use \`/app ownership-verify\` to start the verification process for <@${bot.id}>.`,
        );
      }
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

async function verifyOwnershipHandler(ctx: ChatInputCommandInteraction, db: DrizzleDB) {
  const bot = ctx.options.getUser("bot", true);
  if (!bot.bot) {
    return ctx.reply({ content: "The selected user is not a bot." }, true);
  }

  const existingVerification = await db
    .select()
    .from(verifications)
    .where(and(eq(verifications.applicationId, bot.id)))
    .get();

  if (existingVerification?.verified) {
    const message =
      existingVerification.userId === ctx.user.id
        ? "Your ownership of this application has already been verified!"
        : "This application's ownership has already been verified by another user.";

    return ctx.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [
        new ContainerBuilder()
          .setAccentColor(Colors.Green)
          .addTextDisplayComponents((t) => t.setContent(bold("Ownership Already Verified") + `\n${message}`)) as any,
      ],
    });
  }

  await db
    .insert(verifications)
    .values({
      applicationId: bot.id,
      guildId: ctx.guildId!,
      userId: ctx.user.id,
    })
    .onConflictDoNothing()
    .run();

  return ctx.reply({
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    components: [
      new ContainerBuilder()
        .setAccentColor(Colors.Blurple)
        .addTextDisplayComponents((t) =>
          t.setContent(
            `## Ownership Verification Requested for <@${bot.id}>\nPlease follow the steps below to complete the verification process.`,
          ),
        )
        .addSeparatorComponents((s) => s.setSpacing(2))
        .addTextDisplayComponents(
          (t) =>
            t.setContent(
              "Ownership verification works by using a workaround that requires you to authorize the bot so it can fetch your app's entitlements.\n" +
                "It doesn't matter if your app supports it or not, the owner ship can be verified by the returned status code.",
            ),
          (t) =>
            t.setContent(
              "First, click the **Authorize Bot** button below. You will be prompted to authorize the bot with the `applications.entitlements` scope. This allows the bot to check for an entitlement that only the owner of the application would have.",
            ),
          (t) =>
            t.setContent(
              "After authorizing, return to this message and click the **Verify Ownership** button. The bot will check for the entitlement and verify your ownership based on that.",
            ),
        )
        .addActionRowComponents((ar: ActionRowBuilder<ButtonBuilder>) =>
          ar.setComponents(
            new ButtonBuilder()
              .setLabel("Authorize Bot")
              .setStyle(5)
              .setURL(getAuthorizeUrlForOwnershipVerify(ctx.context.req.url, ctx.applicationId))
              .setEmoji({ name: "🔗" }),
            new ButtonBuilder().setLabel("Verify Ownership").setStyle(1).setCustomId(`owner_verify?${bot.id}`).setEmoji({ name: "✅" }),
          ),
        ) as any,
    ],
  });
}
