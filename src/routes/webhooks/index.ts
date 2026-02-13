import { Hono } from "hono";
import { HonoEnv } from "../../../types";
import topggApp from "./topgg/handler";
import dblApp from "./dbl/handler";
import { makeDB } from "../../db/util";
import integrationsApp from "./integrations";

const webhookApp = new Hono<HonoEnv, {}, "/webhook">().use("*", async (c, next) => {
  if (c.req.method === "POST") c.set("db", makeDB(c.env.vote_handler));
  c.header("Content-Type", "application/json");
  return next();
});

webhookApp.route("/integrations", integrationsApp);
webhookApp.route("/topgg", topggApp);
webhookApp.route("/dbl", dblApp);

export default webhookApp;
