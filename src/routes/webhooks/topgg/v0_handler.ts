import { Context } from "hono";
import { QueueMessageBody } from "../../../../types";
import { WebhookHandler } from "../../../utils/webhook";
import { applications } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { generateSnowflake } from "../../../snowflake";
import dayjs from "dayjs";
import { BotWebhookPayload } from "topgg-api-types/v0";
import { dmUserOnTestVote } from "../../../utils";

// Path: /webhook/topgg/v0/:applicationId
export async function v0handler<CT extends Context>(c: CT) {
  const appId = c.req.param("applicationId");
  console.log(`Received Top.gg webhook for application ID: ${appId}`, { daAuthHeader: c.req.header("authorization") });
  const db = c.get("db");
  const appCfg = await db.select().from(applications).where(eq(applications.applicationId, appId)).limit(1).get();

  if (!appCfg) {
    return c.json({ error: "Application not found" }, 404);
  }

  const valRes = await new WebhookHandler<BotWebhookPayload>(appCfg?.secret).validateRequest(c);
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

  await c.env.VOTE_APPLY.send({
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
    await c.env.FORWARD_WEBHOOK.send(forwardPayload);
  }

  return new Response(null, { status: 200 });
}
