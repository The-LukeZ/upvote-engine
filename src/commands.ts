import { APIApplicationCommandInteraction } from "discord-api-types/v10";
import { APIResponse, sendMessage } from "./utils";

export async function handleCommand(interaction: APIApplicationCommandInteraction) {
  if (interaction.data.name === "ping") {
    return sendMessage({ content: "Pong!" }, true);
  }
}
