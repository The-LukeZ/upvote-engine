import { Context } from "hono";
import { QueueMessageBody } from "../../../../types";
import { WebhookHandler } from "../webhook";
import { applications } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { generateSnowflake } from "../../../snowflake";
import dayjs from "dayjs";
import { TopGGV1Payload } from "../../../../types/webhooks";
import { dmUserOnTestVote } from "../../../utils";

// Path: /webhook/topgg/v1/:applicationId
export async function v1handler<CT extends Context>(c: CT) {
  const appId = c.req.param("applicationId");
  const traceId = c.req.header("x-topgg-trace");

  console.log(`Received Top.gg webhook for application ID: ${appId}`, { traceId });

  const db = c.get("db");
  const appCfg = await db.select().from(applications).where(eq(applications.applicationId, appId)).limit(1).get();

  if (!appCfg) {
    return c.json({ error: "Application not found" }, 404);
  }

  const valRes = await new WebhookHandler<TopGGV1Payload>(appCfg?.secret).validateRequest(c);

  if (!valRes.isValid || !valRes.payload) {
    console.error("Webhook validation failed");
    return c.json({ error: "Invalid request" }, 403);
  }

  const version = valRes.version || "v0";
  console.log(`✅ Validated Top.gg webhook (${version})`, { traceId });

  // Normalize payload structure
  const vote = valRes.payload;

  // Handle test votes
  if (vote.type === "test" || vote.type === "bot.test") {
    console.log("Received test vote payload", { vote, version });
    c.executionCtx.waitUntil(
      dmUserOnTestVote(db, c.env, {
        applicationId: appId,
        userId: vote.data.user,
        source: "topgg",
      }),
    );
    return new Response(null, { status: 200 });
  }

  // Process actual vote
  const voteId = generateSnowflake().toString();
  const expiresAt = appCfg.roleDurationSeconds ? dayjs().add(appCfg.roleDurationSeconds, "second").toISOString() : null;

  await c.env.VOTE_APPLY.send({
    id: voteId,
    userId: vote.data.user,
    applicationId: appId,
    guildId: appCfg.guildId,
    roleId: appCfg.voteRoleId,
    expiresAt: expiresAt,
    timestamp: new Date().toISOString(),
    source: "topgg",
  } as QueueMessageBody);

  const forwardPayload = await WebhookHandler.buildForwardPayload(db, appId, "topgg", valRes.payload);

  if (!!forwardPayload) {
    await c.env.FORWARD_WEBHOOK.send(forwardPayload);
  }

  return new Response(null, { status: 200 });
}
