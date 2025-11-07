import { bold, heading } from "@discordjs/builders";
import { SupportedPlatforms } from "../types";
import { ApplicationIntegrationType } from "discord-api-types/v10";

export const addBotUrl = (botId: string, integrationType: ApplicationIntegrationType = ApplicationIntegrationType.GuildInstall) =>
  `https://discord.com/oauth2/authorize?integration_type=${integrationType}&client_id=${botId}` as const;

/**
 * Generates the Platform webhook URL for a given application ID.
 *
 * @param platform - The platform for which to generate the webhook URL.
 * @param appId - The application ID for which to generate the webhook URL.
 * @returns The complete Platform webhook URL.
 */
export const PlatformWebhookUrl = (platform: SupportedPlatforms, appId: string) =>
  `https://vote-handler.lukez.workers.dev/webhook/${platform}/${appId}` as const;

export const supportedPlatforms = {
  topgg: "Top.gg",
  dbl: "Discord Bot List",
} satisfies Record<SupportedPlatforms, string>;

export const GetSupportedPlatform = (platform: SupportedPlatforms) => supportedPlatforms[platform];

/**
 * List of platforms that support test vote payloads.
 *
 * Use this to determine whether to show the user the information that they should install the bot as a user app to receive test vote confirmation.
 */
export const platformsWithTests = ["topgg"];

export const getTestNoticeForPlatform = (platform: SupportedPlatforms) => {
  if (platformsWithTests.includes(platform)) {
    return `${heading("Testing Votes", 3)}\nYou can use the **Send Test** feature on ${GetSupportedPlatform(
      platform,
    )} to verify that the webhook is working correctly. ${bold(
      "[You need to install the bot as a user application to receive test votes.]()",
    )}`;
  }
  return "";
};

export const hostnamePattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
