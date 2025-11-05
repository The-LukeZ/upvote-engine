import { AutoRouter } from "itty-router";
import { verifyKey } from "./discordVerify";
import { APIResponse, JsonResponse } from "./utils";
import { APIInteraction, APIWebhookEvent, InteractionResponseType, InteractionType } from "discord-api-types/v10";

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

  console.log("Received event:", interaction);
  // Handle Discord PING requests
  switch (interaction.type) {
    case InteractionType.Ping: {
      console.log("Received Discord PING request");
      return new JsonResponse({
        type: InteractionResponseType.Pong,
      });
    }
    case InteractionType.ApplicationCommand: {
      console.log("Received application command:", interaction.data.name);

      return new APIResponse({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `You invoked the \`${interaction.data.name}\` command!`,
          flags: 64, // EPHEMERAL
        },
      });
    }
  }
});
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
