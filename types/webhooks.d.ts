import type { APIVote, ForwardingCfg } from "../src/db/schema";
import type { Snowflake, WebhookPayload as TopggWebhookV1Payload } from "topgg-api-types/v1";
import type { BotWebhookPayload as TopggWebhookV0Payload } from "topgg-api-types/v0";

/**
 * Union type supporting both webhook versions
 */
export type TopGGPayload = TopggWebhookV1Payload | TopggWebhookV0Payload;

/**
 * DiscordBotList webhook payload
 * @see {@link https://docs.discordbotlist.com/vote-webhooks#request-body}
 */
export interface DBLPayload {
  admin: boolean;
  avatar: string;
  username: string;
  id: Snowflake;
}

export type WebhookPayload = TopGGPayload | DBLPayload;

type WebhookPayloadMapping = {
  topgg: TopGGPayload;
  dbl: DBLPayload;
};

export type WebhookSource<WithTest extends boolean = false> = WithTest extends true ? APIVote["source"] | "test" : APIVote["source"];

/**
 * Forwarding payload sent to external services
 */
export type ForwardingPayload<TSource extends WebhookSource<true>> = {
  timestamp: string;
  source: TSource;
  payload: TSource extends "test" ? null : WebhookPayloadMapping[TSource];
};

export type MessageQueuePayload<TSource extends WebhookSource> = {
  timestamp: string;
  forwardingPayload: ForwardingPayload<TSource>;
  to: ForwardingCfg;
};
