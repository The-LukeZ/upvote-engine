import { MyContext } from "../../../types";
import { handleOwnerVerify, verifyOwnershipModal } from "./components/ownerVerify";
import { handleRemoveAppModal } from "./components/removeAppModal";

export async function handleComponentInteraction(c: MyContext) {
  const ctx = c.get("modal") ?? c.get("component");
  const customId = ctx!.custom_id; // One is always given, otherwise we wouldn't be here

  if (!ctx) {
    console.error("No interaction context found in component interaction handler.");
    return;
  }

  try {
    if (ctx.isModal()) {
      if (customId === "remove_app_modal") {
        return handleRemoveAppModal(ctx, c.env);
      } else if (customId.startsWith("verify_ownership_submit_")) {
        return verifyOwnershipModal(ctx, c.env);
      }
    } else if (ctx.isMessageComponent()) {
      if (customId.startsWith("owner_verify_")) {
        return handleOwnerVerify(ctx, c.env);
      }
    }
  } catch (error) {
    console.error("Error handling component interaction:", error);
    return ctx.reply({ content: "An error occurred while processing your request." });
  }
}
