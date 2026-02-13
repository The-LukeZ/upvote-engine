import { Hono } from "hono";
import { HonoEnv } from "../../../../types";
import { IntegrationCreateWebhookPayloadSchema, IntegrationDeleteWebhookPayloadSchema } from "topgg-api-types/v1/validators";
import { WebhookHandler } from "../../../utils/webhook";

// internal routes

type IntegrationsEnv = HonoEnv & {
  Bindings: HonoEnv["Bindings"] & {
    TOPGG_INTEGRATIONS_TOKEN: string;
    payload: 
  };
};

const integrationsApp = new Hono<IntegrationsEnv>();

integrationsApp.use("*", async (c, next) => {
  c.header("Content-Type", "application/json");
  return next();
});

integrationsApp.post(
  "/topgg",
  async (c, next) => {
    const handler = new WebhookHandler(c.env.TOPGG_INTEGRATIONS_TOKEN);
    const valRes = await handler.validateRequest(c);
    if (!valRes.isValid) {
      return c.json({ error: "Invalid request signature" }, 401);
    }
    return next();
  },

  async (c) => {},
);

export default integrationsApp;
