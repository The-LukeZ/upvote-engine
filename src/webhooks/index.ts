import { Hono } from "hono";
import { HonoContextEnv } from "../../types";
import topggApp from "./topgg/handler";
import dblApp from "./dbl/handler";

const webhookApp = new Hono<HonoContextEnv, {}, "/webhook">();

webhookApp.route("/topgg", topggApp);
webhookApp.route("/dbl", dblApp);

export default webhookApp;
