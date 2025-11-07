import { Hono } from "hono";
import { HonoContextEnv, QueueMessageBody } from "../../../types";
import { WebhookHandler } from "../webhook";
import { makeDB } from "../../db/util";
import { applications } from "../../db/schema";
import { eq } from "drizzle-orm";
import { generateSnowflake } from "../../snowflake";
import dayjs from "dayjs";
import { TopGGPayload } from "../../../types/webhooks";
import { dmUserOnTestVote } from "../../utils";

const topggApp = new Hono<HonoContextEnv, {}, "/topgg">();

// Path: /webhook/topgg/:applicationId
topggApp.post("/:applicationId", async (c) => {
  const appId = c.req.param("applicationId");
  console.log(`Received Top.gg webhook for application ID: ${appId}`, { daAuthHeader: c.req.header("authorization") });
  const db = makeDB(c.env);
  const appCfg = await db.select().from(applications).where(eq(applications.applicationId, appId)).limit(1).get();

  if (!appCfg) {
    console.log(`Application with ID ${appId} not found`);
    return c.json({ error: "Application not found" }, 404);
  }

  const valRes = await new WebhookHandler<TopGGPayload>(appCfg?.secret).validateRequest(c);
  console.log("Validation result:", valRes);
  if (!valRes.isValid || !valRes.payload) {
    return c.json({ error: "Invalid request" }, 403);
  }

  const vote = valRes.payload;

  if (vote.type === "test") {
    console.log("Received test vote payload", { vote });
    c.executionCtx.waitUntil(dmUserOnTestVote(db, c.env, { applicationId: appId, userId: vote.user, source: "topgg" }));
    return new Response(null, { status: 200 });
  }

  const voteId = generateSnowflake().toString();
  const expiresAt = appCfg.roleDurationSeconds ? dayjs().add(appCfg.roleDurationSeconds, "second").toISOString() : null; // D1 needs ISO string, because sqlite does not have a native date type

  c.env.VOTE_APPLY.send({
    id: voteId,
    userId: vote.user,
    applicationId: appId,
    guildId: appCfg.guildId,
    roleId: appCfg.voteRoleId,
    expiresAt: expiresAt,
    timestamp: new Date().toISOString(),
    source: "topgg",
  } as QueueMessageBody);

  const forwardPayload = await WebhookHandler.buildForwardPayload(db, appId, "topgg", vote);
  if (!!forwardPayload) {
    c.env.FORWARD_WEBHOOK.send(forwardPayload);
  }

  return new Response(null, { status: 200 });
});

export default topggApp;
