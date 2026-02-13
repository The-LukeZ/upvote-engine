import { Context } from "hono";
import { MyContext, QueueMessageBody } from "../../../../types";
import { WebhookHandler } from "../../../utils/webhook";
import { applications, integrations, NewVote, votes } from "../../../db/schema";
import { eq } from "drizzle-orm";
import dayjs from "dayjs";
import { dmUserOnTestVote } from "../../../utils";
import { WebhookPayload } from "topgg-api-types";

// Path: /webhook/topgg/v1/:applicationId
export async function v1handler(c: MyContext): Promise<Response> {
  const appId = c.req.param("applicationId")!;
  const traceId = c.req.header("x-topgg-trace");

  console.log(`Received Top.gg webhook for application ID: ${appId}`, { traceId });

  const db = c.get("db");
  const appCfg = await db.select().from(applications).where(eq(applications.applicationId, appId)).limit(1).get();

  if (!appCfg) {
    return c.json({ error: "Application not found" }, 404);
  }

  let secret = appCfg.secret;
  if (!secret) {
    const integration = await db.select().from(integrations).where(eq(integrations.applicationId, appId)).limit(1).get();
    if (!integration) {
      console.warn(`No integration record found for application ID ${appId}, cannot validate webhook`);
      return c.json({ error: "Application not properly configured" }, 400);
    }
    secret = integration.secret;
  }

  const valRes = await new WebhookHandler<WebhookPayload<"webhook.test" | "vote.create">>(secret).validateRequest(c);

  if (!valRes.isValid || !valRes.payload) {
    console.error("Webhook validation failed");
    return c.json({ error: "Invalid request" }, 403);
  }

  const version = valRes.version || "v0";
  console.log(`✅ Validated Top.gg webhook (${version})`, { traceId });

  // Normalize payload structure
  const { type: vType, data: vote } = valRes.payload;

  // Handle test votes
  if (vType === "webhook.test") {
    console.log("Received test vote payload", { vote, version });
    c.executionCtx.waitUntil(
      dmUserOnTestVote(db, c.env, {
        applicationId: appId,
        userId: vote.user.platform_id,
        source: "topgg",
      }),
    );
    return new Response(null, { status: 200 });
  }

  // Process actual vote
  const voteId = BigInt(vote.id);
  const expiresAt = appCfg.roleDurationSeconds ? dayjs().add(appCfg.roleDurationSeconds, "second").toISOString() : null;

  await db.insert(votes).values({
    id: voteId,
    applicationId: appId,
    userId: vote.user.platform_id,
    source: "topgg",
    guildId: appCfg.guildId,
    hasRole: false,
    expiresAt: expiresAt,
  });
  if (!appCfg.voteRoleId || !appCfg.guildId) {
    // Can happen if integration was set up but no application configuration was done yet.
    return c.json({ error: "Application not properly configured for vote processing" }, 400);
  }

  await c.env.VOTE_APPLY.send({
    id: voteId.toString(),
    timestamp: new Date().toISOString(),
  } as QueueMessageBody);

  const forwardPayload = await WebhookHandler.buildForwardPayload(db, appId, "topgg", valRes.payload);

  if (!!forwardPayload) {
    await c.env.FORWARD_WEBHOOK.send(forwardPayload);
  }

  return new Response(null, { status: 200 });
}
