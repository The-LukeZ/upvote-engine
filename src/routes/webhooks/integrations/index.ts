import { Hono } from "hono";
import { HonoEnv } from "../../../../types";
import { IntegrationCreateWebhookPayloadSchema, IntegrationDeleteWebhookPayloadSchema } from "topgg-api-types/v1/validators";
import { WebhookHandler } from "../../../utils/webhook";
import { IntegrationCreateResponse, WebhookPayload } from "topgg-api-types";
import * as z from "zod/mini";
import { applications, Cryptor, forwardings, integrations, votes } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { PlatformWebhookUrl } from "../../../constants";

// internal routes

type IntegrationsEnv = HonoEnv & {
  Bindings: HonoEnv["Bindings"] & {
    TOPGG_INTEGRATIONS_TOKEN: string;
  };
  Variables: HonoEnv["Variables"] & {
    payload: WebhookPayload<"integration.create" | "integration.delete">;
  };
};

const validator = z.union([IntegrationCreateWebhookPayloadSchema, IntegrationDeleteWebhookPayloadSchema]);

const integrationsApp = new Hono<IntegrationsEnv>();

integrationsApp.use("*", async (c, next) => {
  c.header("Content-Type", "application/json");
  return next();
});

integrationsApp.post(
  "/topgg",
  async (c, next) => {
    const handler = new WebhookHandler(c.env.TOPGG_INTEGRATIONS_TOKEN);
    const valRes = await handler.validateRequest(c as any);
    if (!valRes.isValid) {
      return c.json({ error: "Invalid request signature" }, 401);
    }
    const payload = validator.safeParse(valRes.payload);
    if (!payload.success) {
      console.error("Payload validation failed", { errors: payload.error.issues, rawPayload: valRes.payload });
      return c.json({ error: "Invalid payload structure" }, 400);
    }
    c.set("payload", payload.data);
    return next();
  },

  async (c) => {
    const db = c.get("db");
    const { type: dType, data } = c.get("payload");
    console.log("Received Top.gg integration webhook", { payload: data });

    if (dType === "integration.delete") {
      // On delete, we need to find the integration first to get the applicationId
      const integration = await db.select().from(integrations).where(eq(integrations.id, data.connection_id)).limit(1).get();
      if (integration) {
        await db.delete(votes).where(eq(votes.applicationId, integration.applicationId));
        await db.delete(forwardings).where(eq(forwardings.applicationId, integration.applicationId));
        await db.delete(applications).where(eq(applications.applicationId, integration.applicationId));
      }
      // Delete the integration entry
      await db.delete(integrations).where(eq(integrations.id, data.connection_id));
      return c.json({ message: "Integration deleted event received" }, 200);
    }

    // At this point, we know it's an integration.create event
    if (dType !== "integration.create") {
      return c.json({ error: "Unknown event type" }, 400);
    }

    if (data.project.platform !== "discord") {
      console.warn("Received integration webhook for unsupported platform", { platform: data.project.platform });
      return c.json({ error: "Unsupported platform" }, 400);
    } else if (data.project.type !== "bot") {
      console.warn("Received integration webhook for unsupported project type", { type: data.project.type });
      return c.json({ error: "Unsupported project type" }, 400);
    }

    await db.insert(integrations).values({
      id: data.connection_id,
      type: "topgg",
      applicationId: data.project.platform_id,
      secret: data.webhook_secret, // We dont need to encrypt this, because it's only used for validating incoming webhooks, not for authenticating outgoing requests
      userId: data.user.platform_id,
    });

    const responsePayload: IntegrationCreateResponse = {
      routes: ["vote.create", "webhook.test"],
      webhook_url: PlatformWebhookUrl("topgg", data.project.platform_id),
    };

    return c.json(responsePayload, 200);
  },
);

export default integrationsApp;
