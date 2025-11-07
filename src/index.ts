import { verifyKey } from "./discordVerify";
import { isChatInputCommandInteraction, isModalInteraction } from "./utils";
import { APIInteraction, APIWebhookEvent, InteractionResponseType, InteractionType, Routes } from "discord-api-types/v10";
import { handleCommand } from "./commands";
import { ChatInputCommandInteraction } from "./discord/ChatInputInteraction";
import { REST } from "@discordjs/rest";
import { API } from "@discordjs/core/http-only";
import { Hono, HonoRequest } from "hono";
import { poweredBy } from "hono/powered-by";
import { cloneRawRequest } from "hono/request";
import type { DrizzleDB, HonoContextEnv, QueueMessageBody } from "../types";
import { ModalInteraction } from "./discord/ModalInteraction";
import { handleVoteApply, handleVoteRemove } from "./queueHandlers";
import { makeDB } from "./db/util";
import { applications, Vote, votes } from "./db/schema";
import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";
import dayjs from "dayjs";
import { handleComponentInteraction } from "./components";
import webhookApp from "./webhooks";
import { generateSnowflake } from "./snowflake";

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

const app = new Hono<HonoContextEnv>();

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

app.route("/webhook", webhookApp);

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

      await c.env.VOTE_APPLY.send(
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

app.all("*", (c) => c.text("Not Found.", 404));

async function handleExpiredVotes(env: Env, db: DrizzleDB) {
  const currentTs = dayjs().toISOString();
  let expiredVotes: Vote[] = [];
  try {
    expiredVotes = await db
      .select()
      .from(votes)
      .where(and(isNotNull(votes.expiresAt), lte(votes.expiresAt, currentTs)));

    console.log(`Found ${expiredVotes.length} expired votes to process`);
  } catch (error) {
    console.error("Error querying expired votes:", error);
    return;
  }

  if (expiredVotes.length === 0) return;

  await env.VOTE_REMOVE.sendBatch(
    expiredVotes
      .map(
        (vote) =>
          ({
            id: vote.id.toString(),
            guildId: vote.guildId,
            userId: vote.userId,
            roleId: vote.roleId,
            expiresAt: vote.expiresAt,
            timestamp: new Date().toISOString(),
          } as QueueMessageBody),
      )
      .map((message) => ({ contentType: "json", body: message })),
  );
}

async function deleteOldVotes(db: DrizzleDB) {
  // Vote deletion for votes older than 90 days
  const ninetyDaysAgoSnowflake = generateSnowflake(dayjs().subtract(90, "day").toDate());
  await db.delete(votes).where(lte(votes.id, ninetyDaysAgoSnowflake)); // Directly delete, because we don't need to process anything
}

async function cleanupInvalidGuilds(db: DrizzleDB, env: Env) {
  const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);
  const configs = await db.select().from(applications).all();

  const invalidGuilds: string[] = [];

  for (const config of configs) {
    try {
      // Try to fetch guild member (the bot itself)
      await rest.get(Routes.guildMember(config.guildId, env.DISCORD_APP_ID));
      console.log(`Guild ${config.guildId} is still valid`);
    } catch (error: any) {
      // If we get 403 or 404, the bot is no longer in the guild
      if (error?.status === 403 || error?.status === 404 || error?.code === 10004) {
        console.log(`Guild ${config.guildId} is invalid, marking for deletion`);
        invalidGuilds.push(config.guildId);
      } else {
        console.error(`Error checking guild ${config.guildId}:`, error);
      }
    }

    // Rate limit protection - wait between requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Delete configurations and votes for invalid guilds
  if (invalidGuilds.length > 0) {
    console.log(`Deleting data for ${invalidGuilds.length} invalid guilds`);

    await db.delete(applications).where(inArray(applications.guildId, invalidGuilds));
    await db.delete(votes).where(inArray(votes.guildId, invalidGuilds));

    console.log(`Cleanup complete. Removed data for guilds: ${invalidGuilds.join(", ")}`);
  }
}

export default {
  fetch: app.fetch,

  async scheduled(controller, env, ctx) {
    const db = makeDB(env);

    switch (controller.cron) {
      case "0 2 * * *": // every day at 2 AM
        console.log("Running daily expired votes handler");
        await handleExpiredVotes(env, db);
        await deleteOldVotes(db);
        break;

      case "0 3 * * 0": // every sunday at 3 AM
        console.log("Running weekly guild cleanup");
        ctx.waitUntil(cleanupInvalidGuilds(db, env));
        break;

      default:
        console.log(`No handler for cron '${controller.cron}'`);
        break;
    }
  },

  async queue(batch, env, ctx): Promise<void> {
    console.log(`Processing queue '${batch.queue}'`);
    // ! Note to self: If this isn't properly executing, consider moving this into ctx.waitUntil like in the fetch handler
    if (batch.queue === "voteapply") {
      await handleVoteApply(batch, env);
    } else if (batch.queue === "voteremove") {
      await handleVoteRemove(batch, env);
    }
  },
} satisfies ExportedHandler<Env, QueueMessageBody>;
