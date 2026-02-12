import type { Context } from "hono";
import type { BlankInput } from "hono/types";
import type { Collection } from "@discordjs/collection";
import type {
  APIApplication,
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
import { WebhookPayload } from "./webhooks";
import { NewVote, ApplicationCfg, APIVote } from "../src/db/schema";
import { MessageComponentInteraction } from "../src/discord/MessageComponentInteraction";
import { BaseHonocordEnv, BaseInteractionContext } from "honocord";

export * from "./db";
export * from "./topgg";

export interface ResponseLike extends Pick<
  Response,
  "arrayBuffer" | "bodyUsed" | "headers" | "json" | "ok" | "status" | "statusText" | "text"
> {
  body: Readable | ReadableStream | null;
}

export type DrizzleDB = ReturnType<typeof makeDB>;

export type HonoVariables = { vote?: WebhookPayload; db: DrizzleDB };
type WorkerEnv = Env;
export type HonoEnv = {
  Bindings: WorkerEnv;
  Variables: HonoVariables;
};
export type MyContext = BaseInteractionContext<WorkerEnv, HonoVariables>;

export type QueueMessageBody = APIVote & {
  timestamp: string;
};

export type SupportedPlatforms = ApplicationCfg["source"];
