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

export * from "./db";
export * from "./topgg";

export interface ResponseLike
  extends Pick<Response, "arrayBuffer" | "bodyUsed" | "headers" | "json" | "ok" | "status" | "statusText" | "text"> {
  body: Readable | ReadableStream | null;
}

export interface HonoEnv<Vars> {
  Bindings: Env;
  Variables: Vars;
}

export type MyContext<Vars> = Context<HonoEnv<Vars>, "/", BlankInput>;

export interface APIInteractionDataResolvedCollections {
  users?: Collection<Snowflake, APIUser>;
  roles?: Collection<Snowflake, APIRole>;
  members?: Collection<Snowflake, APIInteractionDataResolvedGuildMember>;
  channels?: Collection<Snowflake, APIInteractionDataResolvedChannel>;
  attachments?: Collection<Snowflake, APIAttachment>;
}
