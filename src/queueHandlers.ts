import dayjs from "dayjs";
import { QueueMessageBody } from "../types";
import { votes } from "./db/schema";
import { makeDB } from "./db/util";
import { REST } from "@discordjs/rest";
import { inArray } from "drizzle-orm";
import { Routes } from "discord-api-types/v10";

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
  const validMessages = messages.filter((message) => message.body.id != null && message.body.id !== undefined);
  if (validMessages.length !== messages.length) {
    console.warn(`Filtered out ${messages.length - validMessages.length} messages with invalid id`);
  }
  if (validMessages.length === 0) {
    console.log("No valid messages to process after filtering. Exiting.");
    return;
  }

  await db.insert(votes).values(
    validMessages.map((message) => ({
      id: BigInt(message.body.id),
      applicationId: message.body.applicationId,
      guildId: message.body.guildId,
      userId: message.body.userId,
      roleId: message.body.roleId,
      expiresAt: message.body.expiresAt,
      hasRole: false,
    })),
  );

  const rest = new REST({ version: "10", authPrefix: "Bot", timeout: 5000 }).setToken(env.DISCORD_TOKEN);
  const successfulAdds = new Set<bigint>();
  for (const message of messages) {
    try {
      console.log(`Assigning role ${message.body.roleId} to user ${message.body.userId} in guild ${message.body.guildId}`);
      await rest.put(Routes.guildMemberRole(message.body.guildId, message.body.userId, message.body.roleId));
      successfulAdds.add(BigInt(message.body.id));
    } catch (error) {
      console.error(`Failed to assign role for vote ID ${message.body.id}:`, error); // TODO: Find a way to dismiss "user not found" errors when applying role
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

  const rest = new REST({ version: "10", authPrefix: "Bot", timeout: 5000 }).setToken(env.DISCORD_TOKEN);
  const successfulRemovals = new Set<bigint>();
  for (const message of batch.messages) {
    try {
      console.log(`Removing role ${message.body.roleId} from user ${message.body.userId} in guild ${message.body.guildId}`);
      await rest.delete(Routes.guildMemberRole(message.body.guildId, message.body.userId, message.body.roleId)); // TODO: Find a way to dismiss "user not found" errors when removing role
      successfulRemovals.add(BigInt(message.body.id));
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
