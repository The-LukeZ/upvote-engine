/**
 * Generates the Top.gg webhook URL for a given application ID.
 *
 * @param appId - The application ID for which to generate the webhook URL.
 * @returns The complete Top.gg webhook URL.
 */
export const TopGGWebhookUrl = (appId: string) => `https://vote-handler.lukez.workers.dev/topgg/webhook/${appId}`;
