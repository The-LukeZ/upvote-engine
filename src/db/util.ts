import { drizzle } from "drizzle-orm/d1";
import { applications, blacklist, users, votes } from "./schema";

/**
 * A function to create and return a Drizzle D1 database instance.
 *
 * This is not needed specifically, but it helps with typings.
 *
 * @param env The environment bindings containing the D1 database.
 * @returns A Drizzle D1 database instance.
 */
export function makeDB(env: Env) {
  return drizzle(env.vote_handler, { schema: { applications, votes, users, blacklist } });
}
