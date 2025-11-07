import { SupportedPlatforms } from "../types";

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
