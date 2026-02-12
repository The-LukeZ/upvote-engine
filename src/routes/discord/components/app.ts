import { ModalHandler, ModalInteraction, parseCustomId } from "honocord";
import { APIUser } from "discord-api-types/v10";
import { and, count, eq } from "drizzle-orm";
import { DrizzleDB, MyContext } from "../../../../types";
import { applications, ApplicationCfg, isUserVerifiedForApplication } from "../../../db/schema";
import { buildAppInfo } from "../commands/app";

const MAX_APPS_PER_GUILD = 25;

async function validateBot(bot: APIUser, ownApplicationId: string, byOwner: boolean): Promise<boolean> {
  return !!bot.bot && (byOwner || bot.id !== ownApplicationId);
}

export const appModalHandler = new ModalHandler<MyContext>("app").addHandler(async function handleAppModal(ctx) {
  const { component: action } = parseCustomId(ctx.customId);

  if (action === "add") {
    return handleAddModal(ctx);
  } else if (action === "edit") {
    return handleEditModal(ctx);
  }

  return ctx.reply({ content: "Unknown modal action." }, true);
});

async function handleAddModal(ctx: ModalInteraction<MyContext>) {
  await ctx.deferReply(true);

  const db = ctx.context.get("db") as DrizzleDB;

  try {
    const bot = ctx.fields.getSelectedUsers("bot", true).first()!; // Extract from modal
    if (!bot.bot) {
      return ctx.editReply({ content: "The selected user is not a bot." });
    }

    let secret: string | undefined;
    if (ctx.fields.fieldExists("secret")) {
      secret = ctx.fields.getString("secret", true).trim();
    }

    let roleId: string | undefined;
    if (ctx.fields.fieldExists("role")) {
      roleId = ctx.fields.getSelectedRoles("role", true).first()!.id;
    }
    let durationHours: number | undefined;
    if (ctx.fields.fieldExists("duration")) {
      const durationStr = ctx.fields.getString("duration", true).trim();
      try {
        durationHours = parseFloat(durationStr);
      } catch (error) {
        return ctx.editReply({ content: "Invalid duration. Please enter a valid number for hours." });
      }
      if (isNaN(durationHours) || durationHours <= 0) {
        return ctx.editReply({ content: "Invalid duration. Please enter a positive number for hours." });
      }
      if (durationHours > 24 * 30) {
        return ctx.editReply({ content: "Duration is too long. Please enter a value less than or equal to 720 hours (30 days)." });
      }
    }

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

    // Check if already 25 apps are configured for this guild
    const guildAppCount = await db.select({ count: count() }).from(applications).where(eq(applications.guildId, ctx.guildId!)).get();
    if (guildAppCount && guildAppCount.count >= MAX_APPS_PER_GUILD) {
      return ctx.editReply({
        content: `This guild has reached the maximum number of configured apps (${MAX_APPS_PER_GUILD}).\nYou can't add any more applications.`,
      });
    }

    const source = "topgg"; // topgg is the only source that uses modals for add

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

    const durationSeconds = durationHours ? Math.max(durationHours * 3600, 3600) : null; // Minimum of 1 hour
    const guildId = ctx.guildId;

    if (!guildId) {
      return ctx.editReply({ content: "This command can only be used in a server." });
    }

    let newCfg: ApplicationCfg | undefined;
    try {
      if (existingApp) {
        newCfg = await db
          .update(applications)
          .set({
            guildId: guildId,
            secret: secret || existingApp.secret,
            voteRoleId: roleId || existingApp.voteRoleId,
            roleDurationSeconds: durationSeconds || existingApp.roleDurationSeconds,
          })
          .where(and(eq(applications.applicationId, bot.id), eq(applications.source, source)))
          .returning()
          .get();
      } else {
        newCfg = await db
          .insert(applications)
          .values({
            applicationId: bot.id,
            source: source,
            guildId: guildId,
            secret: secret!,
            voteRoleId: roleId!,
            roleDurationSeconds: durationSeconds!,
          })
          .onConflictDoNothing()
          .returning()
          .get();
      }

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
    console.error("Error adding app configuration from modal:", error);
    await ctx.editReply({
      content: `Failed to add app configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

async function handleEditModal(ctx: ModalInteraction<MyContext>) {
  await ctx.deferReply(true);

  const db = ctx.context.get("db") as DrizzleDB;

  try {
    const bot = ctx.fields.getSelectedUsers("bot", true).first()!;
    if (!bot.bot) {
      return ctx.editReply({ content: "The selected user is not a bot." });
    }

    let secret: string | undefined;
    if (ctx.fields.fieldExists("secret")) {
      secret = ctx.fields.getString("secret", true).trim();
    }

    let roleId: string | undefined;
    if (ctx.fields.fieldExists("role")) {
      roleId = ctx.fields.getSelectedRoles("role", true).first()!.id;
    }

    let durationHours: number | undefined;
    if (ctx.fields.fieldExists("duration")) {
      const durationStr = ctx.fields.getString("duration", true).trim();
      try {
        durationHours = parseFloat(durationStr);
      } catch (error) {
        return ctx.editReply({ content: "Invalid duration. Please enter a valid number for hours." });
      }
      if (isNaN(durationHours) || durationHours <= 0) {
        return ctx.editReply({ content: "Invalid duration. Please enter a positive number for hours." });
      }
      if (durationHours > 24 * 30) {
        return ctx.editReply({ content: "Duration is too long. Please enter a value less than or equal to 720 hours (30 days)." });
      }
    }

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

    const source = "topgg"; // topgg is the only source that uses modals for edit
    const durationSeconds = durationHours ? Math.max(durationHours * 3600, 3600) : null;
    const guildId = ctx.guildId!;

    let updateFields: Partial<ApplicationCfg> = {};
    if (roleId) {
      updateFields.voteRoleId = roleId;
    }
    if (durationSeconds) {
      updateFields.roleDurationSeconds = durationSeconds;
    }
    if (secret) {
      updateFields.secret = secret;
    }

    const result = await db
      .update(applications)
      .set(updateFields)
      .where(and(eq(applications.guildId, guildId), eq(applications.applicationId, bot.id), eq(applications.source, source)))
      .returning()
      .get();

    if (!result) {
      return ctx.editReply({
        content: "No existing configuration found for this bot in this guild for this source. Use `/app add` to add it.",
      });
    }

    await ctx.editReply(buildAppInfo(ctx.applicationId, result, "edit", !!secret));
    console.log("Guild configuration updated in database via modal");
  } catch (error) {
    console.error("Error editing app configuration from modal:", error);
    await ctx.editReply({
      content: `Failed to edit app configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}
