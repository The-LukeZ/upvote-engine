import { APIEmoji, ComponentType, MessageFlags, RESTJSONErrorCodes, Routes } from "discord-api-types/v10";
import { MyContext } from "../../../../types";
import { ActionRowBuilder, bold, ButtonBuilder, ContainerBuilder, subtext, ModalBuilder } from "@discordjs/builders";
import { BASE_URL } from "../../../constants";
import { verifications } from "../../../db/schema";
import { and, eq } from "drizzle-orm";
import { DiscordAPIError } from "@discordjs/rest";
import { Colors, ComponentHandler, MessageComponentInteraction, ModalHandler, ModalInteraction, parseCustomId } from "honocord";

/*
Components in here:
- "Upload new emoji" button (start_owner_verify_) -> startOwnerVerify
- "Verify ownership" & "Use existing emoji" button (owner_verify_) -> verifyOwnership

Structure:
- main handler function: handleOwnerVerify
- sub-handlers for each action:
  - startOwnerVerify
  - verifyOwnership
*/

export const ownerVerifyComponent = new ComponentHandler<ComponentType.Button, MyContext>("owner_verify").addHandler(
  function handleOwnerVerify(ctx) {
    const { component, firstParam: botId } = parseCustomId(ctx.customId) as {
      component: "start" | "verify";
      firstParam: string;
    };

    if (component === "start") {
      return startOwnerVerify(ctx, botId);
    } else if (component === "verify") {
      return verifyOwnership(ctx, botId);
    } else {
      return ctx.reply("Unknown owner verify action.", true);
    }
  },
);

function startOwnerVerify(ctx: MessageComponentInteraction<ComponentType.Button, MyContext>, botId: string) {
  return ctx.update({
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    components: [
      new ContainerBuilder()
        .setAccentColor(Colors.Blurple)
        .addTextDisplayComponents((t) =>
          t.setContent(
            `## Ownership Verification Requested for <@${botId}>\nPlease follow the steps below to complete the verification process.`,
          ),
        )
        .addSeparatorComponents((s) => s.setSpacing(2))
        .addTextDisplayComponents((t) =>
          t.setContent(
            "Ownership verification works by using application owned emojis. You can either add a new emoji to your app via the developer portal **or** by using an already existing emoji. Select below.",
          ),
        )
        .addSectionComponents((sec) =>
          sec
            .setThumbnailAccessory((th) => th.setURL(`${BASE_URL}/upvote-engine.webp`))
            .addTextDisplayComponents((t) =>
              t.setContent(
                [
                  bold(`1. Find a small image or [download](${BASE_URL}/upvote-engine.webp) the one on the right`),
                  bold(
                    `2. Go to the [Developer portal](<https://discord.com/developers/applications/${botId}/emojis>) and upload the image as an emoji`,
                  ),
                  subtext("You only need to upload it once, it can be removed after verification."),
                  `-# Can't download the image? Click [here](${BASE_URL}/upvote-engine.webp) to download it.`,
                  "",
                  bold("3. Once uploaded, return here and click the button below to verify ownership"),
                ].join("\n"),
              ),
            )
            .addTextDisplayComponents((t) =>
              t.setContent(bold("3. Once uploaded, return here and click the button below to verify ownership")),
            ),
        )
        .addActionRowComponents((ar: ActionRowBuilder<ButtonBuilder>) =>
          ar.setComponents(
            new ButtonBuilder().setLabel("Verify Ownership").setStyle(1).setCustomId(`owner_verify_${botId}`).setEmoji({ name: "✅" }),
          ),
        )
        .toJSON(),
    ],
  });
}

async function verifyOwnership(ctx: MessageComponentInteraction<ComponentType.Button, MyContext>, botId: string) {
  const db = ctx.context.get("db");
  const entry = await db
    .select()
    .from(verifications)
    .where(and(eq(verifications.applicationId, botId), eq(verifications.guildId, ctx.guildId!), eq(verifications.userId, ctx.user.id)))
    .limit(1)
    .get();

  if (!entry) {
    return ctx.reply("No verification process found. Please start the verification process first. Run the command again to begin.", true);
  } else if (entry.verified) {
    return ctx.reply("Your ownership has already been verified for this application in this server.", true);
  }

  // Show modal to input the emoji
  return ctx.showModal(
    new ModalBuilder({
      title: "Verify Ownership",
      custom_id: `verify_ownership?${botId}`,
    })
      .addLabelComponents((l) =>
        l
          .setLabel("Emoji ID or Markdown")
          .setDescription("Enter the emoji ID or markdown for the emoji you uploaded to your application.")
          .setTextInputComponent((si) =>
            si
              .setCustomId("emoji_input")
              .setPlaceholder("e.g., 1234567890 or <:name:1234567890>")
              .setMinLength(1)
              .setMaxLength(100)
              .setRequired(true),
          ),
      )
      .addTextDisplayComponents((t) =>
        t.setContent(
          "Enter the emoji ID or markdown for the emoji you uploaded to your application. You can right-click the emoji in Discord and copy the markdown.",
        ),
      ),
  );
}

async function verifyOwnershipModal(ctx: ModalInteraction<MyContext>) {
  const db = ctx.context.get("db");
  const botId = ctx.customId.split("?")[1];
  const emojiInput = ctx.fields.getString("emoji_input") || "";

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
    components: [new ContainerBuilder().addTextDisplayComponents((t) => t.setContent("Verifying ownership, please wait...")).toJSON()],
  });

  // Update the verification entry with the emoji being verified
  await db.update(verifications).set({ emojiId: emojiInput }).where(eq(verifications.id, entry.id));

  const emojiId = /^\d+$/.test(emojiInput) ? emojiInput : emojiInput.match(/<a?:\w+:(\d+)>/)?.[1];
  if (!emojiId) {
    return ctx.editReply(
      "### Invalid emoji format provided. Please ensure you provide a valid emoji ID or markdown.\n-# **Example:** `1234567890` or `<:name:1234567890>` or `<a:name:1234567890>`",
    );
  }

  let emoji: APIEmoji;
  try {
    emoji = (await ctx.rest.get(Routes.applicationEmoji(botId, emojiId))) as APIEmoji;
  } catch (e) {
    if (e instanceof DiscordAPIError) {
      if (
        e.code === RESTJSONErrorCodes.UnknownEmoji ||
        e.code === RESTJSONErrorCodes.MissingAccess ||
        e.code === RESTJSONErrorCodes.Unauthorized
      ) {
        return ctx.editReply(
          `### Emoji not found or inaccessible.\nPlease ensure the emoji is uploaded to your application and try again.\n-# You can verify this by checking the [Developer Portal](https://discord.com/developers/applications/${botId}/emojis).`,
        );
      }
    }
    return ctx.editReply("### An error occurred while verifying the emoji. Please report this error to the developers.");
  }

  if (!emoji.user) {
    return ctx.editReply(
      "### Unable to verify emoji ownership.\nThe emoji does not have an associated owner. Please upload a new emoji to your application and try again.",
    );
  } else if (emoji.user.id !== ctx.userId) {
    return ctx.editReply(
      `### Emoji ownership mismatch.\nThe emoji is owned by <@${emoji.user.id}>, but you are <@${ctx.userId}>.\n-# Please ensure you upload the emoji using the same Discord account you are using to verify ownership.`,
    );
  }

  // Mark as verified
  await db.update(verifications).set({ verified: true }).where(eq(verifications.id, entry.id));

  return ctx.editReply("### Ownership verified successfully!\nYou may now assign roles based on votes.");
}

export const ownerVerifyModal = new ModalHandler<MyContext>("verify_ownership").addHandler(verifyOwnershipModal);
