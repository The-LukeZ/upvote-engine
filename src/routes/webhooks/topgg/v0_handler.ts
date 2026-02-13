import { Context } from "hono";
import { MyContext, QueueMessageBody } from "../../../../types";
import { WebhookHandler } from "../../../utils/webhook";
import { applications, votes } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { generateSnowflake } from "../../../snowflake";
import dayjs from "dayjs";
import { BotWebhookPayload } from "topgg-api-types/v0";
import { dmUserOnTestVote } from "../../../utils";
import { incrementInvalidRequestCount } from "../../../utils/index";

// Path: /webhook/topgg/v0/:applicationId
export async function v0handler(c: MyContext) {
  const appId = c.req.param("applicationId")!;
  console.log(`Received Top.gg webhook for application ID: ${appId}`, { daAuthHeader: c.req.header("authorization") });
  const db = c.get("db");
  const appCfg = await db.select().from(applications).where(eq(applications.applicationId, appId)).limit(1).get();

  if (!appCfg || !appCfg.secret) {
    await incrementInvalidRequestCount(db, appId);
    return c.json({ error: "Application not found" }, 404);
  }

  const valRes = await new WebhookHandler<BotWebhookPayload>(appCfg.secret).validateRequest(c);
  if (!valRes.isValid || !valRes.payload) {
    return c.json({ error: "Invalid request" }, 403);
  }

  const vote = valRes.payload;

  if (vote.type === "test") {
    console.log("Received test vote payload", { vote });
    c.executionCtx.waitUntil(dmUserOnTestVote(db, c.env, { applicationId: appId, userId: vote.user, source: "topgg" }));
    return new Response(null, { status: 200 });
  }

  const voteId = generateSnowflake(); // in v1, Top.gg started sending a unique vote ID, but in v0 we need to generate it ourselves for tracking and forwarding purposes
  const expiresAt = appCfg.roleDurationSeconds ? dayjs().add(appCfg.roleDurationSeconds, "second").toISOString() : null; // D1 needs ISO string, because sqlite does not have a native date type

  await db.insert(votes).values({
    id: voteId,
    applicationId: appId,
    userId: vote.user,
    source: "topgg",
    guildId: appCfg.guildId!,
    expiresAt: expiresAt,
  });
  await c.env.VOTE_APPLY.send({
    id: voteId.toString(),
    timestamp: new Date().toISOString(),
  } as QueueMessageBody);

  const forwardPayload = await WebhookHandler.buildForwardPayload(db, appId, "topgg", vote);
  if (!!forwardPayload) {
    await c.env.FORWARD_WEBHOOK.send(forwardPayload);
  }

  return new Response(null, { status: 200 });
}
