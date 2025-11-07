import { Hono } from "hono";
import { HonoBindings, HonoVariables } from "../../types";
import { TopGGWebhook } from "./webhook";
import { makeDB } from "../db/util";
import { applications } from "../db/schema";
import { eq } from "drizzle-orm";

const topggApp = new Hono<{ Bindings: HonoBindings; Variables: HonoVariables }>().basePath("/topgg");

topggApp.post("/webhook/:applicationId", async (c) => {
  const appId = c.req.param("applicationId");
  const db = makeDB(c.env);
  const appCfg = await db
    .select({ secret: applications.secret })
    .from(applications)
    .where(eq(applications.applicationId, appId))
    .limit(1)
    .get();

  if (!appCfg) {
    return c.json({ error: "Application not found" }, 404);
  }

  const valRes = await new TopGGWebhook(appCfg?.secret).validateRequest(c);
  console.log("Validation result:", valRes);
  if (!valRes.isValid) {
    return c.json({ error: "Invalid request" }, 403);
  }

  const vote = valRes.payload;
  console.log("Received vote:", vote);
});

export default topggApp;
