import { Snowflake } from "@sapphire/snowflake";

const snowflake = new Snowflake(new Date("2025-11-04T00:00:00Z"));

export function generateSnowflake(timestamp?: Date): bigint {
  return snowflake.generate({ timestamp });
}
