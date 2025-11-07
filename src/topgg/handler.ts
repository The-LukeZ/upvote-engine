import { Hono } from "hono";
import { HonoBindings, HonoVariables } from "../../types";
import { TopGGWebhook } from "./webhook";
import { makeDB } from "../db/util";
import { applications } from "../db/schema";
import { eq } from "drizzle-orm";

const topggApp = new Hono<{ Bindings: HonoBindings; Variables: HonoVariables }>();

topggApp.post("/webhook/:applicationId", async (c) => {
  const appId = c.req.param("applicationId");
  console.log(`Received Top.gg webhook for application ID: ${appId}`);
  const db = makeDB(c.env);
  const appCfg = await db
    .select({ secret: applications.secret })
    .from(applications)
    .where(eq(applications.applicationId, appId))
    .limit(1)
    .get();

  if (!appCfg) {
    console.log(`Application with ID ${appId} not found`);
    return c.json({ error: "Application not found" }, 404);
  }

  const valRes = await new TopGGWebhook(appCfg?.secret).validateRequest(c);
  console.log("Validation result:", valRes);
  if (!valRes.isValid || !valRes.payload) {
    return c.json({ error: "Invalid request" }, 403);
  }

  const vote = valRes.payload;
  console.log("Received vote:", vote);

  if (vote.type === "test") {
    console.log("Received test vote payload");
    return c.json({ status: "Test vote received" });
  }

  

  return c.json({ status: "Vote received" });
});

export default topggApp;
