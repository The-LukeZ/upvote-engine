import { Honocord } from "honocord";
import * as commands from "./commands/index";
import * as components from "./components/index";
import { MyContext } from "../../../types";
import { makeDB } from "../../db/util";

const handlers = [...Object.values(commands), ...Object.values(components)];

const bot = new Honocord({ isCFWorker: true, debugRest: true }).use<MyContext>(async (c, next) => {
  c.set("db", makeDB(c.env.vote_handler));
  return next();
});

bot.loadHandlers(handlers);

export { bot };
