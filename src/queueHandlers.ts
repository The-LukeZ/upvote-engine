import { QueueMessageBody } from "../types";

export async function handleVoteApply(batch: MessageBatch<QueueMessageBody>, env: Env): Promise<void> {
  console.log(`Processing vote apply batch with ${batch.messages.length} messages`);
  for (const message of batch.messages) {
    const body = message.body;
    console.log(`Applying vote for user ${body.userId} in guild ${body.guildId} at ${body.timestamp}`);
    // Add your vote application logic here
  }
}

export async function handleVoteRemove(batch: MessageBatch<QueueMessageBody>, env: Env): Promise<void> {
  console.log(`Processing vote remove batch with ${batch.messages.length} messages`);
  for (const message of batch.messages) {
    const body = message.body;
    console.log(`Removing vote for user ${body.userId} in guild ${body.guildId} at ${body.timestamp}`);
    // Add your vote removal logic here
  }
}
