import { Hono } from "hono";
import { HonoEnv } from "../../../types";
import topggApp from "./topgg/handler";
import dblApp from "./dbl/handler";
import { makeDB } from "../../db/util";

const webhookApp = new Hono<HonoEnv, {}, "/webhook">().use("*", async (c, next) => {
  if (c.req.method === "POST") c.set("db", makeDB(c.env.vote_handler));
  return next();
});

webhookApp.route("/topgg", topggApp);
webhookApp.route("/dbl", dblApp);

export default webhookApp;
