import { Hono } from "hono";
import { HonoEnv } from "../../../../types";
import { IntegrationCreateWebhookPayloadSchema, IntegrationDeleteWebhookPayloadSchema } from "topgg-api-types/v1/validators";
import { WebhookHandler } from "../../../utils/webhook";
import { WebhookPayload } from "topgg-api-types";
import * as z from "zod/mini";

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
    const payload = c.get("payload");
    console.log("Received Top.gg integration webhook", { payload });

    
  },
);

export default integrationsApp;
