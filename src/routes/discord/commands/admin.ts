import { ModalBuilder } from "@discordjs/builders";
import { DrizzleDB, MyContext } from "../../../../types";
import { ChatInputCommandInteraction } from "../../../discord/ChatInputInteraction";
import { makeDB } from "../../../db/util";
import { blacklist, BlacklistEntry, NewBlacklistEntry } from "../../../db/schema";
import { eq, isNotNull } from "drizzle-orm";

type BlacklistSubcommand = "add" | "remove" | "list";

export async function handleAdmin(c: MyContext, ctx: ChatInputCommandInteraction) {
  const subgroup = ctx.options.getSubcommandGroup(true);
  const blType = subgroup.split("-")[0] as "guild" | "user" | "bot";
  const subcommand = ctx.options.getSubcommand(true) as BlacklistSubcommand;
  const id = subcommand !== "list" ? ctx.options.getString(`${blType}-id`, true) : null;

  await ctx.deferReply(true);

  const db = makeDB(c.env);

  switch (subcommand) {
    case "add":
      return handleAdd(c, ctx, db, blType, id!);
    case "remove":
      return handleRemove(c, ctx, db, blType, id!);
    case "list":
      return handleList(c, ctx, db, blType);
  }
}

async function handleAdd(c: MyContext, ctx: ChatInputCommandInteraction, db: DrizzleDB, type: "guild" | "user" | "bot", id: string) {
  try {
    let insert: NewBlacklistEntry = {};
    if (type === "guild") {
      insert.guildId = id;
    } else if (type === "user") {
      insert.userId = id;
    } else if (type === "bot") {
      insert.applicationId = id;
    }
    await db.insert(blacklist).values(insert).returning().get();

    // Update the blacklist cache
    const cacheKey = c.env.BLACKLIST.idFromName("blacklist");
    const cache = c.env.BLACKLIST.get(cacheKey);
    const typeMap: Record<string, "g" | "u" | "b"> = { guild: "g", user: "u", bot: "b" };
    await cache.add(id, typeMap[type]);

    return ctx.editReply(`Successfully added ${type} \`${id}\` to the blacklist.`);
  } catch (err) {
    console.error(err);
    return ctx.editReply(`Failed to add ${type} \`${id}\` to the blacklist. It may already be blacklisted.`);
  }
}

async function handleRemove(c: MyContext, ctx: ChatInputCommandInteraction, db: DrizzleDB, type: "guild" | "user" | "bot", id: string) {
  try {
    let equals;
    if (type === "guild") {
      equals = eq(blacklist.guildId, id);
    } else if (type === "user") {
      equals = eq(blacklist.userId, id);
    } else if (type === "bot") {
      equals = eq(blacklist.applicationId, id);
    }
    const result = await db.delete(blacklist).where(equals);
    if (result.meta.changes > 0) {
      // Update the blacklist cache
      const cacheKey = c.env.BLACKLIST.idFromName("blacklist");
      const cache = c.env.BLACKLIST.get(cacheKey);
      const typeMap: Record<string, "g" | "u" | "b"> = { guild: "g", user: "u", bot: "b" };
      await cache.remove(id, typeMap[type]);

      return ctx.editReply(`Successfully removed ${type} \`${id}\` from the blacklist.`);
    } else {
      return ctx.editReply(`${type.charAt(0).toUpperCase() + type.slice(1)} \`${id}\` is not in the blacklist.`);
    }
  } catch (err) {
    console.error(err);
    return ctx.editReply(`Failed to remove ${type} \`${id}\` from the blacklist.`);
  }
}

async function handleList(c: MyContext, ctx: ChatInputCommandInteraction, db: DrizzleDB, type: "guild" | "user" | "bot") {
  try {
    let entries: BlacklistEntry[] = [];
    if (type === "guild") {
      entries = await db.select().from(blacklist).where(isNotNull(blacklist.guildId));
    } else if (type === "user") {
      entries = await db.select().from(blacklist).where(isNotNull(blacklist.userId));
    } else if (type === "bot") {
      entries = await db.select().from(blacklist).where(isNotNull(blacklist.applicationId));
    }

    if (entries.length === 0) {
      return ctx.editReply(`There are no blacklisted ${type}s.`);
    }

    const formattedEntries = entries
      .map((entry) => {
        if (type === "guild") {
          return `- Guild ID: \`${entry.guildId}\``;
        } else if (type === "user") {
          return `- User ID: \`${entry.userId}\``;
        } else if (type === "bot") {
          return `- Bot ID: \`${entry.applicationId}\``;
        }
        return "";
      })
      .join("\n");

    return ctx.editReply(`Blacklisted ${type}s:\n${formattedEntries}`);
  } catch (err) {
    console.error(err);
    return ctx.editReply(`Failed to retrieve blacklisted ${type}s.`);
  }
}
