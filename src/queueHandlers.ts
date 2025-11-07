import dayjs from "dayjs";
import { QueueMessageBody } from "../types";
import { votes } from "./db/schema";
import { makeDB } from "./db/util";
import { REST } from "@discordjs/rest";
import { and, eq, gt, inArray, isNotNull } from "drizzle-orm";
import { Routes } from "discord-api-types/v10";
import { ForwardPayload, MessageQueuePayload } from "../types/webhooks";

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
      ...message.body,
      id: BigInt(message.body.id),
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
      message.ack();
    } catch (error) {
      console.error(`Failed to assign role for vote ID ${message.body.id}:`, error); // TODO: Find a way to dismiss "user not found" errors when applying role
    }
  }

  // Bulk update hasRole status for successfully assigned roles, we don't assume this can fail, so we acknowledge before
  if (successfulAdds.size > 0) {
    await db
      .update(votes)
      .set({ hasRole: true })
      .where(inArray(votes.id, Array.from(successfulAdds)));
  }
}

export async function handleVoteRemove(batch: MessageBatch<QueueMessageBody>, env: Env): Promise<void> {
  console.log(`Processing vote remove batch with ${batch.messages.length} messages`);
  const db = makeDB(env);
  const currentTs = dayjs().toISOString();

  // Collect unique user/guild/role combinations from the batch
  const combinations = new Map<string, { guildId: string; userId: string; roleId: string; messageid: string }>();
  const voteIds = new Set<bigint>();

  for (const message of batch.messages) {
    const body = message.body;
    console.log(`Processing removal for user ${body.userId} in guild ${body.guildId} at ${body.timestamp}`);
    const key = `${body.guildId}-${body.userId}-${body.roleId}`;
    if (!combinations.has(key)) {
      combinations.set(key, { guildId: body.guildId, userId: body.userId, roleId: body.roleId, messageid: message.id });
    }
    voteIds.add(BigInt(body.id));
  }

  const rest = new REST({ version: "10", authPrefix: "Bot", timeout: 5000 }).setToken(env.DISCORD_TOKEN);

  // For each unique combination, check if there are active votes and remove role if not
  const removals = { success: new Set<string>(), retry: new Set<string>() };
  for (const combo of combinations.values()) {
    const activeVotes = await db
      .select()
      .from(votes)
      .where(
        and(
          eq(votes.guildId, combo.guildId),
          eq(votes.userId, combo.userId),
          eq(votes.roleId, combo.roleId),
          eq(votes.hasRole, true),
          isNotNull(votes.expiresAt),
          gt(votes.expiresAt, currentTs),
        ),
      );

    if (activeVotes.length === 0) {
      try {
        console.log(`Removing role ${combo.roleId} from user ${combo.userId} in guild ${combo.guildId} (no active votes left)`);
        await rest.delete(Routes.guildMemberRole(combo.guildId, combo.userId, combo.roleId));
        removals.success.add(combo.messageid);
      } catch (error) {
        console.error(`Failed to remove role for user ${combo.userId} in guild ${combo.guildId}:`, error);
        removals.retry.add(combo.messageid);
      }
    } else {
      console.log(`Skipping role removal for user ${combo.userId} in guild ${combo.guildId} (${activeVotes.length} active votes remain)`);
    }
  }

  // Update hasRole to false for all votes in the batch
  if (voteIds.size > 0) {
    await db
      .update(votes)
      .set({ hasRole: false })
      .where(inArray(votes.id, Array.from(voteIds)));
  }

  for (const msgid of removals.success) {
    batch.messages.find((msg) => msg.id === msgid)?.ack();
  }
  for (const msgid of removals.retry) {
    batch.messages.find((msg) => msg.id === msgid)?.retry({ delaySeconds: 60 });
  }
}

// This queue handler processes forwarding webhook payloads other services
export async function handleForwardWebhook(batch: MessageBatch<MessageQueuePayload>, env: Env): Promise<void> {
  console.log(`Processing webhook forward batch with ${batch.messages.length} messages`);
  for (const message of batch.messages) {
    const body = message.body;
  }
}
