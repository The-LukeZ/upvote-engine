import { Context } from "hono";
import { and, eq } from "drizzle-orm";
import { HonoEnv } from "$types";
import { makeDB } from "$/db/util";
import { applications, Cryptor } from "$/db/schema";
import {
  decodeTopggOAuthState,
  getTopggOAuthRedirectUri,
  createTopggOAuthClient,
  createTopggProjectClient,
} from "$/utils/topggOAuth";

// Path: GET /oauth/topgg/callback
export async function topggOAuthCallbackHandler(c: Context<HonoEnv>): Promise<Response> {
  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!code || !state) {
    return c.text("Missing code or state parameter.", 400);
  }

  const statePayload = await decodeTopggOAuthState(c.env.ENCRYPTION_KEY, state);
  if (!statePayload) {
    return c.text("This authorization link is invalid or has expired. Please run /app create again.", 400);
  }
  const { applicationId, guildId, verifier } = statePayload;

  const oauthClient = createTopggOAuthClient(c.env);
  const tokenRes = await oauthClient
    .exchangeCode({
      code,
      redirect_uri: getTopggOAuthRedirectUri(c.req.url),
      code_verifier: verifier,
    })
    .catch((error) => {
      console.error("Failed to exchange Top.gg OAuth code:", { error, applicationId, guildId });
      return null;
    });

  if (!tokenRes) {
    return c.text("Failed to complete Top.gg authorization. Please run /app create again.", 500);
  }

  const { access_token, refresh_token, project } = tokenRes;

  if (!project) {
    // The grant was issued but Top.gg returned no project for it - don't leave it dangling.
    await oauthClient.revoke({ token: refresh_token, token_type_hint: "refresh_token" }).catch((error) => {
      console.error("Failed to revoke Top.gg OAuth grant after missing-project response:", {
        error,
        applicationId,
      });
    });
    return c.text("Failed to complete Top.gg authorization. Please run /app create again.", 500);
  }

  const origin = new URL(c.req.url).origin;
  const projectClient = createTopggProjectClient(access_token);
  const webhookRes = await projectClient
    .createProjectWebhook(project.id, {
      label: "UpvoteEngine",
      url: `${origin}/webhook/topgg/v1/${applicationId}`,
    })
    .catch((error) => {
      console.error("Failed to create Top.gg project webhook:", { error, applicationId, projectId: project.id });
      return null;
    });

  if (!webhookRes) {
    // The OAuth grant already exists but no webhook was created - don't leave it dangling.
    await oauthClient.revoke({ token: refresh_token, token_type_hint: "refresh_token" }).catch((error) => {
      console.error("Failed to revoke Top.gg OAuth grant after webhook creation failure:", {
        error,
        applicationId,
      });
    });
    return c.text("Failed to set up the Top.gg webhook. Please run /app create again.", 500);
  }

  const db = makeDB(c.env.vote_handler);
  const cryptor = new Cryptor(c.env.ENCRYPTION_KEY);
  const refreshTokenData = await cryptor.encryptToken(refresh_token);

  const updated = await db
    .update(applications)
    .set({
      secret: webhookRes.secret,
      topggProjectId: project.id,
      topggWebhookId: webhookRes.id,
      topggRefreshToken: refreshTokenData.token,
      topggRefreshTokenIv: refreshTokenData.iv,
    })
    .where(and(eq(applications.applicationId, applicationId), eq(applications.source, "topgg")))
    .returning()
    .get();

  if (!updated) {
    // No matching applications row (deleted/reconfigured mid-flow) - the webhook + grant
    // we just created would otherwise be unrecoverable, so tear them down.
    console.error("No applications row found to store Top.gg webhook credentials:", { applicationId, guildId });
    await projectClient.deleteProjectWebhook(project.id, webhookRes.id).catch((error) => {
      console.error("Failed to delete orphaned Top.gg webhook after missing applications row:", {
        error,
        applicationId,
        projectId: project.id,
      });
    });
    await oauthClient.revoke({ token: refresh_token, token_type_hint: "refresh_token" }).catch((error) => {
      console.error("Failed to revoke Top.gg OAuth grant after missing applications row:", {
        error,
        applicationId,
      });
    });
    return c.text(
      "This app's configuration no longer exists. Please run /app create again to finish setup.",
      404,
    );
  }

  return c.text("Top.gg setup complete — you can close this tab and return to Discord.");
}
