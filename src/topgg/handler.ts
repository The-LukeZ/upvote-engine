import { Hono } from "hono";
import { HonoBindings, HonoVariables, QueueMessageBody } from "../../types";
import { TopGGWebhook } from "./webhook";
import { makeDB } from "../db/util";
import { applications } from "../db/schema";
import { eq } from "drizzle-orm";
import { generateSnowflake } from "../snowflake";
import dayjs from "dayjs";

const topggApp = new Hono<{ Bindings: HonoBindings; Variables: HonoVariables }>();

topggApp.post("/webhook/:applicationId", async (c) => {
  const appId = c.req.param("applicationId");
  console.log(`Received Top.gg webhook for application ID: ${appId}`);
  const db = makeDB(c.env);
  const appCfg = await db.select().from(applications).where(eq(applications.applicationId, appId)).limit(1).get();

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

  const voteId = generateSnowflake();
  const expiresAt = dayjs().add(appCfg.roleDurationSeconds, "second").toISOString(); // D1 needs ISO string, because sqlite does not have a native date type

  c.env.VOTE_APPLY.send({
    id: voteId,
    userId: vote.user,
    guildId: appCfg.guildId,
    roleId: appCfg.voteRoleId,
    expiresAt: expiresAt,
    timestamp: new Date().toISOString(),
  } as QueueMessageBody);

  return c.json({ status: "Vote received" });
});

export default topggApp;
