const hehe = globalThis.fetch;
globalThis.fetch = (...args) => {
  console.log("hi!");
  return hehe(...args).catch((err) => {
    console.error("Fetch error:", err);
    throw err;
  });
};

import { AutoRouter } from "itty-router";
import { verifyKey } from "./discordVerify";
import { isChatInputCommandInteraction, isMessageComponentInteraction, isModalInteraction, JsonResponse, sendMessage } from "./utils";
import { APIInteraction, APIWebhookEvent, InteractionResponseType, InteractionType } from "discord-api-types/v10";
import { handleCommand } from "./commands";
import { webhookHandler } from "./webhook";
import { handleComponentInteraction } from "./components";
import { ChatInputCommandInteraction } from "./discord/ChatInputInteraction";
import { REST } from "@discordjs/rest";
import { API } from "@discordjs/core/http-only";
import { inspect } from "util";

const router = AutoRouter();

router.get("/", (_req, env: Env) => {
  return new Response(`👋 ${env.DISCORD_APP_ID}`);
});

/**
 * Main route for all requests sent from Discord.  All incoming messages will
 * include a JSON payload described here:
 * https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object
 */
// router.post("/", async (req, env: Env) => {
//   const { isValid, interaction } = await server.verifyDiscordRequest(req, env);
//   if (!isValid || !interaction) {
//     console.log("Invalid request signature");
//     return new Response("Bad request signature.", { status: 401 });
//   }

//   const rest = new REST({ version: "10" });
//   const api = new API(rest.setToken(env.DISCORD_TOKEN));

//   rest
//     .addListener("response", (request, response) => {
//       console.log(`[REST] ${request.method} ${request.path} -> ${response.status} ${response.statusText}`);
//     })
//     .addListener("restDebug", (info) => {
//       console.log(`[REST DEBUG] ${info}`);
//     });

//   // Handle Discord PING requests
//   switch (interaction.type) {
//     case InteractionType.Ping: {
//       console.log("Received Discord PING request");
//       return new JsonResponse({
//         type: InteractionResponseType.Pong,
//       });
//     }
//     case InteractionType.ApplicationCommand: {
//       try {
//         const deferRes = await fetch(
//           `https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback?with_response=true`,
//           {
//             method: "POST",
//             headers: {
//               "Content-Type": "application/json",
//               authorization: `Bot ${env.DISCORD_TOKEN}`,
//             },
//             body: JSON.stringify({
//               type: InteractionResponseType.DeferredChannelMessageWithSource,
//               data: {
//                 flags: 64,
//               },
//             }),
//           },
//         );
//         console.log("Defer response:", deferRes.status, inspect(Object.entries(deferRes.headers)), await deferRes.text());
//         const resRes = await fetch(`https://discord.com/api/v10/webhooks/${interaction.id}/${interaction.token}?with_response=true`, {
//           method: "PATCH",
//           headers: {
//             "Content-Type": "application/json",
//             authorization: `Bot ${env.DISCORD_TOKEN}`,
//           },
//           body: JSON.stringify({
//             content: "Processing your command...",
//           }),
//         });
//         console.log("Edit response:", resRes.status, inspect(Object.entries(resRes.headers)), await resRes.text());
//       } catch (err) {
//         console.error("Error during deferred reply:", err);
//       } finally {
//         return new Response();
//       }

//       // if (isChatInputCommandInteraction(interaction)) {
//       //   console.log("Received Chat Input Command Interaction:", interaction.data.name);
//       //   return handleCommand(new ChatInputCommandInteraction(api, interaction), env); // Wants APIChatInputApplicationCommandInteraction
//       // } else if (isModalInteraction(interaction)) {
//       //   // Handle modal submissions here if needed
//       //   return sendMessage("Modal submission received!", true);
//       // } else if (isMessageComponentInteraction(interaction)) {
//       //   return handleComponentInteraction(interaction, env);
//       // }
//     }
//   }
// });

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

// const server = {
//   verifyDiscordRequest,
//   fetch: router.fetch,
// };

export default {
  fetch: async function (req, env, ctx) {
    if (req.method === "POST") {
      const { isValid, interaction } = await verifyDiscordRequest(req, env);
      if (!isValid || !interaction) {
        console.log("Invalid request signature");
        return new Response("Bad request signature.", { status: 401 });
      }

      if (interaction.type === InteractionType.Ping) {
        console.log("Received Discord PING request");
        return new JsonResponse({
          type: InteractionResponseType.Pong,
        });
      }

      // Simple check: does defer + edit work?
      const result = await new Promise(async (resolve) => {
        try {
          const deferRes = await fetch(
            `https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback?with_response=true`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                authorization: `Bot ${env.DISCORD_TOKEN}`,
              },
              body: JSON.stringify({
                type: InteractionResponseType.DeferredChannelMessageWithSource,
                data: {
                  flags: 64,
                },
              }),
            },
          );
          console.log("Defer response:", deferRes.status, inspect(Object.entries(deferRes.headers)), await deferRes.text());
          const resRes = await fetch(`https://discord.com/api/v10/webhooks/${interaction.id}/${interaction.token}?with_response=true`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              authorization: `Bot ${env.DISCORD_TOKEN}`,
            },
            body: JSON.stringify({
              content: "Processing your interaction...",
            }),
          });
          console.log("Edit response:", resRes.status, inspect(Object.entries(resRes.headers)), await resRes.text());
        } catch (err) {
          console.error("Error during deferred reply:", err);
        } finally {
          resolve(new Response("successfully deferred and edited"));
        }
      });
    }
    return new JsonResponse({ message: "Hello World!" });
  },
  async queue(batch, env): Promise<void> {
    for (let message of batch.messages) {
      console.log(`message ${message.id} processed: ${JSON.stringify(message.body)}`);
    }
  },
} satisfies ExportedHandler<Env, Error>;
