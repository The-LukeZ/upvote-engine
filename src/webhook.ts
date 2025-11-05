import { IRequest } from "itty-router";
import { topggVerify } from "./topggVerify";
import { JsonResponse } from "./utils";
import { WebhookSecret } from "../types";

export async function webhookHandler(req: IRequest, env: Env) {
  // First attempt to parse the webhook payload because we need the application id to retrieve the secret from the db
  let rawPayload: string;
  let botId: string;
  try {
    const body = await req.text();
    const payload = JSON.parse(body);
    if (!payload || !payload.bot) {
      // Adjust 'bot' to the actual field name for application ID
      return new Response("Invalid payload structure", { status: 400 });
    }
    botId = payload.bot;
    rawPayload = body;
  } catch (error) {
    return new Response("Unauthorized", { status: 401 });
  }

  const appData = await env.vote_handler
    .prepare("SELECT secret, guild_id FROM webhook_secrets WHERE application_id = ?")
    .bind(botId)
    .first<Pick<WebhookSecret, "secret" | "guild_id">>();

  if (!appData) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { valid, data } = await topggVerify(req, rawPayload, appData.secret);
  if (!valid || !data) {
    return new Response("Unauthorized", { status: 401 });
  }

  await env.vote_handler.prepare("INSERT INTO votes");
}
