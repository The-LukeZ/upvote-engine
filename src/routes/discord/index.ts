import { Hono } from "hono";
import { HonoContextEnv } from "../../../types";
import { verifyDiscordRequest } from "../../discordVerify";
import { REST } from "@discordjs/rest";
import { API } from "@discordjs/core/http-only";
import { InteractionResponseType, InteractionType } from "discord-api-types/v10";
import { isChatInputCommandInteraction, isModalInteraction } from "../../utils";
import { ModalInteraction } from "../../discord/ModalInteraction";
import { handleComponentInteraction } from "../../components";
import { ChatInputCommandInteraction } from "../../discord/ChatInputInteraction";
import { handleCommand } from "./commands";

const app = new Hono<HonoContextEnv, {}, "/discord">();

app.post("/interactions", async (c) => {
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
    case InteractionType.ModalSubmit:
      c.executionCtx.waitUntil(
        new Promise(async function (resolve) {
          if (isModalInteraction(interaction)) {
            c.set("modal", new ModalInteraction(api, interaction));
            await handleComponentInteraction(c);
          }
          return resolve(undefined);
        }),
      );

      return c.json({}, 202); // Accepted for processing
    case InteractionType.ApplicationCommand:
      c.executionCtx.waitUntil(
        new Promise(async function (resolve) {
          if (isChatInputCommandInteraction(interaction)) {
            console.log("Received Chat Input Command Interaction:", interaction.data.name);
            c.set("command", new ChatInputCommandInteraction(api, interaction));
            await handleCommand(c); // Wants APIChatInputApplicationCommandInteraction
          }
          return resolve(undefined);
        }),
      );

      return c.json({}, 202); // Accepted for processing
  }
});

export { app as interactionsApp };
