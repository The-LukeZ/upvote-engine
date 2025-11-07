import dayjs from "dayjs";
import { QueueMessageBody } from "../types";
import { votes } from "./db/schema";
import { makeDB } from "./db/util";
import { API } from "@discordjs/core";
import { REST } from "@discordjs/rest";
import { eq, inArray } from "drizzle-orm";

export async function handleVoteApply(batch: MessageBatch<QueueMessageBody>, env: Env): Promise<void> {
  console.log(`Processing vote apply batch with ${batch.messages.length} messages`);
  const db = makeDB(env);
  for (const message of batch.messages) {
    const body = message.body;
    console.log(`Applying vote for user ${body.userId} in guild ${body.guildId} at ${body.timestamp}`);
  }
  // filter out messages older than 12 hours to avoid applying expired votes
  const twelveHoursAgo = dayjs().subtract(12, "hour");
  const messages = batch.messages.filter((message) => dayjs(message.body.timestamp).isAfter(twelveHoursAgo));

  await db.insert(votes).values(
    messages.map((message) => ({
      id: message.body.id,
      guildId: message.body.guildId,
      userId: message.body.userId,
      roleId: message.body.roleId,
      expiresAt: message.body.expiresAt,
      hasRole: false,
    })),
  );

  const api = new API(new REST({ version: "10", authPrefix: "Bot", timeout: 5000 }).setToken(env.DISCORD_TOKEN));
  const successfulAdds = new Set<bigint>();
  for (const message of messages) {
    try {
      console.log(`Assigning role ${message.body.roleId} to user ${message.body.userId} in guild ${message.body.guildId}`);
      await api.guilds.addRoleToMember(message.body.guildId, message.body.userId, message.body.roleId);
      successfulAdds.add(message.body.id);
    } catch (error) {
      console.error(`Failed to assign role for vote ID ${message.body.id}:`, error);
    }
  }

  // Update hasRole status for successfully assigned roles
  if (successfulAdds.size > 0) {
    await db
      .update(votes)
      .set({ hasRole: true })
      .where(inArray(votes.id, Array.from(successfulAdds)));
  }
}

export async function handleVoteRemove(batch: MessageBatch<QueueMessageBody>, env: Env): Promise<void> {
  console.log(`Processing vote remove batch with ${batch.messages.length} messages`);
  for (const message of batch.messages) {
    const body = message.body;
    console.log(`Removing vote for user ${body.userId} in guild ${body.guildId} at ${body.timestamp}`);
  }

  const api = new API(new REST({ version: "10", authPrefix: "Bot", timeout: 5000 }).setToken(env.DISCORD_TOKEN));
  const successfulRemovals = new Set<bigint>();
  for (const message of batch.messages) {
    try {
      console.log(`Removing role ${message.body.roleId} from user ${message.body.userId} in guild ${message.body.guildId}`);
      await api.guilds.removeRoleFromMember(message.body.guildId, message.body.userId, message.body.roleId);
      successfulRemovals.add(message.body.id);
    } catch (error) {
      console.error(`Failed to remove role for vote ID ${message.body.id}:`, error);
    }
  }

  // Update hasRole status for successfully removed roles
  if (successfulRemovals.size > 0) {
    const db = makeDB(env);
    await db
      .update(votes)
      .set({ hasRole: false })
      .where(inArray(votes.id, Array.from(successfulRemovals)));
  }
}
