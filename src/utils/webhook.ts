import { ForwardingQueuePayload, WebhookPayload, WebhookPayloadMapping, WebhookSource } from "../../types/webhooks";
import { DrizzleDB, MyContext } from "../../types";
import { forwardings } from "../db/schema";
import { eq } from "drizzle-orm";
import dayjs from "dayjs";
import crypto from "crypto";

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
  constructor(
    private authorization?: string,
    options: WebhookOptions = {},
  ) {
    this.options = {
      error: options.error ?? console.error,
    };
  }

  private _formatIncoming(body: T): T {
    const out: T = { ...body };
    return out;
  }

  /**
   * Verifies v1 webhook signature using HMAC SHA-256
   */
  async verifyV1Signature(signature: string, timestamp: string, rawBody: string, secret: string): Promise<boolean> {
    const encoder = new TextEncoder();

    // Encode the secret and the message
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(`${timestamp}.${rawBody}`);

    const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

    const hmacSignature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);

    const digest = Array.from(new Uint8Array(hmacSignature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const signatureBuffer = Buffer.from(signature, "hex");
    const digestBuffer = Buffer.from(digest, "hex");

    if (signatureBuffer.length !== digestBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, digestBuffer);
  }

  /**
   * v1-specific validation with Web Crypto
   */
  private async validateV1Request(c: MyContext): Promise<{ isValid: boolean; payload?: T; version?: "v1" }> {
    // Parse signature: t={timestamp},v1={signature}
    const signatureHeader = c.req.header("x-topgg-signature") || "";
    console.log(`Received v1 webhook with signature header: ${signatureHeader}`);
    const parts = signatureHeader.split(",").map((p) => {
      const idx = p.indexOf("=");
      return [p.slice(0, idx), p.slice(idx + 1)];
    });
    const sigObj = Object.fromEntries(parts);
    const timestamp = sigObj["t"];
    const signature = sigObj["v1"];

    if (!timestamp || !signature) {
      console.error("Invalid signature format: missing timestamp or signature");
      return { isValid: false };
    }

    // Get raw body for signature verification
    const rawBody = await c.req.text();

    if (!this.authorization) {
      console.error("No webhook secret configured");
      return { isValid: false };
    }

    console.log(`Secret prefix: "${this.authorization.substring(0, 8)}", length: ${this.authorization.length}`);
    console.log(`Timestamp: "${timestamp}", Signature: "${signature.substring(0, 8)}..."`);
    console.log(`Raw body length: ${rawBody.length}, preview: "${rawBody.substring(0, 50)}"`);

    // Verify signature using Web Crypto API
    const isValidSignature = await this.verifyV1Signature(signature, timestamp, rawBody, this.authorization);

    console.log(`Signature verification result: ${isValidSignature}`);
    if (!isValidSignature) {
      console.error("Signature verification failed");
      return { isValid: false };
    }

    try {
      const payload = JSON.parse(rawBody) as T;
      return { isValid: true, payload, version: "v1" };
    } catch (error) {
      console.error("Failed to parse webhook payload:", error);
      return { isValid: false };
    }
  }
  public async validateRequest(c: MyContext): Promise<{ isValid: boolean; payload?: T; version?: "v0" | "v1" }> {
    const traceHeader = c.req.header("x-topgg-trace");
    console.log(`Received webhook request with trace header: ${traceHeader}`);

    // v1 webhook detection
    if (!!traceHeader) {
      console.log("Detected v1 webhook with trace header");
      const result = await this.validateV1Request(c);
      console.log(`v1 validation result: ${result.isValid}, version: ${result.version}`);
      return result;
    }

    // Fall back to v0 (legacy) validation
    console.log("Using legacy v0 webhook validation");
    const authHeader = c.req.header("authorization");
    if (this.authorization && authHeader !== this.authorization) {
      console.error("v0 authorization header mismatch");
      return { isValid: false };
    }

    try {
      const body = await c.req.json();
      const payload = this._formatIncoming(body);
      return { isValid: true, payload, version: "v0" };
    } catch (error) {
      console.error("Failed to parse v0 webhook payload:", error);
      return { isValid: false };
    }
  }

  public static async buildForwardPayload<TSource extends WebhookSource>(
    db: DrizzleDB,
    appId: string,
    source: TSource,
    payload: WebhookPayloadMapping[TSource],
  ): Promise<ForwardingQueuePayload<TSource> | undefined> {
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
