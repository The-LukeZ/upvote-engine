// Types for the wiki

// https://npmjs.com/topgg-api-types - my package with all important types for top.gg API
import type { Snowflake, WebhookPayload as TopggWebhookV1Payload } from "topgg-api-types/v1";
import type { BotWebhookPayload as TopggWebhookV0Payload } from "topgg-api-types/v0";

/**
 * Union type supporting both webhook versions
 */
type TopGGPayload = TopggWebhookV1Payload | TopggWebhookV0Payload;

type SupportedSources = "topgg" | "dbl";

/**
 * @see {@link https://docs.discordbotlist.com/vote-webhooks#request-body}
 */
interface DBLPayload {
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

type WebhookPayload = TopGGPayload | DBLPayload;

type WebhookPayloadMapping = {
  topgg: TopGGPayload;
  dbl: DBLPayload;
};

type WebhookSource<WithTest extends boolean = false> = WithTest extends true ? SupportedSources | "test" : SupportedSources;

// The forwarding payload sent to other services
type ForwardingPayload<TSource extends WebhookSource<true>> = {
  /**
   * An ISO 8601 string indicating when the original vote was received by our service.
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
  source: TSource;
  /**
   * The original, unmodified JSON payload from the source platform. Its structure will vary depending on the `source`.
   *
   * If `source` is `test`, this field will be `null`.
   */
  payload: TSource extends "test" ? null : WebhookPayloadMapping[TSource];
};
