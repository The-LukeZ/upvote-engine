import { eq, sql } from "drizzle-orm";
import { DrizzleDB } from "../../types";
import { applications } from "../db/schema";

export async function incrementInvalidRequestCount(db: DrizzleDB, applicationId: string) {
  await db
    .update(applications)
    .set({
      invalidRequests: sql`${applications.invalidRequests} + 1`,
    })
    .where(eq(applications.applicationId, applicationId));
}

/**
 * Generates a random token string of the specified length.
 * @param length The length of the random token to generate. Default is 32 characters.
 * @returns A random token string of the specified length.
 */
export function generateRandomToken(length: number = 32): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzöäüß0123456789.-_:=+<>@()[]{}|~";
  return Array.from({ length }, () => characters.charAt(Math.floor(Math.random() * characters.length))).join("");
}
