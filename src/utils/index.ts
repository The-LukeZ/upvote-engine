import { eq, sql } from "drizzle-orm";
import { DrizzleDB } from "../../types";
import { ApplicationCfg, applications, isUserVerifiedForApplication } from "../db/schema";
import { bold, heading } from "@discordjs/builders";
import { GetSupportedPlatform, getTestNoticeForPlatform, platformsWithTests } from "../constants";
import { APIEmbed } from "discord-api-types/payloads/v10";
import { Colors } from "honocord";
import dayjs from "dayjs";

export async function checkAppAuthorization(
  db: DrizzleDB,
  applicationId: string,
  guildId: string,
  userId: string,
  isGlobalOwner: boolean,
): Promise<{ authorized: boolean; message?: string }> {
  if (isGlobalOwner) return { authorized: true };

  const isVerified = await isUserVerifiedForApplication(db, applicationId, guildId, userId);
  if (!isVerified) {
    return {
      authorized: false,
      message:
        "You are not authorized to configure this bot. Only the application owner or verified owners can configure this bot.\n" +
        `Use \`/verify-app-ownership\` to verify your ownership of <@${applicationId}>.`,
    };
  }

  return { authorized: true };
}

export async function incrementInvalidRequestCount(db: DrizzleDB, applicationId: string) {
  await db
    .update(applications)
    .set({
      invalidRequests: sql`${applications.invalidRequests} + 1`,
    })
    .where(eq(applications.applicationId, applicationId));
}

/**
 * Generates a random token string of the specified length.
 * @param length The length of the random token to generate. Default is 32 characters.
 * @returns A random token string of the specified length.
 */
export function generateRandomToken(length: number = 32): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzöäüß0123456789.-_:=+<>@()[]{}|~";
  return Array.from({ length }, () => characters.charAt(Math.floor(Math.random() * characters.length))).join("");
}

export function buildAppInfo(clientId: string, cfg: ApplicationCfg, action: "edit" | "create"): { embeds: APIEmbed[] } {
  const durationText = cfg.roleDurationSeconds ? `${Math.floor(cfg.roleDurationSeconds / 3600)} hour(s)` : "Permanent";
  const fields = [
    {
      name: "Vote Role",
      value: `<@&${cfg.voteRoleId}>`,
      inline: false,
    },
    {
      name: "Role Duration",
      value: durationText,
      inline: false,
    },
    {
      name: "Created At",
      value: `<t:${dayjs(cfg.createdAt).unix()}>`,
      inline: false,
    },
  ];

  if (platformsWithTests.includes(cfg.source)) {
    fields.push({
      name: "Test Vote Notice",
      value: getTestNoticeForPlatform(cfg.source, clientId),
      inline: false,
    });
  }

  const embed: APIEmbed = {
    description: [
      heading(`Configuration ${action === "create" ? "created" : "updated"} for bot <@${cfg.applicationId}>`, 3),
      `Successfully ${action === "create" ? "configured" : "updated"} <@${cfg.applicationId}> in this server for ${bold(
        GetSupportedPlatform(cfg.source),
      )}.`,
      "",
      action === "create"
        ? ":white_check_mark: The bot is now ready to receive vote webhooks. Votes will automatically grant the configured role."
        : ":white_check_mark: Configuration updated successfully.",
    ].join("\n"),
    color: action === "create" ? Colors.Green : Colors.Yellow,
    fields: fields,
  };

  return {
    embeds: [embed],
  };
}
