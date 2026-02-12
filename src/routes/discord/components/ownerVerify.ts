import { MessageFlags, RouteBases, Routes } from "discord-api-types/v10";
import { MyContext } from "../../../../types";
import { Cryptor, owners, verifications } from "../../../db/schema";
import { and, eq } from "drizzle-orm";
import { REST } from "@discordjs/rest";
import { ComponentHandler, ComponentType, ContainerBuilder, ActionRowBuilder, ButtonBuilder, Colors } from "honocord";
import { getAuthorizeUrlForOwnershipVerify } from "../../../utils";
import { bold } from "@discordjs/builders";
import dayjs from "dayjs";

export const ownerVerifyComponent = new ComponentHandler<MyContext, ComponentType.Button>("owner_verify", ComponentType.Button).addHandler(
  async (ctx) => {
    const db = ctx.context.get("db");
    const botId = ctx.customId.split("?")[1];

    // Validate the entry exists and user owns it
    const entry = await db
      .select()
      .from(verifications)
      .where(and(eq(verifications.applicationId, botId), eq(verifications.guildId, ctx.guildId!), eq(verifications.userId, ctx.user.id)))
      .limit(1)
      .get();

    if (!entry) {
      return ctx.reply("No verification process found. Please start the verification process first.", true);
    } else if (entry.verified) {
      return ctx.reply("Your ownership has already been verified for this application in this server.", true);
    }

    await ctx.update({
      flags: MessageFlags.IsComponentsV2,
      components: [new ContainerBuilder().addTextDisplayComponents((t) => t.setContent("Verifying ownership, please wait...")) as any],
    });

    const ownerData = await db.select().from(owners).where(eq(owners.userId, ctx.user.id)).limit(1).get();
    const errorCode = !ownerData ? "no_data" : ownerData.expiresAt < dayjs().toISOString() ? "expired" : null;
    if (errorCode) {
      const errorMessage =
        errorCode === "no_data"
          ? "No ownership data found. Please start the verification process by authorizing the bot."
          : "Your authorization has expired. Please re-authorize the bot to refresh your ownership data.";
      return ctx.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [
          new ContainerBuilder()
            .setAccentColor(Colors.Red)
            .addTextDisplayComponents((t) => t.setContent(bold("Ownership Verification Failed") + "\n" + errorMessage)),
          new ContainerBuilder()
            .setAccentColor(Colors.Blurple)
            .addTextDisplayComponents((t) =>
              t.setContent(
                `## Ownership Verification Requested for <@${botId}>\nPlease follow the steps below to complete the verification process.`,
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
                new ButtonBuilder().setLabel("Verify Ownership").setStyle(1).setCustomId(`owner_verify?${botId}`).setEmoji({ name: "✅" }),
              ),
            ) as any,
        ],
      });
    } else if (!ownerData) {
      return; // type guard only
    }

    const decrypted = await new Cryptor(ctx.context.env.ENCRYPTION_KEY).decryptToken(ownerData.accessToken, ownerData.iv);

    try {
      const entitlementsurl = `${RouteBases.api}${Routes.entitlements(botId)}` as const;
      const response = await fetch(entitlementsurl, {
        headers: {
          "User-Agent": "UpvoteEngineBot (https://github.com/The-LukeZ/upvote-engine)",
          Authorization: `Bearer ${decrypted}`,
        },
      });
      if (!response.ok) {
        // It's a 403 if the user is not the owner, 200 if the user is the owner, and other status codes for different errors (e.g. 401 for invalid token)
        console.error("Failed to fetch entitlements with status", response.status);
        return ctx.editReply({
          flags: MessageFlags.IsComponentsV2,
          components: [
            new ContainerBuilder()
              .setAccentColor(Colors.Red)
              .addTextDisplayComponents((t) => t.setContent(bold("Ownership Verification Failed"))) as any,
          ],
        });
      }
      console.log("response status", response.status);
    } catch (error: any) {
      console.error("Error fetching entitlements:", error);
      return ctx.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [
          new ContainerBuilder()
            .setAccentColor(Colors.Red)
            .addTextDisplayComponents((t) =>
              t.setContent(
                bold("Ownership Verification Failed") +
                  "\nUnable to fetch entitlements from Discord. Please ensure you authorized the bot correctly.",
              ),
            ),
          new ContainerBuilder()
            .setAccentColor(Colors.Blurple)
            .addTextDisplayComponents((t) =>
              t.setContent(
                `## Ownership Verification Requested for <@${botId}>\nPlease follow the steps below to complete the verification process.`,
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
                new ButtonBuilder().setLabel("Verify Ownership").setStyle(1).setCustomId(`owner_verify?${botId}`).setEmoji({ name: "✅" }),
              ),
            ) as any,
        ],
      });
    }

    await db.update(verifications).set({ verified: true }).where(eq(verifications.id, entry.id));

    return ctx.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [
        new ContainerBuilder()
          .setAccentColor(Colors.Green)
          .addTextDisplayComponents((t) =>
            t.setContent(bold("Ownership Verified") + "\nYour ownership of this application has been successfully verified!"),
          )
          .addSeparatorComponents((s) => s.setSpacing(2))
          .addTextDisplayComponents((t) =>
            t.setContent(
              "If you have any issues or need further assistance, please contact support or refer to the documentation for more information on ownership verification.",
            ),
          ) as any,
      ],
    });
  },
);
