import { ModalHandler, parseCustomId } from "honocord";
import { MyContext, SupportedPlatforms } from "$types";
import { applications, deleteApplicationCascade } from "$/db/schema";
import { and, eq } from "drizzle-orm";
import { bold } from "@discordjs/builders";
import { checkAppAuthorization } from "$/utils/index";
import { cleanupTopggAuthorization } from "$/utils/topggOAuth";

// Note: Modal handlers are no longer used with the new system.
// Application configuration is now done via the /app command.
export const appModalHandler = new ModalHandler<MyContext>("app").addHandler(
  async function handleAppModal(ctx) {
    const { component } = parseCustomId(ctx.customId) as { component: string };
    const db = ctx.context.get("db");

    await ctx.deferReply(true);

    if (component === "remove") {
      const confirmation = ctx.fields.getSelectedValues("confirmation")![0] === "1";
      if (!confirmation) {
        return ctx.editReply({ content: "Operation cancelled." });
      }

      const botUser = ctx.fields.getSelectedUsers("bot", true).first()!;
      const [source] = ctx.fields.getSelectedValues("source", true) as [SupportedPlatforms];
      if (!botUser.bot) {
        return ctx.editReply({ content: "Selected user is not a bot." });
      }

      const isGlobalOwner = ctx.context.env.OWNER_ID === ctx.user.id;
      const authCheck = await checkAppAuthorization(db, botUser.id, ctx.guildId!, ctx.user.id, isGlobalOwner);
      if (!authCheck.authorized) {
        return ctx.editReply({ content: authCheck.message });
      }

      let topggCfg:
        | {
            topggProjectId: string | null;
            topggWebhookId: string | null;
            topggRefreshToken: string | null;
            topggRefreshTokenIv: string | null;
          }
        | undefined;

      if (source === "topgg") {
        topggCfg = await db
          .select({
            topggProjectId: applications.topggProjectId,
            topggWebhookId: applications.topggWebhookId,
            topggRefreshToken: applications.topggRefreshToken,
            topggRefreshTokenIv: applications.topggRefreshTokenIv,
          })
          .from(applications)
          .where(and(eq(applications.applicationId, botUser.id), eq(applications.source, "topgg")))
          .get();
      }

      try {
        await deleteApplicationCascade(db, botUser.id, source, ctx.guildId!);
      } catch (error) {
        console.error("Database error while removing app configuration:", { error });
        return ctx.editReply({ content: "Failed to remove app configuration due to a database error." });
      }

      // DB row is gone at this point - only now touch Top.gg, so a failed cascade delete
      // above never leaves a dangling row pointing at already-torn-down Top.gg resources.
      if (
        topggCfg?.topggRefreshToken &&
        topggCfg.topggRefreshTokenIv &&
        topggCfg.topggProjectId &&
        topggCfg.topggWebhookId
      ) {
        await cleanupTopggAuthorization(ctx.context.env, {
          topggProjectId: topggCfg.topggProjectId,
          topggWebhookId: topggCfg.topggWebhookId,
          topggRefreshToken: topggCfg.topggRefreshToken,
          topggRefreshTokenIv: topggCfg.topggRefreshTokenIv,
        });
      }

      await ctx.editReply(
        source === "topgg"
          ? `Successfully removed app configuration for <@${botUser.id}>.`
          : [
              `Successfully removed app configuration for <@${botUser.id}>.`,
              "",
              bold(
                "If not already done, you need to remove the webhook on the listing page as well, since there is no way for us to do it from our side.",
              ),
            ].join("\n"),
      );
    }
  },
);
