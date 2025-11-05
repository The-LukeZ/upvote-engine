import { APIInteractionResponse } from "discord-api-types/v10";

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
