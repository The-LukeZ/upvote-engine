import { AutoRouter } from "itty-router";
import { verifyKey } from "./discordVerify";
import { isChatInputCommandInteraction, isModalInteraction, JsonResponse, sendMessage } from "./utils";
import { APIInteraction, APIWebhookEvent, ApplicationCommandType, InteractionResponseType, InteractionType } from "discord-api-types/v10";
import { handleCommand } from "./commands";
import { webhookHandler } from "./webhook";

const router = AutoRouter();

router.get("/", (_req, env: Env) => {
  return new Response(`👋 ${env.DISCORD_APP_ID}`);
});
/**
 * Main route for all requests sent from Discord.  All incoming messages will
 * include a JSON payload described here:
 * https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object
 */
router.post("/", async (req, env: Env) => {
  const { isValid, interaction } = await server.verifyDiscordRequest(req, env);
  if (!isValid || !interaction) {
    return new Response("Bad request signature.", { status: 401 });
  }

  // Handle Discord PING requests
  switch (interaction.type) {
    case InteractionType.Ping: {
      console.log("Received Discord PING request");
      return new JsonResponse({
        type: InteractionResponseType.Pong,
      });
    }
    case InteractionType.ApplicationCommand: {
      if (isChatInputCommandInteraction(interaction)) {
        return handleCommand(interaction, env); // Wants APIChatInputApplicationCommandInteraction
      } else if (isModalInteraction(interaction)) {
        // Handle modal submissions here if needed
        return sendMessage("Modal submission received!", true);
      }
    }
  }
});

router.post("/discord.webhook", async (req, env: Env) => {
  const { isValid, interaction: event } = await server.verifyDiscordRequest<APIWebhookEvent>(req, env);
  if (!isValid || !event) {
    return new Response("Bad request signature.", { status: 401 });
  }

  // This handles, when the app is removed from a guild
  // Handle webhook events here
  console.log("Received Discord Webhook Event:", event);

  return new Response("Event received", { status: 200 });
});

router.post("/topgg", webhookHandler);
router.all("*", () => new Response("Not Found.", { status: 404 }));

async function verifyDiscordRequest<T extends APIInteraction | APIWebhookEvent = APIInteraction>(req: Request, env: Env) {
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");
  const body = await req.clone().text();
  const isValidRequest = signature && timestamp && (await verifyKey(body, signature, timestamp, env.DISCORD_PUB_KEY));
  if (!isValidRequest) {
    return { isValid: false };
  }

  return { interaction: JSON.parse(body) as T, isValid: true };
}

const server = {
  verifyDiscordRequest,
  fetch: router.fetch,
};

export default {
  ...server,
  async queue(batch, env): Promise<void> {
    for (let message of batch.messages) {
      console.log(`message ${message.id} processed: ${JSON.stringify(message.body)}`);
    }
  },
} satisfies ExportedHandler<Env, Error>;
