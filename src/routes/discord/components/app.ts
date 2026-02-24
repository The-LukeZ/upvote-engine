import { ComponentHandler, ComponentType, LabelBuilder, ModalBuilder, ModalHandler, parseCustomId } from "honocord";
import { MyContext } from "../../../../types";
import { deleteApplicationCascade } from "../../../db/schema";
import { bold } from "@discordjs/builders";

// Note: Modal handlers are no longer used with the new system.
// Application configuration is now done via the /app command.
export const appModalHandler = new ModalHandler<MyContext>("app").addHandler(async function handleAppModal(ctx) {
  const { component } = parseCustomId(ctx.customId) as { component: string };
  if (component === "remove") {
    const confirmation = ctx.fields.getSelectedValues("confirmation")![0] === "1";
    if (!confirmation) {
      return ctx.editReply({ content: "Operation cancelled." });
    }

    const db = ctx.context.get("db");
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
