import { Hono } from "hono";
import { HonoContextEnv, QueueMessageBody } from "../../../types";
import { makeDB } from "../../db/util";
import { applications } from "../../db/schema";
import { eq } from "drizzle-orm";
import { generateSnowflake } from "../../snowflake";
import dayjs from "dayjs";
import { WebhookHandler } from "../webhook";
import { DBLPayload } from "../../../types/webhooks";

const dblApp = new Hono<HonoContextEnv, {}, "/dbl">();

// Path: /webhook/topgg/:applicationId
dblApp.post("/:applicationId", async (c) => {
  const appId = c.req.param("applicationId");
  console.log(`Received Top.gg webhook for application ID: ${appId}`);
  const db = makeDB(c.env);
  const appCfg = await db.select().from(applications).where(eq(applications.applicationId, appId)).limit(1).get();

  if (!appCfg) {
    console.log(`Application with ID ${appId} not found`);
    return c.json({ error: "Application not found" }, 404);
  }

  const valRes = await new WebhookHandler<DBLPayload>(appCfg?.secret).validateRequest(c);
  console.log("Validation result:", valRes);
  if (!valRes.isValid || !valRes.payload) {
    return c.json({ error: "Invalid request" }, 403);
  }

  const vote = valRes.payload;

  const voteId = generateSnowflake().toString();
  const expiresAt = appCfg.roleDurationSeconds ? dayjs().add(appCfg.roleDurationSeconds, "second").toISOString() : null; // D1 needs ISO string, because sqlite does not have a native date type

  c.env.VOTE_APPLY.send({
    id: voteId,
    userId: vote.id,
    applicationId: appId,
    guildId: appCfg.guildId,
    roleId: appCfg.voteRoleId,
    expiresAt: expiresAt,
    timestamp: new Date().toISOString(),
    source: "dbl",
  } as QueueMessageBody);

  const forwardPayload = await WebhookHandler.buildForwardPayload(db, appId, vote);
  if (!!forwardPayload) {
    c.env.FORWARD_WEBHOOK.send(forwardPayload);
  }

  return new Response(null, { status: 200 });
});

export default dblApp;
