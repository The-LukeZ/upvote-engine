import type { APIVote, ForwardingCfg } from "../src/db/schema";

/** Discord Snowflake ID */
type Snowflake = string;

/**
 * Top.gg Webhook v1 Payload
 * @see {@link https://github.com/top-gg/webhooks-v2-nodejs-example}
 */
export interface TopGGV1Payload {
  type: "bot.vote" | "webhook.test" | "server.vote" | string;
  data: {
    /** Event ID */
    id: Snowflake;
    user: {
      /** Top.gg ID */
      id: Snowflake;
      /** Discord ID */
      platform_id: Snowflake;
      /** Username */
      name: string;
      avatar_url: string;
    };
    /**
     * The number of votes this vote counted for. This is a rounded integer value which determines how many points this individual vote was worth.
     */
    weight: number;
    /** Timestamp of when the vote was cast. */
    created_at: string;
    /** Timestamp of when the user can vote again. */
    expires_at: string;
    project: {
      /** Top.gg ID */
      id: Snowflake;
      /** The project type */
      type: "bot" | "server";
      /**
       * The platform the project belongs to.
       *
       * Always "discord" for discord bots and servers,
       */
      platform: "discord" | "roblox"; // get outta here roblox
      /**
       * The ID of the project on the platform it belongs to.
       */
      platform_id: Snowflake;
    };
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
