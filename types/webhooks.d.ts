import type { APIVote, ForwardingCfg } from "../src/db/schema";

/** Discord Snowflake ID */
type Snowflake = string;

/**
 * Top.gg Webhook v1 Payload
 * @see {@link https://github.com/top-gg/webhooks-v2-nodejs-example}
 */
export interface TopGGV1Payload {
  type: "bot.vote" | "bot.test" | "server.vote" | "server.test" | string;
  data: {
    user: Snowflake;
    bot?: Snowflake;
    guild?: Snowflake;
    isWeekend?: boolean;
    query?: Record<string, string> | string;
  };
}

/**
 * Top.gg Legacy Webhook (v0)
 * @see {@link https://docs.top.gg/docs/Resources/webhooks/}
 */
export interface TopGGV0Payload {
  bot?: Snowflake;
  guild?: Snowflake;
  user: Snowflake;
  type: string;
  isWeekend?: boolean;
  query: Record<string, string> | string;
}

/**
 * Union type supporting both webhook versions
 */
export type TopGGPayload = TopGGV1Payload | TopGGV0Payload;

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
