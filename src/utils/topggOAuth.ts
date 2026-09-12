import { TopGGOAuthClient, TopGGAPIError } from "topgg-api-types/v1/oauth";
import { TopGGClient } from "topgg-api-types/v1/client";
import { Cryptor } from "$/db/schema";

/**
 * Workers' structured logging serializes thrown Error/TopGGAPIError objects to `{}` (their
 * fields aren't own-enumerable the way the log pipeline expects), which silently swallows the
 * actual failure reason. Extract the useful fields explicitly before logging instead.
 */
export function serializeOAuthError(error: unknown): Record<string, unknown> {
  if (error instanceof TopGGAPIError) {
    return {
      name: error.name,
      message: error.message,
      status: error.status,
      type: error.type,
      title: error.title,
      detail: error.detail,
    };
  }
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { error };
}

export interface TopggOAuthStatePayload {
  applicationId: string;
  guildId: string;
  verifier: string;
}

export interface TopggWebhookAuthCfg {
  topggProjectId: string;
  topggWebhookId: string;
  topggRefreshToken: string;
  topggRefreshTokenIv: string;
}

function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(base64url: string): string {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  return padded + "=".repeat(padLength);
}

function base64UrlFromBytes(bytes: Uint8Array): string {
  return toBase64Url(Buffer.from(bytes).toString("base64"));
}

/**
 * Generates an RFC 7636 PKCE code_verifier (43 base64url chars from 32 random bytes,
 * within the spec's 43-128 length bound) and its S256 code_challenge.
 */
export async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = base64UrlFromBytes(verifierBytes);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64UrlFromBytes(new Uint8Array(digest));
  return { verifier, challenge };
}

/**
 * Encodes the PKCE verifier and the applicationId/guildId it belongs to into the OAuth
 * `state` param, encrypted via Cryptor. Top.gg echoes `state` back unchanged on callback,
 * so this needs no server-side storage.
 */
export async function encodeTopggOAuthState(
  encryptionKey: string,
  payload: TopggOAuthStatePayload,
): Promise<string> {
  const cryptor = new Cryptor(encryptionKey);
  const { token, iv } = await cryptor.encryptToken(JSON.stringify(payload));
  return `${toBase64Url(iv)}.${toBase64Url(token)}`;
}

/**
 * Reverses encodeTopggOAuthState. Returns null (never throws) on any malformed input,
 * decrypt failure, or invalid payload shape - callers must treat null as "restart the flow".
 */
export async function decodeTopggOAuthState(
  encryptionKey: string,
  state: string,
): Promise<TopggOAuthStatePayload | null> {
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [ivPart, tokenPart] = parts;

  try {
    const cryptor = new Cryptor(encryptionKey);
    const decrypted = await cryptor.decryptToken(fromBase64Url(tokenPart), fromBase64Url(ivPart));
    const payload = JSON.parse(decrypted);
    if (
      typeof payload?.applicationId !== "string" ||
      typeof payload?.guildId !== "string" ||
      typeof payload?.verifier !== "string"
    ) {
      return null;
    }
    return payload as TopggOAuthStatePayload;
  } catch (error) {
    console.error("Failed to decode Top.gg OAuth state:", { error: serializeOAuthError(error) });
    return null;
  }
}

/**
 * The redirect_uri used both when building the authorize link (/app create) and when
 * exchanging the code (the callback route) - must match exactly, so both call sites use
 * this instead of deriving it independently.
 */
export function getTopggOAuthRedirectUri(requestUrl: string): string {
  const url = new URL(requestUrl);
  url.pathname = "/oauth/topgg/callback";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function createTopggOAuthClient(
  env: Pick<Env, "TOP_GG_CLIENT_ID" | "TOP_GG_CLIENT_SECRET">,
): TopGGOAuthClient {
  return new TopGGOAuthClient({
    clientId: env.TOP_GG_CLIENT_ID,
    clientSecret: env.TOP_GG_CLIENT_SECRET,
  });
}

export function createTopggProjectClient(accessToken: string): TopGGClient {
  return new TopGGClient({ token: accessToken });
}

/**
 * Refreshes the stored token, deletes the project webhook, then revokes the OAuth grant.
 * Every step is wrapped and logged - this never throws, so callers (e.g. /app remove) can
 * always proceed with DB-side cleanup regardless of Top.gg-side failures.
 */
export async function cleanupTopggAuthorization(
  env: Pick<Env, "TOP_GG_CLIENT_ID" | "TOP_GG_CLIENT_SECRET" | "ENCRYPTION_KEY">,
  cfg: TopggWebhookAuthCfg,
): Promise<void> {
  try {
    const cryptor = new Cryptor(env.ENCRYPTION_KEY);
    const oauthClient = createTopggOAuthClient(env);
    const currentRefreshToken = await cryptor.decryptToken(cfg.topggRefreshToken, cfg.topggRefreshTokenIv);

    const refreshRes = await oauthClient
      .refreshToken({ refresh_token: currentRefreshToken })
      .catch((error) => {
        console.error("Failed to refresh Top.gg token during cleanup:", {
          error: serializeOAuthError(error),
          projectId: cfg.topggProjectId,
        });
        return null;
      });
    if (!refreshRes) return;

    const projectClient = createTopggProjectClient(refreshRes.access_token);
    await projectClient.deleteProjectWebhook(cfg.topggProjectId, cfg.topggWebhookId).catch((error) => {
      console.error("Failed to delete Top.gg project webhook during cleanup:", {
        error: serializeOAuthError(error),
        projectId: cfg.topggProjectId,
        webhookId: cfg.topggWebhookId,
      });
    });

    await oauthClient
      .revoke({ token: refreshRes.refresh_token, token_type_hint: "refresh_token" })
      .catch((error) => {
        console.error("Failed to revoke Top.gg OAuth grant during cleanup:", {
          error: serializeOAuthError(error),
          projectId: cfg.topggProjectId,
        });
      });
  } catch (error) {
    console.error("Unexpected error during Top.gg cleanup:", {
      error: serializeOAuthError(error),
      projectId: cfg.topggProjectId,
    });
  }
}
