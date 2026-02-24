import dayjs from "dayjs";
import { NonNullableFields, QueueMessageBody } from "../types";
import { APIVote, votes, Cryptor } from "./db/schema";
import { makeDB } from "./db/util";
import { DiscordAPIError, REST } from "@discordjs/rest";
import { and, eq, gt, inArray, isNotNull } from "drizzle-orm";
import { RESTJSONErrorCodes, Routes } from "discord-api-types/v10";
import { ForwardingPayload, ForwardingQueuePayload } from "../types/webhooks";
import { delaySeconds } from "./utils";
import { votes as votesTable } from "./db/schema";

export async function handleVoteApply(batch: MessageBatch<QueueMessageBody>, env: Env): Promise<void> {
  const db = makeDB(env.vote_handler);
  const votes = await db
    .select()
    .from(votesTable)
    .where(
      and(
        inArray(
          votesTable.id,
          batch.messages.map((msg) => msg.body.id),
        ),
        isNotNull(votesTable.roleId),
        isNotNull(votesTable.guildId),
      ),
    );
  const voteMessageDetails = new Map(batch.messages.map((vote) => [vote.body.id, vote]));
  const mergedVotes = votes.map((vote) => ({
    ...(vote as NonNullableFields<typeof vote>),
    timestamp: voteMessageDetails.get(vote.id.toString())!.body.timestamp,
  }));
  for (const vote of mergedVotes) {
    console.log(`Applying vote for user ${vote.userId} in guild ${vote.guildId} at ${vote.timestamp}`);
  }

  const ackMessage = (voteId: string) => {
    const message = batch.messages.find((msg) => msg.body.id === voteId);
    if (message) {
      message.ack();
    } else {
      console.warn(`Could not find message for vote ID ${voteId} to acknowledge`);
    }
  };
  const retryMessage = (voteId: string, delaySeconds?: number) => {
    const message = batch.messages.find((msg) => msg.body.id === voteId);
    if (message) {
      message.retry({ delaySeconds });
    } else {
      console.warn(`Could not find message for vote ID ${voteId} to retry`);
    }
  };

  // filter out messages older than 12 hours to avoid applying expired votes
  const twelveHoursAgo = dayjs().subtract(12, "hour");
  const messages = mergedVotes.filter((vote) => dayjs(vote.timestamp).isAfter(twelveHoursAgo));
  const validMessages = messages.filter((vote) => vote.id != null && vote.id !== undefined);
  if (validMessages.length !== messages.length) {
    console.warn(`Filtered out ${messages.length - validMessages.length} messages with invalid id`);
  }
  if (validMessages.length === 0) {
    console.log("No valid messages to process after filtering. Exiting.");
    return;
  }

  const rest = new REST({ version: "10", authPrefix: "Bot", timeout: 5000 }).setToken(env.DISCORD_TOKEN);
  const successfulAdds = new Set<string>();
  for (const vote of validMessages) {
    try {
      console.log(`Assigning role ${vote.roleId} to user ${vote.userId} in guild ${vote.guildId}`);
      await rest.put(Routes.guildMemberRole(vote.guildId, vote.userId, vote.roleId));
      successfulAdds.add(vote.id);
      ackMessage(vote.id);
    } catch (error) {
      if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownMember) {
        ackMessage(vote.id);
        console.warn(`User ${vote.userId} not found in guild ${vote.guildId}, acknowledging message.`);
        continue;
      }
      console.error(`Failed to assign role for vote ID ${vote.id}:`, error);
      retryMessage(vote.id, 60);
    }
  }

  // Bulk update hasRole status for successfully assigned roles, we don't assume this can fail, so we acknowledge before
  if (successfulAdds.size > 0) {
    await db
      .update(votesTable)
      .set({ hasRole: true })
      .where(inArray(votesTable.id, Array.from(successfulAdds)));
  }
}

export async function handleVoteRemove(batch: MessageBatch<QueueMessageBody>, env: Env): Promise<void> {
  console.log(`Processing vote remove batch with ${batch.messages.length} messages`);
  const db = makeDB(env.vote_handler);
  const currentTs = dayjs().toISOString();

  // Query database for votes matching batch message IDs
  const votes_list = await db
    .select()
    .from(votes)
    .where(
      and(
        inArray(
          votes.id,
          batch.messages.map((msg) => msg.body.id),
        ),
        isNotNull(votes.roleId),
        isNotNull(votes.guildId),
      ),
    );

  // Create a map of message payloads
  const voteMessageDetails = new Map(batch.messages.map((vote) => [vote.body.id, vote]));

  // Merge database votes with message payloads
  const mergedVotes = votes_list.map((vote) => ({
    ...(vote as NonNullableFields<typeof vote>),
    timestamp: voteMessageDetails.get(vote.id.toString())!.body.timestamp,
  }));

  // Collect unique user/guild/role combinations from merged votes
  const combinations = new Map<string, { guildId: string; userId: string; roleId: string; messageid: string }>();
  const voteIds = new Set<string>();

  for (const vote of mergedVotes) {
    console.log(`Processing removal for user ${vote.userId} in guild ${vote.guildId} at ${vote.timestamp}`);
    const key = `${vote.guildId}-${vote.userId}-${vote.roleId}`;
    if (!combinations.has(key)) {
      combinations.set(key, { guildId: vote.guildId, userId: vote.userId, roleId: vote.roleId, messageid: vote.id.toString() });
    }
    voteIds.add(vote.id);
  }

  const rest = new REST({ version: "10", authPrefix: "Bot", timeout: 5000 }).setToken(env.DISCORD_TOKEN);

  // For each unique combination, check if there are active votes and remove role if not
  const removals = { success: new Set<string>(), retry: new Map<string, number>(), ack: new Set<string>() };
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
        if (
          error instanceof DiscordAPIError &&
          (error.code === RESTJSONErrorCodes.UnknownGuild || error.code === RESTJSONErrorCodes.UnknownMember)
        ) {
          console.warn(`Guild or member not found for user ${combo.userId} in guild ${combo.guildId}, acknowledging message.`);
          removals.ack.add(combo.messageid);
        } else {
          console.error(`Failed to remove role for user ${combo.userId} in guild ${combo.guildId}:`, error);
          const message = batch.messages.find((msg) => msg.body.id === combo.messageid);
          if (!message) continue;
          const delay = delaySeconds[message.attempts]; // Exponential backoff
          if (delay === undefined) {
            console.warn(
              `Max retry attempts exceeded for role removal of user ${combo.userId} in guild ${combo.guildId}, acknowledging message.`,
            );
            removals.ack.add(combo.messageid);
          } else {
            removals.retry.set(combo.messageid, delay); // Store delay for retry
          }
        }
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
    batch.messages.find((msg) => msg.body.id === msgid)?.ack();
  }
  for (const msgid of removals.ack) {
    batch.messages.find((msg) => msg.body.id === msgid)?.ack();
  }
  for (const [msgid, delay] of removals.retry) {
    // Updated: Use stored delay
    batch.messages.find((msg) => msg.body.id === msgid)?.retry({ delaySeconds: delay });
  }
}

// This queue handler processes forwarding webhook payloads other services
export async function handleForwardWebhook(batch: MessageBatch<ForwardingQueuePayload<APIVote["source"]>>, env: Env): Promise<void> {
  console.log(`Processing webhook forward batch with ${batch.messages.length} messages`);
  const cryptor = new Cryptor(env.ENCRYPTION_KEY);

  for (const message of batch.messages) {
    const body = message.body;
    // If timestamp is older than 2 hours, ack and skip
    const twoHoursAgo = dayjs().subtract(2, "hour");
    if (dayjs(body.timestamp).isBefore(twoHoursAgo)) {
      console.log(`Skipping old webhook payload with timestamp ${body.timestamp}`);
      message.ack();
      continue;
    }

    try {
      console.log(`Forwarding webhook payload to ${body.to.targetUrl}`);

      // Decrypt the secret before using it
      const decryptedSecret = await cryptor.decryptToken(body.to.secret, body.to.iv);

      const response = await fetch(body.to.targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: decryptedSecret,
        },
        body: JSON.stringify({
          ...body.forwardingPayload,
        } satisfies ForwardingPayload<APIVote["source"]>),
        signal: AbortSignal.timeout(5000), // wait 5 seconds max
      });

      if (!response.ok) {
        throw new Error(`Failed to forward webhook payload, received status ${response.status}`);
      }

      console.log(`Successfully forwarded webhook payload to ${body.to.targetUrl}`);
      message.ack();
    } catch (error) {
      console.error(`Failed to forward webhook payload to ${body.to.targetUrl}:`, error);
      const delay = delaySeconds[message.attempts]; // Exponential backoff between 30s and 1h
      // ack and skip if delay is undefined (max attempts reached = out of bounds)
      if (delay === undefined) {
        console.warn(`Max retry delay exceeded for webhook payload to ${body.to.targetUrl}, acknowledging message.`);
        message.ack();
        continue;
      }

      message.retry({ delaySeconds: delay });
      continue;
    }
  }
}
