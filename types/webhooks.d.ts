import type { APIVote, ForwardingCfg } from "$/db/schema";
import type { Snowflake, WebhookPayload as TopggWebhookV1Payload } from "topgg-api-types/v1";

/**
 * Top.gg's legacy (pre-2024) webhook payload shape.
 *
 * @deprecated Removed from `topgg-api-types` as of v2.0.0 (the package now only tracks Top.gg's
 * current v1 webhook format). Inlined here since we still accept these payloads on the `/v0` and
 * unversioned legacy routes; support ends end of 2026, see README.
 * @see https://docs.top.gg/webhooks/events#legacy-v0-webhook-events
 */
export interface TopggWebhookV0Payload {
  /**
   * Discord ID of the bot that received a vote.
   */
  bot: Snowflake;
  /**
   * Discord ID of the user that voted.
   */
  user: Snowflake;
  /**
   * The type of the vote (should always be "upvote" except when using the test button it's "test").
   */
  type: "upvote" | "test";
  /**
   * Whether the weekend multiplier is in effect, meaning users votes count as two.
   */
  isWeekend: boolean;
  /**
   * Query string params found on the /bot/:ID/vote page.
   *
   * @example
   * "?a=1&b=2&c=3"
   */
  query?: string;
}

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
  /**
   * Discord user ID of the voter
   */
  id: Snowflake;
}

export type WebhookPayload = TopGGPayload | DBLPayload;

type WebhookPayloadMapping = {
  topgg: TopGGPayload;
  dbl: DBLPayload;
};

export type WebhookSource<WithTest extends boolean = false> = WithTest extends true
  ? APIVote["source"] | "test"
  : APIVote["source"];

/**
 * Forwarding payload sent to external services
 */
export type ForwardingPayload<TSource extends WebhookSource<true>> = {
  timestamp: string;
  source: TSource;
  payload: TSource extends "test" ? null : WebhookPayloadMapping[TSource];
};

export type ForwardingQueuePayload<TSource extends WebhookSource> = {
  timestamp: string;
  forwardingPayload: ForwardingPayload<TSource>;
  to: ForwardingCfg;
};
