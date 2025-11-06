import { QueueMessageBody } from "../types";

export async function handleVoteApply(batch: MessageBatch<QueueMessageBody>, env: Env): Promise<void> {
  console.log(`Processing vote apply batch with ${batch.messages.length} messages`);
}

export async function handleVoteRemove(batch: MessageBatch<QueueMessageBody>, env: Env): Promise<void> {
  console.log(`Processing vote remove batch with ${batch.messages.length} messages`);
}
