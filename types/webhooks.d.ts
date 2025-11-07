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

export type MessageQueuePayload<TSource extends APIVote["source"]> = {
  /**
   * The time the forward was created
   */
  timestamp: string;
  /**
   * The original webhook payload. Can be inferred based on the vote source.
   */
  payload: WebhookPayloadMapping[TSource];
  to: ForwardingCfg;
};
