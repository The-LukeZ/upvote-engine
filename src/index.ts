import { DurableObject } from "cloudflare:workers";
import { ApplicationIntegrationType, Routes } from "discord-api-types/v10";
import { REST } from "@discordjs/rest";
import { Hono } from "hono";
import { poweredBy } from "hono/powered-by";
import { and, eq, gt, inArray, isNotNull, lte, notExists } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import dayjs from "dayjs";

import type { DrizzleDB, HonoContextEnv, QueueMessageBody } from "../types";
import { makeDB } from "./db/util";
import { applications, blacklist, Vote, votes } from "./db/schema";
import { addBotUrl } from "./constants";
import { generateSnowflake } from "./snowflake";
import { handleForwardWebhook, handleVoteApply, handleVoteRemove } from "./queueHandlers";
import { interactionsApp } from "./routes/discord";
import webhookApp from "./routes/webhooks";

const app = new Hono<HonoContextEnv>();

// Mount Builtin Middleware
app.use("*", poweredBy({ serverName: "Venocix" }));
app.get("/", (c) => c.env.ASSETS.fetch("/index.html"));
app.post("/health", (c) => c.text("OK"));

const inviteRouter = new Hono<HonoContextEnv>();
inviteRouter.get("/user", (c) => c.redirect(addBotUrl(c.env.DISCORD_APP_ID, ApplicationIntegrationType.UserInstall)));
inviteRouter.all("*", (c) => c.redirect(addBotUrl(c.env.DISCORD_APP_ID, ApplicationIntegrationType.GuildInstall)));
app.route("/invite", inviteRouter);

app.get("/info", (c) => c.redirect("https://discord.com/discovery/applications/" + c.env.DISCORD_APP_ID));
app.get("/github", (c) => c.redirect("https://github.com/The-LukeZ/upvote-engine"));
app.get("/wiki", (c) => c.redirect("https://github.com/The-LukeZ/upvote-engine/wiki"));
app.get("/docs", (c) => c.redirect("https://github.com/The-LukeZ/upvote-engine/wiki"));
app.get("/issue", (c) => c.redirect("https://github.com/The-LukeZ/upvote-engine/issues"));
app.get("/bug", (c) => c.redirect("https://github.com/The-LukeZ/upvote-engine/issues"));
app.get("/help", (c) => c.redirect("https://github.com/The-LukeZ/upvote-engine/discussions/new?category=q-a"));

app.route("/webhook", webhookApp);
app.route("/discord", interactionsApp);

app.all("*", (c) => c.text("Not Found.", 404));

async function handleExpiredVotes(env: Env, db: DrizzleDB) {
  const currentTs = dayjs().toISOString();
  let expiredVotes: Vote[] = [];
  try {
    const v = alias(votes, "v");
    expiredVotes = await db
      .select()
      .from(v)
      .where(
        and(
          isNotNull(v.expiresAt),
          lte(v.expiresAt, currentTs),
          notExists(
            db
              .select()
              .from(votes)
              .where(
                and(eq(votes.userId, v.userId), eq(votes.guildId, v.guildId), isNotNull(votes.expiresAt), gt(votes.expiresAt, currentTs)),
              ),
          ),
        ),
      );

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

    await db.delete(applications).where(inArray(applications.guildId, invalidGuilds)); // Cascade deletes votes

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

      case "0 3 * * 1": // every sunday at 3 AM (CF uses 1 = Sunday)
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
    } else if (batch.queue === "forwardwebhook") {
      ctx.waitUntil(handleForwardWebhook(batch));
    }
  },
} satisfies ExportedHandler<Env, any>;

export class BlacklistCacheDO extends DurableObject {
  readonly blacklistedGuilds: Set<string> = new Set<string>();
  readonly blacklistedUsers: Set<string> = new Set<string>();
  readonly blacklistedBots: Set<string> = new Set<string>();

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);

    state.blockConcurrencyWhile(async () => {
      const db = makeDB(env);
      const blacklistEntries = await db.select().from(blacklist).all();

      for (const entry of blacklistEntries) {
        if (entry.guildId) {
          this.blacklistedGuilds.add(entry.guildId);
        } else if (entry.userId) {
          this.blacklistedUsers.add(entry.userId);
        } else if (entry.applicationId) {
          this.blacklistedBots.add(entry.applicationId);
        }
      }
    });
  }

  async isBlacklisted(id: string, type: "g" | "u" | "b"): Promise<boolean> {
    switch (type) {
      case "g":
        return this.blacklistedGuilds.has(id);
      case "u":
        return this.blacklistedUsers.has(id);
      case "b":
        return this.blacklistedBots.has(id);
      default:
        return false;
    }
  }
}
