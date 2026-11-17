import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebhookHandler } from "../utils/webhook";
import { MyContext } from "$types";
import crypto from "crypto";

describe("WebhookHandler", () => {
  let handler: WebhookHandler<any>;
  let mockContext: MyContext;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new WebhookHandler("test-secret");
    mockContext = {
      req: {
        header: vi.fn(),
        text: vi.fn(),
        json: vi.fn(),
      },
    } as any;
  });

  describe("constructor", () => {
    it("should initialize with authorization and default options", () => {
      const h = new WebhookHandler("secret");
      expect(h.options.error).toBe(console.error);
    });

    it("should initialize with custom error handler", () => {
      const customError = vi.fn();
      const h = new WebhookHandler("secret", { error: customError });
      expect(h.options.error).toBe(customError);
    });
  });

  describe("verifyV1Signature", () => {
    it("should verify a valid v1 signature", async () => {
      const secret = "whs_5b79ab7ca91cbea7826105240ba53547a00a7db3703ce4eef54b12d0b70d504c"; // test secret, not real
      const timestamp = "1771937884";
      const rawBody = JSON.stringify({
        type: "vote.create",
        data: {
          id: "808499215864008704",
          weight: 1,
          created_at: "2026-02-09T00:47:14.2510149+00:00",
          expires_at: "2026-02-09T12:47:14.2510149+00:00",
          project: {
            id: "1082707872565182614",
            type: "bot",
            platform: "discord",
            platform_id: "1082707872565182614",
          },
          user: {
            id: "506893652266844162",
            platform_id: "506893652266844162",
            name: "thelukez",
            avatar_url: "https://example.com",
          },
        },
      });

      const encoder = new TextEncoder();
      const keyData = new Uint8Array(encoder.encode(secret));
      const messageData = new Uint8Array(encoder.encode(`${timestamp}.${rawBody}`));
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
      const signature = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const result = await handler.verifyV1Signature(signature, timestamp, rawBody, secret);
      expect(result).toBe(true);
    });

    it("should reject an invalid v1 signature", async () => {
      const result = await handler.verifyV1Signature(
        "1234134132412412412415346456869",
        "1234567890",
        '{"test":"data"}',
        "test-secret",
      );
      expect(result).toBe(false);
    });
  });

  describe("validateRequest", () => {
    it("should validate v0 (legacy) webhook with correct authorization", async () => {
      const mockPayload = { userId: "123" };
      vi.mocked(mockContext.req.header).mockImplementation((key?: string) => {
        if (key === "x-topgg-trace") return undefined;
        if (key === "authorization") return "test-secret";
        return undefined as any;
      });
      vi.mocked(mockContext.req.json).mockResolvedValue(mockPayload);

      const result = await handler.validateRequest(mockContext);
      expect(result.isValid).toBe(true);
      expect(result.version).toBe("v0");
      expect(result.payload).toEqual(mockPayload);
    });

    it("should reject v0 webhook with incorrect authorization", async () => {
      vi.mocked(mockContext.req.header).mockImplementation((key?: string) => {
        if (key === "authorization") return "wrong-secret";
        return undefined as any;
      });

      const result = await handler.validateRequest(mockContext);
      expect(result.isValid).toBe(false);
    });

    it("should handle v0 webhook parse errors", async () => {
      vi.mocked(mockContext.req.header).mockImplementation((key?: string) => {
        if (key === "authorization") return "test-secret";
        return undefined as any;
      });
      vi.mocked(mockContext.req.json).mockRejectedValue(new Error("Invalid JSON"));

      const result = await handler.validateRequest(mockContext);
      expect(result.isValid).toBe(false);
    });

    it("should detect and validate v1 webhook", async () => {
      const secret = "whs_5b79ab7ca91cbea7826105240ba53547a00a7db3703ce4eef54b12d0b70d504c"; // test secret, not real
      handler = new WebhookHandler(secret);
      const timestamp = "1771937884";
      const rawBody = JSON.stringify({
        type: "vote.create",
        data: {
          id: "808499215864008704",
          weight: 1,
          created_at: "2026-02-09T00:47:14.2510149+00:00",
          expires_at: "2026-02-09T12:47:14.2510149+00:00",
          project: {
            id: "1082707872565182614",
            type: "bot",
            platform: "discord",
            platform_id: "1082707872565182614",
          },
          user: {
            id: "506893652266844162",
            platform_id: "506893652266844162",
            name: "thelukez",
            avatar_url: null,
          },
        },
      });

      const encoder = new TextEncoder();
      const keyData = new Uint8Array(encoder.encode(secret));
      const messageData = new Uint8Array(encoder.encode(`${timestamp}.${rawBody}`));
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
      const signature = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const signatureHeader = `t=${timestamp},v1=${signature}`;

      vi.mocked(mockContext.req.header).mockImplementation((key?: string) => {
        if (key === "x-topgg-trace") return "trace-value";
        if (key === "x-topgg-signature") return signatureHeader;
        return undefined as any;
      });
      vi.mocked(mockContext.req.text).mockResolvedValue(rawBody);

      const result = await handler.validateRequest(mockContext);
      expect(result.isValid).toBe(true);
      expect(result.version).toBe("v1");
    });

    it("should reject v1 webhook with missing timestamp or signature", async () => {
      vi.mocked(mockContext.req.header).mockImplementation((key?: string) => {
        if (key === "x-topgg-trace") return "trace-value";
        if (key === "x-topgg-signature") return "v1=invalid";
        return undefined as any;
      });

      const result = await handler.validateRequest(mockContext);
      expect(result.isValid).toBe(false);
    });
  });
  describe("validateBumpedRequest", () => {
    const secret = "bumped-test-secret"; // test secret, not real
    const rawBody = JSON.stringify({
      type: "vote.create",
      data: {
        id: "vote_123",
        weight: 1,
        created_at: "2026-11-18T10:00:00Z",
        expires_at: "2026-11-18T22:00:00Z",
        user: {
          id: "506893652266844162",
          platform_id: "506893652266844162",
          name: "thelukez",
          avatar_url: "",
        },
        project: {
          id: "1082707872565182614",
          type: "bot",
          platform: "discord",
          platform_id: "1082707872565182614",
        },
      },
    });

    async function sign(timestamp: string, body: string, key = secret) {
      const enc = new TextEncoder();
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        new Uint8Array(enc.encode(key)),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const sig = await crypto.subtle.sign(
        "HMAC",
        cryptoKey,
        new Uint8Array(enc.encode(`${timestamp}.${body}`)),
      );
      return Buffer.from(sig).toString("hex");
    }

    function mockRequest(signatureHeader: string | undefined, body = rawBody) {
      vi.mocked(mockContext.req.header).mockImplementation((key?: string) =>
        key === "x-bumped-signature" ? signatureHeader : (undefined as any),
      );
      vi.mocked(mockContext.req.text).mockResolvedValue(body);
    }

    beforeEach(() => {
      handler = new WebhookHandler(secret);
    });

    it("accepts a valid, fresh signature", async () => {
      const t = String(Math.floor(Date.now() / 1000));
      mockRequest(`t=${t},v1=${await sign(t, rawBody)}`);
      const result = await handler.validateBumpedRequest(mockContext);
      expect(result.isValid).toBe(true);
      expect(result.payload?.data.user.platform_id).toBe("506893652266844162");
    });

    it("rejects a signature made with another secret", async () => {
      const t = String(Math.floor(Date.now() / 1000));
      mockRequest(`t=${t},v1=${await sign(t, rawBody, "other-secret")}`);
      expect((await handler.validateBumpedRequest(mockContext)).isValid).toBe(false);
    });

    it("rejects a tampered body", async () => {
      const t = String(Math.floor(Date.now() / 1000));
      mockRequest(`t=${t},v1=${await sign(t, rawBody)}`, rawBody.replace("506893652266844162", "1"));
      expect((await handler.validateBumpedRequest(mockContext)).isValid).toBe(false);
    });

    it("rejects timestamps older than 5 minutes", async () => {
      const t = String(Math.floor(Date.now() / 1000) - 301);
      mockRequest(`t=${t},v1=${await sign(t, rawBody)}`);
      expect((await handler.validateBumpedRequest(mockContext)).isValid).toBe(false);
    });

    it("rejects missing or malformed headers", async () => {
      mockRequest(undefined);
      expect((await handler.validateBumpedRequest(mockContext)).isValid).toBe(false);
      mockRequest("v1=abc");
      expect((await handler.validateBumpedRequest(mockContext)).isValid).toBe(false);
      mockRequest("t=0,v1=abc");
      expect((await handler.validateBumpedRequest(mockContext)).isValid).toBe(false);
    });
  });
});
