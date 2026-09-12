import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  generatePkcePair,
  encodeTopggOAuthState,
  decodeTopggOAuthState,
  getTopggOAuthRedirectUri,
} from "../utils/topggOAuth";

const ENCRYPTION_KEY = "test-encryption-key-for-topgg-oauth";

describe("generatePkcePair", () => {
  it("generates a verifier matching the RFC 7636 unreserved charset and length bound", async () => {
    const { verifier } = await generatePkcePair();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it("computes the challenge as base64url(sha256(verifier)) with no padding", async () => {
    const { verifier, challenge } = await generatePkcePair();
    const expected = crypto
      .createHash("sha256")
      .update(verifier)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(challenge).toBe(expected);
  });

  it("generates distinct verifiers across calls", async () => {
    const a = await generatePkcePair();
    const b = await generatePkcePair();
    expect(a.verifier).not.toBe(b.verifier);
  });
});

describe("encodeTopggOAuthState / decodeTopggOAuthState", () => {
  const payload = {
    applicationId: "1082707872565182614",
    guildId: "506893652266844162",
    verifier: "test-verifier-value",
  };

  it("round-trips a payload", async () => {
    const state = await encodeTopggOAuthState(ENCRYPTION_KEY, payload);
    const decoded = await decodeTopggOAuthState(ENCRYPTION_KEY, state);
    expect(decoded).toEqual(payload);
  });

  it("produces a URL-safe state string", async () => {
    const state = await encodeTopggOAuthState(ENCRYPTION_KEY, payload);
    expect(state).toMatch(/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/);
  });

  it("returns null for a state missing the '.' separator", async () => {
    expect(await decodeTopggOAuthState(ENCRYPTION_KEY, "not-a-valid-state")).toBeNull();
  });

  it("returns null for tampered ciphertext", async () => {
    const state = await encodeTopggOAuthState(ENCRYPTION_KEY, payload);
    const [ivPart, tokenPart] = state.split(".");
    const tampered = `${ivPart}.${tokenPart.slice(0, -2)}${tokenPart.slice(-2) === "AA" ? "BB" : "AA"}`;
    expect(await decodeTopggOAuthState(ENCRYPTION_KEY, tampered)).toBeNull();
  });

  it("returns null when decrypted with the wrong key", async () => {
    const state = await encodeTopggOAuthState(ENCRYPTION_KEY, payload);
    expect(await decodeTopggOAuthState("a-completely-different-key", state)).toBeNull();
  });
});

describe("getTopggOAuthRedirectUri", () => {
  it("rewrites the path to /oauth/topgg/callback and strips query/hash", () => {
    const result = getTopggOAuthRedirectUri("https://upvote-engine.thelukez.com/discord?foo=bar#frag");
    expect(result).toBe("https://upvote-engine.thelukez.com/oauth/topgg/callback");
  });
});
