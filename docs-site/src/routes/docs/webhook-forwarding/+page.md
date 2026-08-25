---
title: Webhook Forwarding
description: Receive vote notifications at an endpoint of your choice.
section: Getting Started
order: 5
---

This document outlines the webhook forwarding feature, which allows you to receive vote notifications at an endpoint of your choice.

## Setup

Set it up with `/app forwarding set` — see [Permissions & Ownership](/docs/permissions/#who-can-configure-apps) for the authorization requirements. Setting it up sends a live test payload to your URL first, so your endpoint must already be reachable and returning `204` for test payloads before the configuration is saved.

### Security Notes

For your protection, you cannot forward to:

- localhost or private/loopback IP addresses
- UpvoteEngine's own domain
- Invalid or unreachable URLs (the target must resolve to a real hostname over HTTPS)

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

See [Webhook Payload Format](/docs/webhook-payloads/) for the full payload structure and how to handle requests.
