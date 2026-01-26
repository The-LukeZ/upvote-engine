import { Honocord } from "honocord";
import * as commands from "./commands/index";
import * as components from "./components/index";
import { MyContext } from "../../../types";
import { makeDB } from "../../db/util";

const bot = new Honocord({ isCFWorker: true, debugRest: true }).use<MyContext>(async (c) => {
  c.set("db", makeDB(c.env.vote_handler));
});

const handlers = [...Object.values(commands), ...Object.values(components)];

bot.loadHandlers(handlers);

export { bot };
