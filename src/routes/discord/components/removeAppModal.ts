import { ModalHandler } from "honocord";
import { MyContext } from "../../../../types";
import { deleteApplicationCascade } from "../../../db/schema";

export const removeAppModal = new ModalHandler<MyContext>("remove_app").addHandler(async function handleRemoveAppModal(ctx) {
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

  console.log(`Removing application configuration for bot ${botUser.id} and source ${source}`);
  try {
    await deleteApplicationCascade(db, botUser.id, source, ctx.guildId!);
  } catch (error) {
    console.error("Database error while removing application configuration:", { error });
    return ctx.editReply({ content: "Failed to remove application configuration due to a database error." });
  }

  await ctx.editReply({ content: `Successfully removed application configuration for <@${botUser.id}>.` });
});
