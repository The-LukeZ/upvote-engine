import { registerCommands } from "honocord";
import * as handlers from "./routes/discord/commands/index";

await registerCommands(process.env.DISCORD_APPLICATION_ID!, process.env.DISCORD_TOKEN!, Object.values(handlers));
