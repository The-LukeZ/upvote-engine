import { ComponentHandler, ComponentType, LabelBuilder, ModalBuilder, ModalHandler, parseCustomId } from "honocord";
import { MyContext } from "../../../../types";
import { ApplicationCfg, applications, deleteApplicationCascade } from "../../../db/schema";
import { bold } from "@discordjs/builders";
import { and, eq } from "drizzle-orm";
import { buildAppInfo } from "../../../utils/index";

// Note: Modal handlers are no longer used with the new system.
// Application configuration is now done via the /app command.
export const appModalHandler = new ModalHandler<MyContext>("app").addHandler(async function handleAppModal(ctx) {
  const { component } = parseCustomId(ctx.customId) as { component: string };
  const db = ctx.context.get("db");

  await ctx.deferReply(true);

  if (component === "remove") {
    const confirmation = ctx.fields.getSelectedValues("confirmation")![0] === "1";
    if (!confirmation) {
      return ctx.editReply({ content: "Operation cancelled." });
    }

    const botUser = ctx.fields.getSelectedUsers("bot", true).first()!;
    const [source] = ctx.fields.getSelectedValues("source", true);
    if (!botUser.bot) {
      return ctx.editReply({ content: "Selected user is not a bot." });
    }

    try {
      await deleteApplicationCascade(db, botUser.id, source, ctx.guildId!);
    } catch (error) {
      console.error("Database error while removing app configuration:", { error });
      return ctx.editReply({ content: "Failed to remove app configuration due to a database error." });
    }

    await ctx.editReply(
      [
        `Successfully removed app configuration for <@${botUser.id}>.`,
        "",
        bold(
          "If not already done, you need to remove the webhook on the listing page as well, since there is no way for us to do it from our side.",
        ),
      ].join("\n"),
    );
  } else if (component === "create") {
    const secret = ctx.fields.getString("secret");
    const { params } = parseCustomId(ctx.customId) as { params: string[] };
    const [botId, source, roleId, durationHoursStr] = params[0];

    const existingCfg = await db.select().from(applications).where(eq(applications.applicationId, botId)).limit(1).get();
    if (existingCfg) {
      return ctx.editReply({
        content: "An app configuration for this bot already exists. Please remove the existing configuration before creating a new one.",
      });
    }

    const durationHours = parseInt(durationHoursStr, 10);
    if (isNaN(durationHours) || durationHours <= 0) {
      return ctx.editReply({ content: "Invalid duration specified." });
    }

    try {
      await db.insert(applications).values({
        applicationId: botId,
        guildId: ctx.guildId!,
        source: source as any,
        secret: secret,
        voteRoleId: roleId || null,
        roleDurationSeconds: Math.max(3600, Math.min(durationHours * 3600, 14 * 24 * 3600)), // Clamp duration between 1 hour and 14 days
      });
    } catch (error) {
      console.error("Database error while creating app configuration:", { error });
      return ctx.editReply({ content: "Failed to create app configuration due to a database error." });
    }

    await ctx.editReply({
      content: `Successfully created app configuration for <@${botId}> with a duration of ${durationHours} hours.`,
    });
  } else if (component === "secret") {
    const secret = ctx.fields.getString("secret");
    const { firstParam: botId } = parseCustomId(ctx.customId) as { firstParam: string };

    let appCfg: ApplicationCfg;
    try {
      appCfg = await db
        .update(applications)
        .set({ secret: secret })
        .where(and(eq(applications.applicationId, botId), eq(applications.guildId, ctx.guildId!), eq(applications.source, "topgg")))
        .returning()
        .get();
    } catch (error) {
      console.error("Database error while updating app secret:", { error });
      return ctx.editReply({ content: "Failed to update app secret due to a database error." });
    }

    if (!appCfg) {
      return ctx.editReply({ content: "No configuration found for this bot and source." });
    }

    await ctx.editReply(buildAppInfo(botId, appCfg, "edit"));
  }
});

export const appBtnHandler = new ComponentHandler<MyContext, ComponentType.Button>("app", ComponentType.Button).addHandler(
  async function handleAppBtn(ctx) {
    const { component, params } = parseCustomId(ctx.customId) as { params: string[]; component: string };
    if (component === "create") {
      return ctx.showModal(
        new ModalBuilder()
          .setCustomId(`app/create?${params.join("/")}`)
          .setTitle("Setup Application")
          .addTextDisplayComponents((t) => t.setContent(`Provide the secret from top.gg for <@${params[0]}>.`))
          .addLabelComponents(
            new LabelBuilder()
              .setLabel("Webhook Secret")
              .setDescription("The secret provided by top.gg when creating a new webhook")
              .setTextInputComponent((ti) => ti.setCustomId("secret").setPlaceholder("whs_....").setRequired(true)),
          ),
      );
    }
  },
);
