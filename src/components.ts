import { and, eq } from "drizzle-orm";
import { MyContext } from "../types";
import { makeDB } from "./db/util";
import { applications, forwardings } from "./db/schema";

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
      try {
        // Manually delete related forwardings first (no cascade)
        await db.delete(forwardings).where(eq(forwardings.applicationId, botUser.id));

        // Then delete the application
        await db
          .delete(applications)
          .where(
            and(
              eq(applications.applicationId, botUser.id),
              eq(applications.source, source as any),
              eq(applications.guildId, modal.guildId!),
            ),
          );
      } catch (error) {
        console.error("Database error while removing application configuration:", { error });
        return modal.editReply({ content: "Failed to remove application configuration due to a database error." });
      }

      return modal.editReply({ content: `Successfully removed application configuration for <@${botUser.id}>.` });
    }
  } catch (error) {
    console.error("Error handling component interaction:", error);
    return modal.editReply({ content: "An error occurred while processing your request." });
  }
}
