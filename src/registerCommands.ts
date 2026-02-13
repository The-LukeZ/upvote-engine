import { registerCommands } from "honocord";
import * as commands from "./routes/discord/commands/index";

await registerCommands(process.env.DISCORD_TOKEN!, process.env.DISCORD_APPLICATION_ID!, ...Object.values(commands));
