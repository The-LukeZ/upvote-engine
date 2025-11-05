import { IRequest } from "itty-router";

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

export async function topggVerify(req: IRequest, rawBody: string, whSecret: string): Promise<{ valid: boolean; data?: WebhookPayload }> {
  const receivedSig = req.headers.get("authorization");
  if (!receivedSig) {
    return { valid: false };
  }

  const encoder = new TextEncoder();
  const isValid = crypto.subtle.timingSafeEqual(encoder.encode(receivedSig), encoder.encode(whSecret));
  if (!isValid) {
    return { valid: false };
  }

  const data = JSON.parse(rawBody) as WebhookPayload;
  return { valid: true, data };
}
