import { ModalBuilder } from "@discordjs/builders";
import {
  APIApplicationCommandInteraction,
  APIChatInputApplicationCommandInteraction,
  APIInteraction,
  APIInteractionResponse,
  APIInteractionResponseCallbackData,
  APIModalInteractionResponseCallbackData,
  APIModalSubmitInteraction,
  ApplicationCommandType,
  InteractionResponseType,
  InteractionType,
} from "discord-api-types/v10";

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

export function sendMessage(data: APIInteractionResponseCallbackData | string, forceEphemeral = true) {
  return new APIResponse({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      ...(typeof data === "string" ? { content: data } : data),
      flags: forceEphemeral && typeof data !== "string" ? (data.flags || 0) | 64 : typeof data === "string" ? 0 : data.flags,
    },
  });
}

export function editMessage(data: APIInteractionResponseCallbackData | string) {
  return new APIResponse({
    type: InteractionResponseType.UpdateMessage,
    data: typeof data === "string" ? { content: data } : data,
  });
}

export function showModal(data: APIModalInteractionResponseCallbackData | ModalBuilder) {
  return new APIResponse({
    type: InteractionResponseType.Modal,
    data: data instanceof ModalBuilder ? data.toJSON() : data,
  });
}

export function deferReply(ephemeral = true) {
  return new APIResponse({
    type: InteractionResponseType.DeferredChannelMessageWithSource,
    data: { flags: ephemeral ? 64 : undefined },
  });
}

// Typeguards to make sure an interactions are correctly typed
export function isChatInputCommandInteraction(
  interaction: APIApplicationCommandInteraction,
): interaction is APIChatInputApplicationCommandInteraction {
  return interaction.data.type === ApplicationCommandType.ChatInput;
}

export function isModalInteraction(interaction: APIInteraction): interaction is APIModalSubmitInteraction {
  return interaction.type === InteractionType.ModalSubmit;
}
