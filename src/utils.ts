import {
  APIInteractionResponse,
  APIInteractionResponseCallbackData,
  APIInteractionResponseChannelMessageWithSource,
  InteractionResponseType,
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

export function sendMessage(data: APIInteractionResponseCallbackData, forceEphemeral = true) {
  return new APIResponse({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      ...data,
      flags: forceEphemeral ? (data.flags || 0) | 64 : data.flags,
    },
  });
}

export function editMessage(data: APIInteractionResponseCallbackData) {
  return new APIResponse({
    type: InteractionResponseType.UpdateMessage,
    data: data,
  });
}
