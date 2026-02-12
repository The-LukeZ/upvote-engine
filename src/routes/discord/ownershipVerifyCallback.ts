import { Context } from "hono";
import { API } from "@discordjs/core/http-only";
import { REST } from "@discordjs/rest";
import { cleanUrl } from "../../utils";
import { makeDB } from "../../db/util";
import { Cryptor, owners } from "../../db/schema";
import { HonoEnv } from "../../../types";
import dayjs from "dayjs";

export async function ovHandler(c: Context<HonoEnv>) {
  const code = c.req.query("code");
  if (!code) {
    return c.text("Missing code parameter", 400);
  }

  const botApi = new API(new REST().setToken(c.env.DISCORD_TOKEN));
  const tokenRes = await botApi.oauth2
    .tokenExchange({
      code: code,
      client_id: c.env.DISCORD_APPLICATION_ID,
      client_secret: c.env.DISCORD_APP_SECRET,
      grant_type: "authorization_code",
      redirect_uri: cleanUrl(c.req.url),
    })
    .catch((error) => {
      console.error("Failed to exchange code for token:", { error, code });
      return null;
    });

  if (!tokenRes) {
    return c.text("Failed to exchange code for token", 500);
  }

  const userApi = new API(new REST({ authPrefix: "Bearer" }).setToken(tokenRes.access_token));
  const atUser = await userApi.users.getCurrent().catch((error) => {
    console.error("Failed to fetch user info with access token:", { error, access_token: tokenRes.access_token });
    return null;
  });
  if (!atUser) {
    return c.text("Failed to fetch user info", 500);
  }

  // encrypt
  const tokenData = await new Cryptor(c.env.ENCRYPTION_KEY).encryptToken(tokenRes.access_token);

  // store
  const db = makeDB(c.env.vote_handler);
  await db
    .insert(owners)
    .values({
      userId: atUser.id,
      accessToken: tokenData.token,
      iv: tokenData.iv,
      expiresAt: dayjs().add(tokenRes.expires_in, "s").toISOString(),
      scope: tokenRes.scope,
    })
    .onConflictDoUpdate({
      target: owners.userId,
      set: {
        accessToken: tokenData.token,
        iv: tokenData.iv,
        expiresAt: dayjs().add(tokenRes.expires_in, "s").toISOString(),
        scope: tokenRes.scope,
        updatedAt: new Date().toISOString(),
      },
    });

  return c.text(
    "The application has been authorized. You can now close this tab and return back to discord to verify your ownership of applications.",
  );
}
