import { DrizzleDB, MyContext } from "../../../../types";
import { makeDB } from "../../../db/util";
import { blacklist, BlacklistEntry, NewBlacklistEntry } from "../../../db/schema";
import { eq, isNotNull } from "drizzle-orm";
import { ChatInputCommandInteraction, SlashCommandHandler } from "honocord";
import { ApplicationIntegrationType } from "discord-api-types/v10";

type BlacklistSubcommand = "add" | "remove" | "list";

export const adminCommand = new SlashCommandHandler<MyContext>()
  .setGuildIds(process.env.ADMIN_GUILD_ID ? [process.env.ADMIN_GUILD_ID] : [])
  .setName("admin")
  .setDescription("Administrative commands")
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setDefaultMemberPermissions(8)
  .addSubcommandGroup((group) =>
    group
      .setName("guild-blacklist")
      .setDescription("Manage blacklisted guilds")
      .addSubcommand((sub) =>
        sub
          .setName("add")
          .setDescription("Add a guild to the blacklist")
          .addStringOption((opt) => opt.setName("guild-id").setDescription("The guild ID to blacklist").setRequired(true)),
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove")
          .setDescription("Remove a guild from the blacklist")
          .addStringOption((opt) => opt.setName("guild-id").setDescription("The guild ID to remove").setRequired(true)),
      )
      .addSubcommand((sub) => sub.setName("list").setDescription("List all blacklisted guilds")),
  )
  .addSubcommandGroup((group) =>
    group
      .setName("user-blacklist")
      .setDescription("Manage blacklisted users")
      .addSubcommand((sub) =>
        sub
          .setName("add")
          .setDescription("Add a user to the blacklist")
          .addStringOption((opt) => opt.setName("user-id").setDescription("The user to blacklist").setRequired(true)),
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove")
          .setDescription("Remove a user from the blacklist")
          .addStringOption((opt) => opt.setName("user-id").setDescription("The user to remove").setRequired(true)),
      )
      .addSubcommand((sub) => sub.setName("list").setDescription("List all blacklisted users")),
  )
  .addSubcommandGroup((group) =>
    group
      .setName("bot-blacklist")
      .setDescription("Manage blacklisted applications")
      .addSubcommand((sub) =>
        sub
          .setName("add")
          .setDescription("Add an application to the blacklist")
          .addStringOption((opt) => opt.setName("bot-id").setDescription("The bot to blacklist").setRequired(true)),
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove")
          .setDescription("Remove an application from the blacklist")
          .addStringOption((opt) => opt.setName("bot-id").setDescription("The bot to remove").setRequired(true)),
      )
      .addSubcommand((sub) => sub.setName("list").setDescription("List all blacklisted applications")),
  )
  .addHandler(async (ctx) => {
    const subgroup = ctx.options.getSubcommandGroup(true);
    const blType = subgroup.split("-")[0] as "guild" | "user" | "bot";
    const subcommand = ctx.options.getSubcommand(true) as BlacklistSubcommand;
    const id = subcommand !== "list" ? ctx.options.getString(`${blType}-id`, true) : null;

    await ctx.deferReply(true);

    const db = makeDB(ctx.context.env.vote_handler);

    switch (subcommand) {
      case "add":
        return handleAdd(ctx, db, blType, id!);
      case "remove":
        return handleRemove(ctx, db, blType, id!);
      case "list":
        return handleList(ctx, db, blType);
    }
  });

async function handleAdd(ctx: ChatInputCommandInteraction, db: DrizzleDB, type: "guild" | "user" | "bot", id: string) {
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
    const cacheKey = ctx.context.env.BLACKLIST.idFromName("blacklist");
    const cache = ctx.context.env.BLACKLIST.get(cacheKey);
    const typeMap: Record<string, "g" | "u" | "b"> = { guild: "g", user: "u", bot: "b" };
    await cache.add(id, typeMap[type]);

    return ctx.editReply(`Successfully added ${type} \`${id}\` to the blacklist.`);
  } catch (err) {
    console.error(err);
    return ctx.editReply(`Failed to add ${type} \`${id}\` to the blacklist. It may already be blacklisted.`);
  }
}

async function handleRemove(ctx: ChatInputCommandInteraction, db: DrizzleDB, type: "guild" | "user" | "bot", id: string) {
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
      const cacheKey = ctx.context.env.BLACKLIST.idFromName("blacklist");
      const cache = ctx.context.env.BLACKLIST.get(cacheKey);
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

async function handleList(ctx: ChatInputCommandInteraction, db: DrizzleDB, type: "guild" | "user" | "bot") {
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
