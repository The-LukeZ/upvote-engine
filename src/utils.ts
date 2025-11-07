import { ModalBuilder } from "@discordjs/builders";
import { REST } from "@discordjs/rest";
import {
  APIApplicationCommandInteraction,
  APIApplicationCommandInteractionDataOption,
  APIApplicationCommandInteractionDataSubcommandGroupOption,
  APIApplicationCommandInteractionDataSubcommandOption,
  APIChatInputApplicationCommandInteraction,
  APIDMChannel,
  APIInteraction,
  APIInteractionResponse,
  APIInteractionResponseCallbackData,
  APIMessageComponentInteraction,
  APIModalInteractionResponseCallbackData,
  APIModalSubmitInteraction,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  InteractionResponseType,
  InteractionType,
  Routes,
} from "discord-api-types/v10";
import { generateSnowflake } from "./snowflake";
import { DrizzleDB, SupportedPlatforms } from "../types";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";
import { Colors } from "./discord/colors";

export class JsonResponse extends Response {
  constructor(body: any, init?: ResponseInit) {
    const jsonBody = JSON.stringify(body);
    init = init || {
      headers: {
        "content-type": "application/json;charset=UTF-8",
      },
    };
    super(jsonBody, init);
  }
}

export class APIResponse extends JsonResponse {
  constructor(data: APIInteractionResponse, init?: ResponseInit) {
    super(data, init);
  }
}

/**
 * A generic function to send a message response to Discord interactions.
 *
 * @param data The message content or response data to send.
 * @param forceEphemeral Whether to force the message to be ephemeral (only visible to the user).
 * @returns An APIResponse object containing the interaction response.
 */
export function sendMessage(data: APIInteractionResponseCallbackData | string, forceEphemeral = true) {
  return new APIResponse({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      ...(typeof data === "string" ? { content: data } : data),
      flags: forceEphemeral && typeof data !== "string" ? (data.flags || 0) | 64 : typeof data === "string" ? 0 : data.flags,
    },
  });
}

// Typeguards because TypeScript is bad at narrowing unions
export function isChatInputCommandInteraction(
  interaction: APIApplicationCommandInteraction,
): interaction is APIChatInputApplicationCommandInteraction {
  return interaction.data.type === ApplicationCommandType.ChatInput;
}

export function isModalInteraction(interaction: APIInteraction): interaction is APIModalSubmitInteraction {
  return interaction.type === InteractionType.ModalSubmit;
}

export function isMessageComponentInteraction(interaction: APIInteraction): interaction is APIMessageComponentInteraction {
  return interaction.type === InteractionType.MessageComponent;
}

export function randomStringWithSnowflake(length: number) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._+=!@";
  // The snowflake ensures uniqueness across calls
  return (
    Array.from({ length })
      .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
      .join("") + generateSnowflake().toString()
  );
}

/**
 * An array of delay intervals for retrying operations, used for exponential backoff.
 *
 * ```[0, 30, 60, 120, 300, 600, 1800, 3600]```
 */
export const delaySeconds = [0, 30, 60, 120, 300, 600, 1800, 3600]; // in seconds; we start at 0, because first attempt has number 1

/**
 * Calculates a delay with added jitter to prevent thundering herd problems.
 *
 * @param baseDelay - The base delay time in milliseconds
 * @param jitterFactor - A multiplier (0-1) that determines the maximum jitter as a fraction of baseDelay
 * @returns The calculated delay with jitter applied, rounded down to the nearest integer
 *
 * @example
 * ```typescript
 * // Add up to 10% jitter to a 10s base delay
 * const delay = jitterDelay(10, 0.1); // Returns 10-11s
 * ```
 */
export const jitterDelay = (baseDelay: number, jitterFactor: number) => {
  const jitter = Math.random() * jitterFactor * baseDelay;
  return Math.floor(baseDelay + jitter);
};

/**
 * Sanitizes a secret string by masking the the characters after the first four with asterisks.
 *
 * @param secret - The secret string to sanitize
 * @returns The sanitized secret string
 */
export function sanitizeSecret(secret: string) {
  return secret.slice(0, 4) + "*".repeat(Math.max(0, secret.length - 4));
}

export async function dmUserOnTestVote(
  db: DrizzleDB,
  env: Env,
  { userId, applicationId, source }: { userId: string; applicationId: string; source: SupportedPlatforms },
) {
  console.log(`Starting DM process for test vote - userId: ${userId}, applicationId: ${applicationId}, source: ${source}`);

  const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);
  const existingUserDM = await db.select({ dmId: users.dmId }).from(users).where(eq(users.id, userId)).limit(1).get();

  console.log(`Existing DM check result:`, existingUserDM);

  let dmChannelId: string;
  if (existingUserDM?.dmId) {
    dmChannelId = existingUserDM.dmId;
    console.log(`Using existing DM channel: ${dmChannelId}`);
  } else {
    console.log(`Creating new DM channel for user: ${userId}`);
    try {
      const response = await rest.post(Routes.userChannels(), {
        body: {
          recipient_id: userId,
        },
        signal: AbortSignal.timeout(5000),
      });
      const dmChannel = response as APIDMChannel;
      dmChannelId = dmChannel.id;
      console.log(`Created new DM channel: ${dmChannelId}`);
    } catch (error) {
      console.error("Failed to create DM channel for test vote:", { error, userId });
      return;
    }
  }

  console.log(`Sending test vote notification to DM channel: ${dmChannelId}`);
  try {
    await rest.post(Routes.channelMessages(dmChannelId), {
      body: {
        embeds: [
          {
            title: "Test Vote Received",
            description: `We received your test vote for application ID \`${applicationId}\` on platform \`${source}\`.\nNo roles or rewards have been applied.`,
            color: Colors.Blurple,
          },
        ],
      },
    });
    console.log(`Successfully sent test vote notification to user: ${userId}`);
  } catch (error) {
    console.error("Failed to send DM for test vote:", { error, userId, dmChannelId });
    return;
  }
}
