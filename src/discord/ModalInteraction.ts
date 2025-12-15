import {
  APIMessage,
  APIModalSubmitInteraction,
  InteractionType,
  ModalSubmitLabelComponent,
  ModalSubmitTextDisplayComponent,
} from "discord-api-types/v10";
import { API } from "@discordjs/core/http-only";
import { ModalComponentResolver } from "./ModalComponentResolver";
import { BaseInteraction } from "./BaseInteraction";

class ModalInteraction extends BaseInteraction<InteractionType.ModalSubmit> {
  public readonly fields: ModalComponentResolver;
  public readonly message?: APIMessage;
  public readonly custom_id: string;

  constructor(api: API, interaction: APIModalSubmitInteraction) {
    super(api, interaction);
    this.custom_id = interaction.data.custom_id;
    this.fields = new ModalComponentResolver(
      interaction.data.components as (ModalSubmitLabelComponent | ModalSubmitTextDisplayComponent)[],
      interaction.data.resolved,
    );
    if ("message" in interaction && interaction.message) {
      this.message = interaction.message;
    }
  }
}

export { ModalInteraction };
