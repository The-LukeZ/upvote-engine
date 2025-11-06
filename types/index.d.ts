import type { Context } from "hono";
import type { BlankInput } from "hono/types";
import type { Collection } from "@discordjs/collection";
import type {
  APIAttachment,
  APIInteractionDataResolvedChannel,
  APIInteractionDataResolvedGuildMember,
  APIRole,
  APIUser,
  Snowflake,
} from "discord-api-types/v10";
import { ModalInteraction } from "../src/discord/ModalInteraction";
import { ChatInputCommandInteraction } from "../src/discord/ChatInputInteraction";
import { DrizzleD1Database } from "drizzle-orm/d1";
import { makeDB } from "../src/db/util";

export * from "./db";
export * from "./topgg";

export interface ResponseLike
  extends Pick<Response, "arrayBuffer" | "bodyUsed" | "headers" | "json" | "ok" | "status" | "statusText" | "text"> {
  body: Readable | ReadableStream | null;
}

export type MyInteraction = ChatInputCommandInteraction | ModalInteraction;

export type HonoBindings = Env;
export type HonoVariables = {
  command: ChatInputCommandInteraction;
  modal: ModalInteraction;
};

export type MyContext = Context<{ Bindings: HonoBindings; Variables: HonoVariables }, "/", BlankInput>;

export interface APIInteractionDataResolvedCollections {
  users?: Collection<Snowflake, APIUser>;
  roles?: Collection<Snowflake, APIRole>;
  members?: Collection<Snowflake, APIInteractionDataResolvedGuildMember>;
  channels?: Collection<Snowflake, APIInteractionDataResolvedChannel>;
  attachments?: Collection<Snowflake, APIAttachment>;
}

export type DrizzleDB = ReturnType<typeof makeDB>;

export interface QueueMessageBody {
  userId: string;
  guildId: string;
  applicationId: string;
  timestamp: string; // ISO string
}
