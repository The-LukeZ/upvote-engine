// test-signature.ts
import { describe, expect, it } from "vitest";
import { WebhookHandler } from "../routes/webhooks/webhook";

describe("TopGG v1 signature verification", () => {
  it("should verify a valid signature", async () => {
    const secret = "test_secret";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = JSON.stringify({ type: "bot.test", data: { user: "123456789" } });
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(`${timestamp}.${payload}`);

    const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    console.log(`x-topgg-signature: t=${timestamp},v1=${signature}`);

    const handler = new WebhookHandler(secret);
    const isValid = await handler.verifyV1Signature(signature, timestamp, payload, secret);
    expect(isValid).toBe(true);
  });
});
