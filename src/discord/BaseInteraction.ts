import {
  type APIInteractionResponseCallbackData,
  type Snowflake,
  APIChatInputApplicationCommandInteraction,
  APIMessageComponentInteraction,
  APIModalSubmitInteraction,
  APIUser,
  ComponentType,
  InteractionType,
} from "discord-api-types/v10";
import { API } from "@discordjs/core/http-only";
import { REST } from "@discordjs/rest";
import { ChatInputCommandInteraction } from "./ChatInputInteraction";
import { ModalInteraction } from "./ModalInteraction";

abstract class BaseInteraction<Type extends InteractionType> {
  public readonly type: Type;
  protected readonly data: Extract<
    APIChatInputApplicationCommandInteraction | APIModalSubmitInteraction | APIMessageComponentInteraction,
    { type: Type }
  >;
  public readonly rest: REST;
  private _ephemeral: boolean | null = null;
  private replied: boolean = false;
  private deferred: boolean = false;

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
    return (this.data.user ?? this.data.member?.user) as APIUser; // One is always given.
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

  async reply(options: APIInteractionResponseCallbackData | string, forceEphemeral = true) {
    const replyOptions = typeof options === "string" ? { content: options } : options;
    if (forceEphemeral) {
      replyOptions.flags = (replyOptions.flags ?? 0) | 64;
    }
    const response = await this.api.interactions.reply(this.id, this.token, replyOptions, {
      signal: AbortSignal.timeout(5000),
    });
    this.replied = true;
    return response;
  }

  async deferReply(forceEphemeral = true) {
    const response = await this.api.interactions.defer(this.id, this.token, {
      flags: forceEphemeral ? 64 : undefined,
    });
    this.deferred = true;
    return response;
  }

  deferUpdate() {
    return this.api.interactions.deferMessageUpdate(this.id, this.token);
  }

  async editReply(options: APIInteractionResponseCallbackData | string, messageId: Snowflake | "@original" = "@original") {
    const replyOptions = typeof options === "string" ? { content: options } : options;
    const response = await this.api.interactions.editReply(this.applicationId, this.token, replyOptions, messageId, {
      signal: AbortSignal.timeout(5000),
    });
    this.replied = true;
    return response;
  }

  deleteReply(messageId?: Snowflake | "@original") {
    return this.api.interactions.deleteReply(this.applicationId, this.token, messageId);
  }

  async update(options: APIInteractionResponseCallbackData | string) {
    const updateOptions = typeof options === "string" ? { content: options } : options;
    const response = await this.api.interactions.updateMessage(this.id, this.token, updateOptions, {
      signal: AbortSignal.timeout(5000),
    });
    this.replied = true;
    return response;
  }

  // Typeguards
  isChatInputCommand(): this is ChatInputCommandInteraction {
    return this.type === InteractionType.ApplicationCommand;
  }

  isModal(): this is ModalInteraction {
    return this.type === InteractionType.ModalSubmit;
  }

  isMessageComponent(): this is APIMessageComponentInteraction {
    return this.type === InteractionType.MessageComponent;
  }

  isButton(): this is APIMessageComponentInteraction & { data: { component_type: ComponentType.Button } } {
    return this.isMessageComponent() && this.data.component_type === ComponentType.Button;
  }

  isStringSelect(): this is APIMessageComponentInteraction & {
    data: { component_type: Exclude<ComponentType, ComponentType.StringSelect> };
  } {
    return this.isMessageComponent() && this.data.component_type === ComponentType.StringSelect;
  }
}

export { BaseInteraction };
