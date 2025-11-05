interface WebhookPayload {
  /** If webhook is a bot: ID of the bot that received a vote */
  bot?: string;
  /** If webhook is a server: ID of the server that received a vote */
  guild?: string;
  /** ID of the user who voted */
  user: string;
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

export interface WebhookOptions {
  /**
   * Handles an error created by the function passed to Webhook.listener()
   *
   * @default console.error
   */
  error?: (error: Error) => void | Promise<void>;
}

/**
 * Top.gg Webhook for Cloudflare Workers
 *
 * @example
 * ```js
 * import { TopGGWebhook } from "./topggVerify";
 *
 * const wh = new TopGGWebhook("webhookauth123");
 *
 * export default {
 *   async fetch(request) {
 *     return wh.listener((vote) => {
 *       // vote is your vote object e.g
 *       console.log(vote.user); // => 321714991050784770
 *       return new Response("OK", { status: 200 });
 *     })(request);
 *   }
 * };
 *
 * // In this situation, your TopGG Webhook dashboard should look like
 * // URL = https://your.worker.dev/
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

  private async _parseRequest(request: Request): Promise<[WebhookPayload, null] | [null, Response]> {
    // Check authorization
    if (this.authorization && request.headers.get("authorization") !== this.authorization) {
      return [null, new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 })];
    }

    try {
      // Parse JSON body
      const body = await request.json<any>();
      return [this._formatIncoming(body), null];
    } catch (error) {
      return [null, new Response(JSON.stringify({ error: "Invalid body" }), { status: 400 })];
    }
  }

  /**
   * Listening function for handling webhook requests
   *
   * @example
   * ```js
   * export default {
   *   async fetch(request) {
   *     return wh.listener((vote) => {
   *       console.log(vote.user); // => 395526710101278721
   *       return new Response("OK", { status: 200 });
   *     })(request);
   *   }
   * };
   * ```
   *
   * @example
   * ```js
   * // Throwing an error to resend the webhook
   * export default {
   *   async fetch(request) {
   *     return wh.listener((vote) => {
   *       // for example, if your bot is offline, you should probably not handle votes and try again
   *       if (bot.offline) throw new Error('Bot offline');
   *       return new Response("OK", { status: 200 });
   *     })(request);
   *   }
   * };
   * ```
   *
   * @param fn Vote handling function, this function can also throw an error to
   *   allow for the webhook to resend from Top.gg
   * @returns A Workers-compatible handler function
   */
  public listener(fn: (payload: WebhookPayload, request: Request) => Response | Promise<Response>) {
    return async (request: Request): Promise<Response> => {
      const [payload, err] = await this._parseRequest(request);
      if (!payload) {
        // If the request was invalid, return the error response
        return err;
      }

      try {
        const res = await fn(payload, request);

        // If res is a Response, return it; otherwise, return 204 No Content
        if (res instanceof Response) {
          return res;
        }
        return new Response(null, { status: 204 });
      } catch (err) {
        if (err instanceof Error) this.options.error?.(err);

        return new Response(null, { status: 500 });
      }
    };
  }

  /**
   * Middleware function to parse and return the vote payload with the request
   *
   * @example
   * ```js
   * export default {
   *   async fetch(request) {
   *     const { request: req, vote } = await wh.middleware()(request);
   *     // vote is your payload e.g
   *     console.log(vote.user); // => 395526710101278721
   *     return new Response("OK", { status: 200 });
   *   }
   * };
   * ```
   */
  public middleware() {
    return async (request: Request) => {
      const [payload, err] = await this._parseRequest(request);
      if (err) {
        throw err; // Or handle error as needed
      }
      return { request, vote: payload };
    };
  }
}

export { TopGGWebhook, type WebhookPayload };
