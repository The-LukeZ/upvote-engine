import { Hono } from "hono";
import { HonoEnv, MyContext, QueueMessageBody } from "$types";
import { applications, votes } from "$/db/schema";
import { and, eq } from "drizzle-orm";
import { generateSnowflake } from "$/snowflake";
import dayjs from "dayjs";
import { WebhookHandler } from "$/utils/webhook";
import { BumpedPayload } from "$types/webhooks";
import { dmUserOnTestVote } from "$/utils";
import { incrementInvalidRequestCount, resetInvalidRequestCount } from "$/utils/index";

const bumpedApp = new Hono<HonoEnv, {}, "/bumped">();

// Path: /webhook/bumped/:applicationId
// Bumped.gg retries on 429/5xx/timeout and expects a 2xx within 10s; any other 4xx is not retried.
bumpedApp.post("/:applicationId", async (c: MyContext) => {
  const appId = c.req.param("applicationId")!;
  const db = c.get("db");
  const appCfg = await db
    .select()
    .from(applications)
    .where(and(eq(applications.applicationId, appId), eq(applications.source, "bumped")))
    .limit(1)
    .get();

  if (!appCfg || !appCfg.secret) {
    await incrementInvalidRequestCount(db, appId);
    return c.json({ error: "Application not found" }, 404);
  }

  const valRes = await new WebhookHandler<BumpedPayload>(appCfg.secret).validateBumpedRequest(c);
  if (!valRes.isValid || !valRes.payload) {
    return c.json({ error: "Invalid request" }, 403);
  }

  const { type, data } = valRes.payload;

  if (type === "webhook.test") {
    c.executionCtx.waitUntil(
      dmUserOnTestVote(db, c.env, {
        applicationId: appId,
        userId: data.user.platform_id,
        source: "bumped",
      }),
    );
    return new Response(null, { status: 200 });
  }

  if (type !== "vote.create") {
    // Unknown future event type: ack so Bumped.gg doesn't keep retrying.
    return new Response(null, { status: 200 });
  }

  if (!appCfg.voteRoleId || !appCfg.guildId) {
    await incrementInvalidRequestCount(db, appId);
    return c.json({ error: "Application not properly configured for vote processing" }, 400);
  }

  await resetInvalidRequestCount(db, appId);

  // Our own snowflake (not Bumped's vote ID), so the 90-day purge by ID range keeps working.
  const voteId = String(generateSnowflake());
  const expiresAt = appCfg.roleDurationSeconds
    ? dayjs().add(appCfg.roleDurationSeconds, "second").toISOString()
    : null;

  await db.insert(votes).values({
    id: voteId,
    applicationId: appId,
    userId: data.user.platform_id,
    source: "bumped",
    guildId: appCfg.guildId,
    roleId: appCfg.voteRoleId,
    expiresAt,
  });
  await c.env.VOTE_APPLY.send({
    id: voteId,
    timestamp: new Date().toISOString(),
  } as QueueMessageBody);

  const forwardPayload = await WebhookHandler.buildForwardPayload(db, appId, "bumped", valRes.payload);
  if (!!forwardPayload) {
    await c.env.FORWARD_WEBHOOK.send(forwardPayload);
  }

  return new Response(null, { status: 200 });
});

export default bumpedApp;
