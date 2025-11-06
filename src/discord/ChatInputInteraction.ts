import {
  type APIChatInputApplicationCommandInteraction,
  type APIInteractionResponseCallbackData,
  type APIModalInteractionResponseCallbackData,
  type Snowflake,
  InteractionType,
} from "discord-api-types/v10";
import { CommandInteractionOptionResolver } from "./CommandOptionResolver";
import { ModalBuilder } from "@discordjs/builders";
import { API } from "@discordjs/core";

class ChatInputCommandInteraction {
  public readonly type = InteractionType.ApplicationCommand;
  public readonly options: CommandInteractionOptionResolver;
  private readonly data: APIChatInputApplicationCommandInteraction;
  constructor(private api: API, interaction: APIChatInputApplicationCommandInteraction) {
    this.options = new CommandInteractionOptionResolver(interaction.data.options, interaction.data.resolved);
    this.data = interaction;
  }

  get applicationId() {
    return this.data.application_id;
  }

  get entitlements() {
    return this.data.entitlements;
  }

  get commandName() {
    return this.data.data.name;
  }

  get commandId() {
    return this.data.id;
  }

  get channelId() {
    return this.data.channel.id;
  }

  get channel() {
    return this.data.channel;
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
    return this.api.interactions.defer(this.id, this.token, {
      flags: forceEphemeral ? 64 : undefined,
    });
  }

  deferUpdate() {
    return this.api.interactions.deferMessageUpdate(this.id, this.token);
  }

  editReply(options: APIInteractionResponseCallbackData, messageId: Snowflake | "@original" = "@original") {
    return this.api.interactions.editReply(this.id, this.token, options, messageId);
  }

  deleteReply(messageId?: Snowflake | "@original") {
    return this.api.interactions.deleteReply(this.id, this.token, messageId);
  }

  showModal(data: APIModalInteractionResponseCallbackData | ModalBuilder) {
    return this.api.interactions.createModal(this.id, this.token, data instanceof ModalBuilder ? data.toJSON() : data);
  }
}

export { ChatInputCommandInteraction };
