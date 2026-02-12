import { Hono } from "hono";
import { HonoEnv } from "../../../../types";
import { v0handler } from "./v0_handler";
import { v1handler } from "./v1_handler";

const topggApp = new Hono<HonoEnv, {}, "/topgg">();

topggApp.post("/v0/:applicationId", v0handler);
topggApp.post("/v1/:applicationId", v1handler); // new route for v1 webhooks, will be the default once we remove the legacy v0 route
topggApp.post("/:applicationId", v0handler); // legacy route, will be removed in the future when we are sure no one is using it anymore

export default topggApp;
