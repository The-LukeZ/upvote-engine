---
title: Webhook Payload Format
description: Payload structure and how to handle forwarded webhook requests.
section: Getting Started
order: 6
---

Your endpoint will receive a `POST` request with a `Content-Type` of `application/json`.
The `authorization` header will contain the secret you provided to UpvoteEngine.

The JSON body follows this structure:

<details>
  <summary>All types to use</summary>

```ts
// https://npmjs.com/topgg-api-types - my package with all important types for top.gg API
import type { Snowflake, WebhookPayload as TopggWebhookV1Payload } from "topgg-api-types/v1";
import type { BotWebhookPayload as TopggWebhookV0Payload } from "topgg-api-types/v0";

/**
 * Union type supporting both webhook versions
 */
type TopGGPayload = TopggWebhookV1Payload | TopggWebhookV0Payload;

type SupportedSources = "topgg" | "dbl" | "bumped";

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

/**
 * @see {@link https://bumped.gg/docs/api#payload}
 */
interface BumpedPayload {
  type: "vote.create" | "webhook.test";
  data: {
    /** Unique per vote */
    id: string;
    /** Always 1 for now */
    weight: number;
    /** RFC 3339 UTC */
    created_at: string;
    /** RFC 3339 UTC, when the user can vote again (12 hours after created_at) */
    expires_at: string;
    user: { id: string; platform_id: Snowflake; name: string; avatar_url: string };
    project: { id: string; type: string; platform: string; platform_id: Snowflake };
  };
}

type WebhookPayload = TopGGPayload | DBLPayload | BumpedPayload;

type WebhookPayloadMapping = {
  topgg: TopGGPayload;
  dbl: DBLPayload;
  bumped: BumpedPayload;
};

type WebhookSource<WithTest extends boolean = false> = WithTest extends true
  ? SupportedSources | "test"
  : SupportedSources;

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
```

</details>

## Handling Requests

Your endpoint should:

- **Verify the `authorization` header** to ensure the request is legitimate.
- **Parse the JSON body**.
- **Respond with a `200 OK` status code** within 5 seconds to acknowledge receipt. Any other status code or responding too late will trigger a retry.
- For test webhooks (`source: "test"`), you should respond with a `204 No Content` status code.
