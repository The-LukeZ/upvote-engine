import {
  type APIInteractionResponseCallbackData,
  type Snowflake,
  APIChatInputApplicationCommandInteraction,
  APIModalSubmitInteraction,
  InteractionType,
  Routes,
} from "discord-api-types/v10";
import { API } from "@discordjs/core/http-only";
import { REST } from "@discordjs/rest";
import { ChatInputCommandInteraction } from "./ChatInputInteraction";
import { ModalInteraction } from "./ModalInteraction";

abstract class BaseInteraction<Type extends InteractionType> {
  public readonly type: Type;
  protected readonly data: Extract<APIChatInputApplicationCommandInteraction | APIModalSubmitInteraction, { type: Type }>;
  public readonly rest: REST;

  constructor(protected api: API, data: typeof this.data) {
    this.type = data.type as Type;
    this.data = data;
    this.rest = api.rest;
  }

  get applicationId() {
    return this.data.application_id;
  }

  get entitlements() {
    return this.data.entitlements;
  }

  get channelId() {
    return this.data.channel?.id;
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

  get user() {
    return this.data.member?.user ?? this.data.user;
  }

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

  getAppEntitlements() {
    return this.entitlements.filter((entitlement) => entitlement.application_id === this.applicationId);
  }

  guildHavePremium(): boolean {
    return this.getAppEntitlements().filter((entitlement) => entitlement.guild_id === this.guildId).length > 0;
  }

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
    return this.api.interactions.editReply(this.applicationId, this.token, options, messageId, { signal: AbortSignal.timeout(5000) });
  }

  deleteReply(messageId?: Snowflake | "@original") {
    return this.api.interactions.deleteReply(this.applicationId, this.token, messageId);
  }

  // Typeguards
  isChatInputCommand(): this is ChatInputCommandInteraction {
    return this.type === InteractionType.ApplicationCommand;
  }

  isModal(): this is ModalInteraction {
    return this.type === InteractionType.ModalSubmit;
  }
}

export { BaseInteraction };
