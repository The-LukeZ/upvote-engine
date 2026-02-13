import { Colors, ContainerBuilder, SlashCommandHandler } from "honocord";
import { verifications } from "../../../db/schema";
import { and, eq } from "drizzle-orm";
import { MessageFlags } from "discord-api-types/payloads/v10";
import { ActionRowBuilder, bold, ButtonBuilder } from "@discordjs/builders";
import { getAuthorizeUrlForOwnershipVerify } from "../../../utils";

export const verifyOwnershipCommand = new SlashCommandHandler()
  .setName("verify-app-ownership")
  .setDescription("Verify ownership of a bot")
  .addUserOption((opt) => opt.setName("bot").setDescription("The bot user to verify").setRequired(true))
  .addHandler(async (ctx) => {
    const db = ctx.context.get("db");
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
  });
