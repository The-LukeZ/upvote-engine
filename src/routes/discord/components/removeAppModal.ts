import { HonoBindings } from "../../../../types";
import { deleteApplicationCascade } from "../../../db/schema";
import { makeDB } from "../../../db/util";
import { ModalInteraction } from "../../../discord/ModalInteraction";

export async function handleRemoveAppModal(modal: ModalInteraction, env: HonoBindings) {
  await modal.deferReply(true);

  const confirmation = modal.fields.getSelectedValues("confirmation")![0] === "1";
  if (!confirmation) {
    return modal.editReply({ content: "Operation cancelled." });
  }

  const db = makeDB(env);
  const [botUser] = modal.fields.getSelectedUsers("bot", true);
  const [source] = modal.fields.getSelectedValues("source", true);
  if (!botUser.bot) {
    return modal.editReply({ content: "Selected user is not a bot." });
  }

  console.log(`Removing application configuration for bot ${botUser.id} and source ${source}`);
  try {
    await deleteApplicationCascade(db, botUser.id, source, modal.guildId!);
  } catch (error) {
    console.error("Database error while removing application configuration:", { error });
    return modal.editReply({ content: "Failed to remove application configuration due to a database error." });
  }

  await modal.editReply({ content: `Successfully removed application configuration for <@${botUser.id}>.` });
}
