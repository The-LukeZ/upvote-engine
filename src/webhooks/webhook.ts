import type { Next } from "hono";
import { MessageQueuePayload, WebhookPayload, WebhookPayloadMapping, WebhookSource } from "../../types/webhooks";
import { DrizzleDB, MyContext } from "../../types";
import { APIVote, forwardings } from "../db/schema";
import { eq } from "drizzle-orm";
import dayjs from "dayjs";

// This file has more convenience methods than actually needed, however this is to
// allow for future expansion and ease of use. (and maybe a little bit of "hey, I made a generic webhook handler for hono" flexing)

export interface WebhookOptions {
  /**
   * Handles an error created by the function passed to Webhook.listener()
   *
   * @default console.error
   */
  error?: (error: Error) => void | Promise<void>;
}

/**
 * Generic Webhook Handler for Hono (supports Top.gg, DBL)
 */
class WebhookHandler<T extends WebhookPayload> {
  public options: WebhookOptions;

  /**
   * Create a new webhook client instance
   *
   * @param authorization Webhook authorization to verify requests
   */
  constructor(private authorization?: string, options: WebhookOptions = {}) {
    this.options = {
      error: options.error ?? console.error,
    };
  }

  private _formatIncoming(body: T): T {
    const out: T = { ...body };
    return out;
  }

  /**
   * Validates the request and returns the payload if valid
   *
   * @param c The Hono context
   * @returns An object with isValid boolean and optional payload
   */
  public async validateRequest(c: MyContext): Promise<{ isValid: boolean; payload?: T }> {
    // Check authorization
    if (this.authorization && c.req.header("authorization") !== this.authorization) {
      return { isValid: false };
    }

    try {
      // Parse JSON body
      const body = await c.req.json();
      const payload = this._formatIncoming(body);
      return { isValid: true, payload };
    } catch (error) {
      return { isValid: false };
    }
  }

  public static async buildForwardPayload<TSource extends WebhookSource>(
    db: DrizzleDB,
    appId: string,
    source: TSource,
    payload: WebhookPayloadMapping[TSource],
  ): Promise<MessageQueuePayload<TSource> | undefined> {
    const forwardCfg = await db.select().from(forwardings).where(eq(forwardings.applicationId, appId)).limit(1).get();
    if (!forwardCfg) return undefined;

    return {
      to: forwardCfg,
      forwardingPayload: {
        source,
        payload: payload as any,
        timestamp: dayjs().toISOString(),
      },
      timestamp: dayjs().toISOString(),
    };
  }
}

export { WebhookHandler, type WebhookPayload };
