import type { Next } from "hono";
import { WebhookPayload } from "../../types/webhooks";
import { MyContext } from "../../types";

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

  private _formatIncoming(body: T & { query: string }): T {
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

  public buildForwardPayload(payload: any): any {}
}

export { WebhookHandler, type WebhookPayload };
