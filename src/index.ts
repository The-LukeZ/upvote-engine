import { verifyKey } from "./discordVerify";
import { isChatInputCommandInteraction, isModalInteraction, sendMessage } from "./utils";
import { APIInteraction, APIWebhookEvent, InteractionResponseType, InteractionType } from "discord-api-types/v10";
import { handleCommand } from "./commands";
import { ChatInputCommandInteraction } from "./discord/ChatInputInteraction";
import { REST } from "@discordjs/rest";
import { API } from "@discordjs/core/http-only";
import { inspect } from "util";
import { Hono, HonoRequest } from "hono";
import { poweredBy } from "hono/powered-by";
import { cloneRawRequest } from "hono/request";
import { HonoBindings, HonoVariables, QueueMessageBody } from "../types";
import { ModalInteraction } from "./discord/ModalInteraction";
import { handleVoteApply, handleVoteRemove } from "./queueHandlers";
import topggApp from "./topgg/handler";

// router.post("/discord-webhook", async (req, env: Env) => {
//   const { isValid, interaction: event } = await server.verifyDiscordRequest<APIWebhookEvent>(req, env);
//   if (!isValid || !event) {
//     return new Response("Bad request signature.", { status: 401 });
//   }

//   // This handles, when the app is removed from a guild
//   // Handle webhook events here
//   console.log("Received Discord Webhook Event:", event);

//   return new Response("Event received", { status: 200 });
// });

// router.post("/topgg", webhookHandler);
// router.all("*", () => new Response("Not Found.", { status: 404 }));

async function verifyDiscordRequest<T extends APIInteraction | APIWebhookEvent = APIInteraction>(req: HonoRequest, env: Env) {
  const signature = req.header("x-signature-ed25519");
  const timestamp = req.header("x-signature-timestamp");
  const body = await (await cloneRawRequest(req)).text();
  const isValidRequest = signature && timestamp && (await verifyKey(body, signature, timestamp, env.DISCORD_PUB_KEY));
  if (!isValidRequest) {
    return { isValid: false };
  }

  return { interaction: JSON.parse(body) as T, isValid: true };
}

const app = new Hono<{ Bindings: HonoBindings; Variables: HonoVariables }>();

// Mount Builtin Middleware
app.use("*", poweredBy({ serverName: "Venocix" }));
app.get("/", (c) => c.text(`👋 ${c.env.DISCORD_APP_ID} | Welcome my fren`));
app.post("/health", (c) => c.text("OK"));
app.post("/discord-webhook", async (c) => {
  const { isValid, interaction: event } = await verifyDiscordRequest<APIWebhookEvent>(c.req, c.env);
  if (!isValid || !event) {
    console.log("Invalid webhook request signature");
    return c.text("Bad request signature.", 401);
  }

  // This handles, when the app is removed from a guild
  // Handle webhook events here
  console.log("Received Discord Webhook Event:", event);

  return c.text("Event received", 200);
});

app.route("/topgg", topggApp);

app.post("/", async (c) => {
  const { isValid, interaction } = await verifyDiscordRequest(c.req, c.env);
  if (!isValid || !interaction) {
    console.log("Invalid request signature");
    return c.text("Bad request signature.", 401);
  }

  const rest = new REST({
    version: "10",
  }).setToken(c.env.DISCORD_TOKEN);
  const api = new API(rest);

  rest
    .addListener("response", (request, response) => {
      console.log(`[REST] ${request.method} ${request.path} -> ${response.status} ${response.statusText}`);
    })
    .addListener("restDebug", (info) => {
      console.log(`[REST DEBUG] ${info}`);
    });

  // Handle Discord PING requests
  switch (interaction.type) {
    case InteractionType.Ping: {
      console.log("Received Discord PING request");
      return c.json({
        type: InteractionResponseType.Pong,
      });
    }
    case InteractionType.ApplicationCommand:
      c.executionCtx.waitUntil(
        new Promise(async function (resolve) {
          if (isChatInputCommandInteraction(interaction)) {
            console.log("Received Chat Input Command Interaction:", interaction.data.name);
            c.set("command", new ChatInputCommandInteraction(api, interaction));
            await handleCommand(c); // Wants APIChatInputApplicationCommandInteraction
          } else if (isModalInteraction(interaction)) {
            c.set("modal", new ModalInteraction(api, interaction));
            c.get("modal").reply({ content: "Modal submission received!" }, true);
          }
          return resolve(undefined);
        }),
      );

      c.env.VOTE_APPLY.send(
        {
          guildId: "123456789012345678",
          userId: "987654321098765432",
          timestamp: new Date().toISOString(),
          roleId: "112233445566778899",
          applicationId: c.env.DISCORD_APP_ID,
        },
        { contentType: "json" },
      );

      return c.json({}, 202); // Accepted for processing
  }
});

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<QueueMessageBody>, env: Env): Promise<void> {
    console.log(`Processing queue '${batch.queue}'`);
    if (batch.queue === "voteapply") {
      await handleVoteApply(batch, env);
    } else if (batch.queue === "voteremove") {
      await handleVoteRemove(batch, env);
    }
  },
};
