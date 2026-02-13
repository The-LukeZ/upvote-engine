import { ModalHandler } from "honocord";
import { MyContext } from "../../../../types";
import { deleteApplicationCascade } from "../../../db/schema";
import { bold } from "@discordjs/builders";

export const removeIntegrationModal = new ModalHandler<MyContext>("remove_integration").addHandler(
  async function handleRemoveIntegrationModal(ctx) {
    await ctx.deferReply(true);

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

    console.log(`Removing integration configuration for bot ${botUser.id} and source ${source}`);
    try {
      await deleteApplicationCascade(db, botUser.id, source, ctx.guildId!);
    } catch (error) {
      console.error("Database error while removing integration configuration:", { error });
      return ctx.editReply({ content: "Failed to remove integration configuration due to a database error." });
    }

    if (source === "topgg") {
      return ctx.editReply(
        [
          `Successfully removed integration configuration for <@${botUser.id}>. __If you configured an integration for this bot on top.gg, please read the instructions below.__`,
          "",
          bold("You need to revoke the integration on top.gg yourself as of now, since there is no way for us to do it from our side."),
          `1. Go to your bot's [integrations page](https://top.gg/bot/${botUser.id}/integrations) on top.gg.`,
          "2. Find the integration for our service and click **Remove**.",
        ].join("\n"),
      );
    }

    await ctx.editReply({ content: `Successfully removed integration configuration for <@${botUser.id}>.` });
  },
);
