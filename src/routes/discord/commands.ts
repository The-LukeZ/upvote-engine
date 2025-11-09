import { MyContext } from "../../../types";
import { handleApp } from "./commands/app";
import { handleAdmin } from "./commands/admin";
import { handleHelp } from "./commands/help";

export async function handleCommand(c: MyContext) {
  const ctx = c.get("command");
  console.log("Handling command:", ctx.commandName);

  try {
    switch (ctx.commandName) {
	  case "help":
	    return handleHelp(c, ctx);
      case "ping":
        return ctx.reply({ content: "Pong!" }, true);
      case "app":
        return handleApp(c, ctx);
			case "admin":
				return handleAdmin(c, ctx);
      default:
        return ctx.reply({ content: `Unknown command: ${ctx.commandName}` }, true);
    }
  } catch (error) {
    console.error("Error handling command:", error);
    return ctx.reply(
      { content: `An error occurred while processing the command: ${error instanceof Error ? error.message : "Unknown error"}` },
      true,
    );
  }
}
