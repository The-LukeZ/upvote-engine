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
