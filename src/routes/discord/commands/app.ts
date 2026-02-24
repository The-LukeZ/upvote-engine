import { bold, ButtonBuilder, codeBlock, heading } from "@discordjs/builders";
import { and, count, eq } from "drizzle-orm";
import { APIEmbed, APIUser, ApplicationCommandOptionType, MessageFlags } from "discord-api-types/v10";
import { DrizzleDB, MyContext } from "../../../../types";
import { applications, ApplicationCfg, forwardings, ForwardingCfg, isUserVerifiedForApplication, Cryptor } from "../../../db/schema";
import { sanitizeSecret } from "../../../utils";
import dayjs from "dayjs";
import { GetSupportedPlatform, getTestNoticeForPlatform, hostnamePattern, platformsWithTests } from "../../../constants";
import { ForwardingPayload } from "../../../../types/webhooks";
import { ChatInputCommandInteraction, Colors, ContainerBuilder, ModalBuilder, StringSelectMenuOptionBuilder } from "honocord";
import { appCommand as appCommandData } from "../../../utils/appCommandData";
import * as z from "zod/mini";
import { generateRandomToken } from "../../../utils/index";

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

  const subcommand = ctx.options.getSubcommand(true) as "list" | "create" | "edit" | "remove" | "reset-secret";

  const blCache = ctx.context.env.BLACKLIST.getByName("blacklist");
  const botOption = ctx.options.get("bot", ApplicationCommandOptionType.User, false);
  if (botOption?.value) {
    const isBlBot = await blCache.isBlacklisted(botOption?.value, "b");
    if (isBlBot) {
      return ctx.reply({ content: "The selected bot cannot be configured, because it is blacklisted." }, true);
    }
  }

  if (subcommand === "create") {
    return handleCreateApp(ctx, db);
  } else if (subcommand === "edit") {
    return handleEditApp(ctx, db);
  } else if (subcommand === "list") {
    return handleListApps(ctx, db);
  } else if (subcommand === "reset-secret") {
    return handleResetSecret(ctx, db);
  }

  if (subcommand === "remove") {
    console.log("Showing remove app modal", { options: ctx.options.data });
    const { user: bot } = ctx.options.getMember("bot", true);
    const source = ctx.options.getString<"topgg" | "dbl">("source", true);

    return ctx.showModal(
      new ModalBuilder({
        title: "Remove App",
        custom_id: "app/remove",
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

async function checkAppAuthorization(
  db: DrizzleDB,
  applicationId: string,
  guildId: string,
  userId: string,
  isOwner: boolean,
  isSelf: boolean,
): Promise<{ authorized: boolean; message?: string }> {
  const isVerified = await isUserVerifiedForApplication(db, applicationId, guildId, userId);
  if (!isVerified) {
    return {
      authorized: false,
      message:
        "You are not authorized to configure this bot. Only the application owner or verified owners can configure this bot.\n" +
        `Use \`/verify-app-ownership\` to verify your ownership of <@${applicationId}>.`,
    };
  }

  return { authorized: true };
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

async function handleCreateApp(ctx: ChatInputCommandInteraction<MyContext>, db: DrizzleDB) {
  await ctx.deferReply(true);

  const { user: bot } = ctx.options.getMember("bot", true);
  if (!(await validateBot(bot, ctx.applicationId, ctx.context.env.OWNER_ID === ctx.user.id))) {
    return ctx.editReply({ content: "The selected user is not a bot." });
  }

  const guildId = ctx.guildId!;
  const source = ctx.options.getString<"topgg" | "dbl">("source", true);
  const role = ctx.options.getRole("role", true);

  const durationHours = ctx.options.getInteger("duration");
  const durationSeconds = durationHours ? Math.max(durationHours * 3600, 3600) : null;

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

  const secret = source !== "topgg" ? generateRandomToken() : null; // For top.gg we need to ask the user for the secret upfront because of the way their authorization works

  // Create the configuration
  const newConfig = await db
    .insert(applications)
    .values({
      applicationId: bot.id,
      source: source,
      guildId: guildId,
      voteRoleId: role.id,
      roleDurationSeconds: durationSeconds,
      secret: secret,
    })
    .returning()
    .get();

  if (source === "topgg") {
    // We need to ask the user for the secret upfront because of the way Top.gg's authorization works
    await ctx.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [
        new ContainerBuilder()
          .addTextDisplayComponents((t) =>
            t.setContent(
              [
                `### Top.gg App Setup`,
                "Top.gg changed the way their API works. Legacy mode is still supported but can't be configured. Follow the steps below:",
                `1. Go to the [Top.gg Integrations Page](https://top.gg/bot/${bot.id}/dashboard/integrations) and click **Create** to add a webhook.`,
              ].join("\n"),
            ),
          )
          .addMediaGalleryComponents((g) => g.addItems((i) => i.setURL("https://i.ibb.co/ynJHwSjK/topgg-wh-setup-1.png")))
          .addTextDisplayComponents((t) =>
            t.setContent(
              "2. Copy the webhook url below and paste it in the URL field on Top.gg. Then enable the **Vote Created** event and save the webhook.",
            ),
          )
          .addMediaGalleryComponents((g) => g.addItems((i) => i.setURL("https://i.ibb.co/1fp8P7Pm/topgg-wh-setup-2.png")))
          .addTextDisplayComponents((t) =>
            t.setContent(
              "The webhook is now created and you will see a secret like in the image below. Copy that secret and click the button below.",
            ),
          )
          .addMediaGalleryComponents((g) => g.addItems((i) => i.setURL("https://i.ibb.co/spHFXsP7/topgg-wh-setup-3.png")))
          .addActionRowComponents((r) =>
            r.setComponents(
              new ButtonBuilder({
                custom_id: `app/create?${bot.id}/${source}/${role.id}/${durationHours || "0"}`,
              }),
            ),
          ),
      ],
    });
  }

  await ctx.editReply({
    flags: MessageFlags.IsComponentsV2,
    components: [
      new ContainerBuilder().addTextDisplayComponents((t) =>
        t.setContent(
          [
            "### App Setup",
            "The setup is almost complete! The bot is now configured to receive webhooks but you still need to set the secret on the website.",
            "Copy the secret below, you will not be able to view it again after this.",
            codeBlock(secret!),
            "Set this secret in the settings of your bot on the listing page and you're good to go! If you lose the secret, you can regenerate it via `/app reset-secret`.",
          ].join("\n"),
        ),
      ),
    ],
  });
}

async function handleEditApp(ctx: ChatInputCommandInteraction<MyContext>, db: DrizzleDB) {
  await ctx.deferReply(true);

  const { user: bot } = ctx.options.getMember("bot", true);
  if (!(await validateBot(bot, ctx.applicationId, ctx.context.env.OWNER_ID === ctx.user.id))) {
    return ctx.editReply({ content: "The selected user is not a bot." });
  }

  const isOwner = ctx.context.env.OWNER_ID === ctx.user.id;
  const guildId = ctx.guildId!;
  const source = ctx.options.getString<"topgg" | "dbl">("source", true);

  const authCheck = await checkAppAuthorization(
    db,
    bot.id,
    guildId,
    ctx.user.id,
    isOwner,
    ctx.context.env.DISCORD_APPLICATION_ID === bot.id,
  );
  if (!authCheck.authorized) {
    return ctx.editReply({ content: authCheck.message, flags: MessageFlags.Ephemeral | MessageFlags.SuppressEmbeds });
  }
  const role = ctx.options.getRole("role");
  const roleId = role?.id;

  const durationHours = ctx.options.getInteger("duration");
  const durationSeconds = durationHours ? Math.max(durationHours * 3600, 3600) : null;

  if (!roleId && durationSeconds === null) {
    return ctx.editReply("Please provide at least one field to update.");
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

  await ctx.editReply(buildAppInfo(ctx.applicationId, result, "edit"));
}

async function handleResetSecret(ctx: ChatInputCommandInteraction<MyContext>, db: DrizzleDB) {
  const { user: bot } = ctx.options.getMember("bot", true);
  const source = ctx.options.getString<"topgg" | "dbl">("source", true);

  const appCfg = await db
    .select()
    .from(applications)
    .where(and(eq(applications.applicationId, bot.id), eq(applications.source, source)))
    .get();

  if (!appCfg) {
    return ctx.reply({ content: "No configuration found for this bot and source. Use `/app create` to add it." }, true);
  } else if (appCfg.source === "topgg") {
    await ctx.showModal(
      new ModalBuilder()
        .setCustomId(`app/secret?${appCfg.applicationId}`)
        .setTitle("Reset Secret")
        .addTextDisplayComponents((t) =>
          t.setContent(
            [
              "### Reset Top.gg Secret",
              "You __cannot__ reset the secret for a Top.gg webhook this way, you need to reset the webhook in the Top.gg dashboard.",
              `1. Go to the [Top.gg Integrations Page](https://top.gg/bot/${bot.id}/dashboard/integrations) and find the existing webhook for this bot.`,
              "2. Click the **Reset** button to generate a new secret.",
              "3. Copy the new secret and paste it in the input field below.",
            ].join("\n"),
          ),
        )
        .addLabelComponents((l) =>
          l.setLabel("New Secret").setTextInputComponent((t) => t.setCustomId("secret").setPlaceholder("whs_...").setRequired(true)),
        ),
    );
    return;
  }

  await ctx.deferReply(true);

  const newSecret = generateRandomToken();
  await db.update(applications).set({ secret: newSecret }).where(eq(applications.applicationId, bot.id));

  await ctx.editReply({
    content: [
      "### Secret Reset",
      "The secret has been reset successfully. Copy the new secret below, you will not be able to view it again after this.",
      codeBlock(newSecret),
      "Set this secret in the settings of your bot on the listing page and you're good to go!",
    ].join("\n"),
  });
}

function buildAppInfo(clientId: string, cfg: ApplicationCfg, action: "edit" | "create"): { embeds: APIEmbed[] } {
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

async function handleForwarding(c: MyContext, ctx: ChatInputCommandInteraction<MyContext>, db: DrizzleDB) {
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

async function handleSetForwarding(ctx: ChatInputCommandInteraction<MyContext>, db: DrizzleDB) {
  await ctx.deferReply(true);

  try {
    const { user: bot } = ctx.options.getMember("bot", true);
    if (!(await validateBot(bot, ctx.applicationId, ctx.context.env.OWNER_ID === ctx.user.id))) {
      return ctx.editReply({ content: "The selected user is not a bot." });
    }

    const isOwner = ctx.context.env.OWNER_ID === ctx.user.id;
    const guildId = ctx.guildId!;

    const appCfg = await db
      .select({ source: applications.source })
      .from(applications)
      .where(and(eq(applications.applicationId, bot.id), eq(applications.guildId, guildId)))
      .get();

    if (!appCfg) {
      return ctx.editReply("No app configuration found for this bot in this guild.\nPlease configure the app first using `/app create`.");
    }

    const authCheck = await checkAppAuthorization(
      db,
      bot.id,
      guildId,
      ctx.user.id,
      isOwner,
      ctx.context.env.DISCORD_APPLICATION_ID === bot.id,
    );
    if (!authCheck.authorized) {
      return ctx.editReply({ content: authCheck.message, flags: MessageFlags.Ephemeral | MessageFlags.SuppressEmbeds });
    }

    const targetUrl = ctx.options.getString("url", true); // was validated before
    const forwardingSecret = ctx.options.getString("secret", true);

    const secretSchema = z
      .string()
      .check(
        z.minLength(32, "Secret must be at least 32 characters long"),
        z.maxLength(512, "Secret must be less than 512 characters long"),
        z.regex(/^[\w\-._~!@#$%^&*()+=]+$/, "Secret contains invalid characters"),
      );

    const secretValid = secretSchema.safeParse(forwardingSecret);
    if (!secretValid.success) {
      return ctx.editReply(
        [
          heading("Invalid forwarding secret", 3),
          "The provided forwarding secret is invalid. Please ensure it meets the following criteria:",
          "- Length: 32-512 characters",
          "- Allowed characters: letters, numbers, and `-._~!@#$%^&*()+=` (Regex: `^[\\w\\-._~!@#$%^&*()+=]+$`)",
          "",
          bold("Errors:"),
          ...secretValid.error.issues.map((i) => i.message),
        ].join("\n"),
      );
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

    // Encrypt the secret
    const cryptor = new Cryptor(ctx.context.env.ENCRYPTION_KEY);
    const { token: encryptedSecret, iv } = await cryptor.encryptToken(forwardingSecret);

    // Testing the forwarding configuration
    const testError = await testForwarding(ctx.context.env.RATELIMITER_FORWARDING_TEST, targetUrl, forwardingSecret);
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
        secret: encryptedSecret,
        iv: iv,
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
          value: [codeBlock(forwardingSecret), ":warning: **Keep this secret safe! It will not be shown again.**"].join("\n"),
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
async function testForwarding(limiter: RateLimit, url: string, secret: string): Promise<string | undefined> {
  const { success } = await limiter.limit({ key: encodeURIComponent(url) });
  if (!success) {
    return "Cannot send test payload due to rate limits. Please wait a minute before trying again.";
  }

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

async function handleEditForwarding(ctx: ChatInputCommandInteraction<MyContext>, db: DrizzleDB) {
  await ctx.deferReply(true);

  try {
    const { user: bot } = ctx.options.getMember("bot", true);
    if (!(await validateBot(bot, ctx.applicationId, ctx.context.env.OWNER_ID === ctx.user.id))) {
      return ctx.editReply({ content: "The selected user is not a bot." });
    }

    const isOwner = ctx.context.env.OWNER_ID === ctx.user.id;
    const guildId = ctx.guildId!;

    const appCfg = await db
      .select({ source: applications.source })
      .from(applications)
      .where(and(eq(applications.applicationId, bot.id), eq(applications.guildId, guildId)))
      .get();

    if (!appCfg) {
      return ctx.editReply("No app configuration found for this bot in this guild.\nPlease configure the app first using `/app create`.");
    }

    // Check app authorization
    const authCheck = await checkAppAuthorization(
      db,
      bot.id,
      guildId,
      ctx.user.id,
      isOwner,
      ctx.context.env.DISCORD_APPLICATION_ID === bot.id,
    );
    if (!authCheck.authorized) {
      return ctx.editReply({ content: authCheck.message, flags: MessageFlags.Ephemeral | MessageFlags.SuppressEmbeds });
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
      const cryptor = new Cryptor(ctx.context.env.ENCRYPTION_KEY);
      const { token: encryptedSecret, iv } = await cryptor.encryptToken(newSecret);
      updateFields.secret = encryptedSecret;
      updateFields.iv = iv;
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
        value: [codeBlock(newSecret), ":warning: **Keep this secret safe! It will not be shown again.**"].join("\n"),
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

async function handleRemoveForwarding(ctx: ChatInputCommandInteraction<MyContext>, db: DrizzleDB) {
  console.log("Showing remove forwarding modal");

  const { user: bot } = ctx.options.getMember("bot", true);

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

async function handleViewForwarding(ctx: ChatInputCommandInteraction<MyContext>, db: DrizzleDB) {
  await ctx.deferReply(true);

  console.log("Viewing forwarding configuration");

  try {
    const { user: bot } = ctx.options.getMember("bot", true);

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
  const forwardingUrlSchema = z.url({ hostname: hostnamePattern, protocol: /^https:$/, normalize: true }).check(
    z.refine((url) => {
      // Disallow localhost and IP addresses
      const _url = new URL(url);
      const { hostname, origin } = _url;
      return hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1" && origin !== currentOrigin;
    }),
  );

  return forwardingUrlSchema.safeParse(url).success;
}
