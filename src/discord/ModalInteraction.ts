import {
  type APIChatInputApplicationCommandInteraction,
  type APIInteractionResponseCallbackData,
  type APIModalInteractionResponseCallbackData,
  type Snowflake,
  APIMessage,
  APIModalSubmitInteraction,
  InteractionType,
  ModalSubmitLabelComponent,
  ModalSubmitTextDisplayComponent,
  Routes,
} from "discord-api-types/v10";
import { ModalBuilder } from "@discordjs/builders";
import { API } from "@discordjs/core/http-only";
import { REST } from "@discordjs/rest";
import { ModalComponentResolver } from "./ModalComponentResolver";

class ModalInteraction {
  public readonly type = InteractionType.ModalSubmit;
  public readonly components: ModalComponentResolver;
  private readonly data: APIModalSubmitInteraction;
  public readonly rest: REST;
  /**
   * For components, the message they were attached to (if any)
   *
   * For example, when the modal is opened from a button in a message.
   */
  public readonly message?: APIMessage;
  public readonly custom_id: string;

  constructor(private api: API, interaction: APIModalSubmitInteraction) {
    this.custom_id = interaction.data.custom_id;
    this.data = interaction;
    this.components = new ModalComponentResolver(
      interaction.data.components as (ModalSubmitLabelComponent | ModalSubmitTextDisplayComponent)[],
      interaction.data.resolved,
    );
    this.rest = api.rest;
    if ("message" in interaction && interaction.message) {
      this.message = interaction.message;
    }
  }

  get applicationId() {
    return this.data.application_id;
  }

  get entitlements() {
    return this.data.entitlements;
  }

  get channelId() {
    return this.data.channel?.id; // Why could this be undefined?
  }

  get channel() {
    return this.data.channel; // Why could this be undefined?
  }

  get guildId() {
    return this.data.guild_id;
  }

  get guild() {
    return this.data.guild;
  }

  get userId() {
    return this.data.user?.id;
  }

  /**
   * User object for the invoking user.
   *
   * This is either found directly on the interaction, or within the member object
   * if the interaction was invoked in a guild.
   */
  get user() {
    return this.data.member?.user ?? this.data.user;
  }

  /**
   * Guild member data for the invoking user, including permissions
   *
   * This is only sent when an interaction is invoked in a guild
   */
  get member() {
    return this.data.member;
  }

  get locale() {
    return this.data.locale;
  }

  get guildLocale() {
    return this.data.guild_locale;
  }

  get token() {
    return this.data.token;
  }

  get id() {
    return this.data.id;
  }

  get appPermissions() {
    return this.data.app_permissions;
  }

  get version() {
    return this.data.version;
  }

  /**
   * Get all entitlements for the current application
   */
  getAppEntitlements() {
    return this.entitlements.filter((entitlement) => entitlement.application_id === this.applicationId);
  }

  /**
   * Check if the guild has a premium subscription
   * @returns {boolean}
   */
  guildHavePremium(): boolean {
    return this.getAppEntitlements().filter((entitlement) => entitlement.guild_id === this.guildId).length > 0;
  }

  /**
   * Check if the user has a premium subscription
   * @returns {boolean}
   */
  userHavePremium(): boolean {
    return this.getAppEntitlements().filter((entitlement) => entitlement.user_id === this.userId).length > 0;
  }

  reply(options: APIInteractionResponseCallbackData, forceEphemeral = true) {
    if (forceEphemeral) {
      options.flags = (options.flags ?? 0) | 64;
    }

    return this.api.interactions.reply(this.id, this.token, options);
  }

  deferReply(forceEphemeral = true) {
    return this.api.rest.post((Routes.interactionCallback(this.id, this.token) + "with_response=true") as any, {
      body: {
        flags: forceEphemeral ? 64 : undefined,
      },
    });
  }

  deferUpdate() {
    return this.api.interactions.deferMessageUpdate(this.id, this.token);
  }

  editReply(options: APIInteractionResponseCallbackData, messageId: Snowflake | "@original" = "@original") {
    return this.api.interactions.editReply(this.id, this.token, options, messageId, { signal: AbortSignal.timeout(5000) });
  }

  deleteReply(messageId?: Snowflake | "@original") {
    return this.api.interactions.deleteReply(this.id, this.token, messageId);
  }
}

export { ModalInteraction };
