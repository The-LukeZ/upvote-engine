import { ModalHandler } from "honocord";
import { MyContext } from "../../../../types";

// Note: Modal handlers are no longer used with the integration system.
// Integration configuration is now done via the integrations page, and the bot only sets guild-specific config.
export const appModalHandler = new ModalHandler<MyContext>("app").addHandler(async function handleAppModal(ctx) {
  return ctx.reply({ content: "This modal is no longer supported. Please use the `/integrations configure` or `/integrations edit` commands directly after setting up the integration on Top.gg." }, true);
});
