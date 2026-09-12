import { describe, it, expect, vi } from "vitest";
import { topggOAuthCallbackHandler } from "../routes/discord/oauthTopggCallback";
import { Context } from "hono";
import { HonoEnv } from "$types";

function makeContext(query: Record<string, string | undefined>): Context<HonoEnv> {
  return {
    req: {
      query: (key: string) => query[key],
      url: "https://upvote-engine.thelukez.com/oauth/topgg/callback",
    },
    env: { ENCRYPTION_KEY: "test-key" },
    text: vi.fn((body: string, status: number) => new Response(body, { status })),
  } as unknown as Context<HonoEnv>;
}

describe("topggOAuthCallbackHandler", () => {
  it("returns 400 when code is missing", async () => {
    const c = makeContext({ state: "some-state" });
    const res = await topggOAuthCallbackHandler(c);
    expect(res.status).toBe(400);
  });

  it("returns 400 when state is missing", async () => {
    const c = makeContext({ code: "some-code" });
    const res = await topggOAuthCallbackHandler(c);
    expect(res.status).toBe(400);
  });

  it("returns 400 when state fails to decode", async () => {
    const c = makeContext({ code: "some-code", state: "garbage-state" });
    const res = await topggOAuthCallbackHandler(c);
    expect(res.status).toBe(400);
  });
});
