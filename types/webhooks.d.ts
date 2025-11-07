import type { APIVote, ForwardingCfg } from "../src/db/schema";

/**
 * @see {@link https://docs.top.gg/docs/Resources/webhooks/#bot-webhooks}
 */
export interface TopGGPayload {
  /** If webhook is a bot: ID of the bot that received a vote */
  bot?: Snowflake;
  /** If webhook is a server: ID of the server that received a vote */
  guild?: Snowflake;
  /** ID of the user who voted */
  user: Snowflake;
  /**
   * The type of the vote (should always be "upvote" except when using the test
   * button it's "test")
   */
  type: string;
  /**
   * Whether the weekend multiplier is in effect, meaning users votes count as
   * two
   */
  isWeekend?: boolean;
  /** Query parameters in vote page in a key to value object */
  query:
    | {
        [key: string]: string;
      }
    | string;
}

/**
 * @see {@link https://docs.discordbotlist.com/vote-webhooks#request-body}
 */
export interface DBLPayload {
  /**
   * If the user is a site administrator
   */
  admin: boolean;
  /**
   * The avatar hash of the user
   */
  avatar: string;
  /**
   * The username of the user who voted
   */
  username: string;
  /**
   * The ID of the user who voted
   */
  id: Snowflake;
}

export type WebhookPayload = TopGGPayload | DBLPayload;

type WebhookPayloadMapping = {
  topgg: TopGGPayload;
  dbl: DBLPayload;
};

// The forwarding payload sent to other services
export type ForwardingPayload<TSource extends APIVote["source"] | "test"> = {
  /**
   * The time the vote was initially received
   *
   * ISO 8601 timestamp
   */
  timestamp: string;
  /**
   * The vote source.
   *
   * Always acknowledge "test" payloads with a `204 No Content` response. Normally,
   * just send a `200 OK` response with no body.
   *
   * If "test", indicates this is a test payload.
   * Otherwise, indicates the source platform of the vote.
   */
  source: TSource | "test";
  /**
   * The original webhook payload. Can be inferred based on the vote source.
   */
  payload: TSource extends "test" ? null : WebhookPayloadMapping[TSource];
};

export type MessageQueuePayload<TSource extends APIVote["source"]> = {
  /**
   * The time the forward was created
   */
  timestamp: string;
  /**
   * The forwarding payload containing the original vote data
   */
  forwardingPayload: ForwardingPayload<TSource>;
  /**
   * The forwarding configuration
   */
  to: ForwardingCfg;
};
