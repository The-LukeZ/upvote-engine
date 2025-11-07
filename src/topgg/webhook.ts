import type { Next } from "hono";
import { MyContext, WebhookPayload } from "../../types";

// This file has more convenience methods than actually needed, however this is to
// allow for future expansion and ease of use. (and maybe a little bit of "hey, I made a topgg webhook handler for hono" flexing)

export interface WebhookOptions {
  /**
   * Handles an error created by the function passed to Webhook.listener()
   *
   * @default console.error
   */
  error?: (error: Error) => void | Promise<void>;
}

/**
 * Top.gg Webhook for Hono
 *
 * @example
 * ```js
 * import { Hono } from "hono";
 * import { Webhook } from "./webhook";
 *
 * const app = new Hono();
 * const wh = new Webhook("webhookauth123");
 *
 * app.post("/dblwebhook", wh.listener((vote) => {
 *   // vote is your vote object e.g
 *   console.log(vote.user); // => 321714991050784770
 * }));
 *
 * export default app;
 *
 * // In this situation, your TopGG Webhook dashboard should look like
 * // URL = http://your.server.ip:80/dblwebhook
 * // Authorization: webhookauth123
 * ```
 *
 * @link {@link https://docs.top.gg/resources/webhooks/#schema | Webhook Data Schema}
 * @link {@link https://docs.top.gg/resources/webhooks | Webhook Documentation}
 */
class TopGGWebhook {
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

  private _formatIncoming(body: WebhookPayload & { query: string }): WebhookPayload {
    const out: WebhookPayload = { ...body };
    if (body?.query?.length > 0) out.query = Object.fromEntries(new URLSearchParams(body.query));
    return out;
  }

  private async _parseRequest(c: MyContext): Promise<[WebhookPayload, null] | [null, Response]> {
    // Check authorization
    if (this.authorization && c.req.header("authorization") !== this.authorization) {
      c.status(403);
      return [null, c.json({ error: "Unauthorized" })];
    }

    try {
      // Parse JSON body
      const body = await c.req.json();
      return [this._formatIncoming(body), null];
    } catch (error) {
      c.status(400);
      return [null, c.json({ error: "Invalid body" })];
    }
  }

  /**
   * Listening function for handling webhook requests
   *
   * @example
   * ```js
   * app.post("/webhook", wh.listener((vote) => {
   *   console.log(vote.user); // => 395526710101278721
   * }));
   * ```
   *
   * @example
   * ```js
   * // Throwing an error to resend the webhook
   * app.post("/webhook/", wh.listener((vote) => {
   *   // for example, if your bot is offline, you should probably not handle votes and try again
   *   if (bot.offline) throw new Error('Bot offline');
   * }));
   * ```
   *
   * @param fn Vote handling function, this function can also throw an error to
   *   allow for the webhook to resend from Top.gg
   * @returns A Hono handler function
   */
  public listener(fn: (payload: WebhookPayload, c: MyContext, next: Next) => Response | Promise<Response>) {
    return async (c: MyContext, next: Next): Promise<Response> => {
      const [payload, err] = await this._parseRequest(c);
      if (!payload) {
        // If the request was invalid, return the error response
        return err;
      }

      try {
        const res = await fn(payload, c, next);

        // Return 204 No Content if no response was sent
        if (!c.finalized) {
          c.status(204);
          return c.body(null);
        }

        return c.res;
      } catch (err) {
        if (err instanceof Error) this.options.error?.(err);

        c.status(500);
        return c.body(null);
      }
    };
  }

  /**
   * Middleware function to pass to Hono, sets c.var.vote to the payload
   *
   * @example
   * ```js
   * app.post("/dblwebhook", wh.middleware(), (c) => {
   *   // c.var.vote is your payload e.g
   *   console.log(c.var.vote.user); // => 395526710101278721
   *   return c.text("OK");
   * });
   * ```
   */
  public middleware() {
    return async (c: MyContext, next: Next): Promise<void> => {
      const response = await this._parseRequest(c);
      if (!response) return;

      // Store the vote payload in context variables
      c.set("vote", response[0]!);
      await next();
    };
  }

  /**
   * Validates the request and returns the payload if valid
   *
   * @param c The Hono context
   * @returns An object with isValid boolean and optional payload
   */
  public async validateRequest(c: MyContext): Promise<{ isValid: boolean; payload?: WebhookPayload }> {
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
}

export { TopGGWebhook, type WebhookPayload };
