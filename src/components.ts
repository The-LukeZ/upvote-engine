import { and, eq, sql } from "drizzle-orm";
import { MyContext } from "../types";
import { applications } from "./db/schema";
import { makeDB } from "./db/util";

export async function handleComponentInteraction(c: MyContext) {
  const modal = c.get("modal");

  try {
    if (modal.custom_id === "remove_app_modal") {
      await modal.deferReply(true);

      const confirmation = modal.components.getSelectedValues("confirmation")![0] === "1";
      if (!confirmation) {
        return modal.editReply({ content: "Operation cancelled." });
      }

      const db = makeDB(c.env);
      const [botUser] = modal.components.getSelectedUsers("bot", true);
      const [source] = modal.components.getSelectedValues("source", true);
      if (!botUser.bot) {
        return modal.editReply({ content: "Selected user is not a bot." });
      }

      console.log(`Removing application configuration for bot ${botUser.id} and source ${source}`);
      await db.run(
        sql`DELETE FROM applications WHERE application_id = ${botUser.id} AND source = ${source} AND guild_id = ${modal.guildId!}`,
      );

      return modal.editReply({ content: `Successfully removed application configuration for <@${botUser.id}>.` });
    }
  } catch (error) {
    console.error("Error handling component interaction:", error);
    return modal.editReply({ content: "An error occurred while processing your request." });
  }
}
