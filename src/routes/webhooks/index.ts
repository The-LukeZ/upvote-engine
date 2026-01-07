import { Hono } from "hono";
import { HonoEnv } from "../../../types";
import topggApp from "./topgg/handler";
import dblApp from "./dbl/handler";

const webhookApp = new Hono<HonoEnv, {}, "/webhook">();

webhookApp.route("/topgg", topggApp);
webhookApp.route("/dbl", dblApp);

export default webhookApp;
