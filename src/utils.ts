import { ModalBuilder } from "@discordjs/builders";
import { REST } from "@discordjs/rest";
import {
  APIApplicationCommandInteraction,
  APIApplicationCommandInteractionDataOption,
  APIApplicationCommandInteractionDataSubcommandGroupOption,
  APIApplicationCommandInteractionDataSubcommandOption,
  APIChatInputApplicationCommandInteraction,
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
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789,.-!§$%&/()=?+#*";
  // The snowflake ensures uniqueness across calls
  return (
    Array.from({ length })
      .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
      .join("") + generateSnowflake().toString()
  );
}
