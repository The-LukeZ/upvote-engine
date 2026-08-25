---
title: Webhook Forwarding
description: Receive vote notifications at an endpoint of your choice.
section: Getting Started
order: 1
---

<script>
  import { Callout } from 'svelte-docsmith';
</script>

# Webhook Forwarding

This document outlines the webhook forwarding feature, which allows you to receive vote notifications at an endpoint of your choice.

Set it up with `/app forwarding set` — see [Getting Started](/docs/getting-started/#forwarding-webhooks-advanced) for the command and its authorization requirements. Setting it up sends a live test payload to your URL first, so your endpoint must already be reachable and returning `204` for test payloads before the configuration is saved.

## Overview

Webhook forwarding takes incoming vote notifications from various platforms (like Top.gg, DBL, etc.), standardizes them into a consistent format, and forwards them to a URL you configure. This provides a reliable and secure way to process votes without exposing your own infrastructure directly to each service.

The system is designed for reliability, using a message queue with an exponential backoff retry mechanism to handle cases where your endpoint might be temporarily unavailable.

## How It Works

1. **Configuration**: You register a target URL and a secret token for your application within our system.
2. **Ingestion**: When we receive a vote for your application, we validate it.
3. **Queueing**: A new forwarding payload is created and placed into a message queue. This ensures that even if your server is down, the notification is not lost.
4. **Forwarding**: A queue worker picks up the message and sends a `POST` request to your configured URL. The request body contains the JSON payload, and the `authorization` header is set to your configured secret.
5. **Retry Logic**:
   - If the request to your endpoint fails (e.g., a non-2xx response or a timeout after 5 seconds), the system will automatically retry.
   - Retries follow an exponential backoff schedule: 30s, 1m, 2m, 5m, 10m, 30m, and finally 1 hour.
   - If a webhook notification is more than two hours old, it is considered stale and will be discarded without being sent.
   - If all retries fail, the message is dropped.

## Payload Structure

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
