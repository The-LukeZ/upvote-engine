import { Hono } from "hono";
import { HonoContextEnv } from "../../types";
import topggApp from "./topgg/handler";

const webhookApp = new Hono<HonoContextEnv, {}, "/webhook">();

webhookApp.route("/topgg", topggApp);

export default webhookApp;
