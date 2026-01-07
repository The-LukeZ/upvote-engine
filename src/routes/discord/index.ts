import { Honocord } from "honocord";
import * as commands from "./commands/index";
import * as components from "./components/index";

const bot = new Honocord({ isCFWorker: true, debugRest: true });

const handlers = [...Object.values(commands), ...Object.values(components)];

bot.loadHandlers(handlers);

export { bot as interactionsApp };
