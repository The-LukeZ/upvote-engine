import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import { sendMessage, showModal } from "./utils";
import { ModalBuilder } from "@discordjs/builders";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { guilds } from "./db/schema";

export async function handleCommand(interaction: APIChatInputApplicationCommandInteraction, env: Env) {
  switch (interaction.data.name) {
    case "ping":
      return sendMessage("Pong!", true);
    case "config":
      return handleConfig(interaction, env);
    default:
      return sendMessage(`Unknown command: ${interaction.data.name}`, true);
  }
}

async function handleConfig(ctx: APIChatInputApplicationCommandInteraction, env: Env) {
  const db = drizzle(env.vote_handler);
  const data = await db.select().from(guilds).where(eq(guilds.guildId, ctx.guild_id!)).limit(1).get();

  return showModal(
    new ModalBuilder({
      title: "Configuration",
      custom_id: "config_modal",
    })
      .addLabelComponents((l) =>
        l
          .setLabel("Vote Role")
          .setDescription("Role to assign on vote")
          .setRoleSelectMenuComponent((rs) => {
            rs.setCustomId("vote_role");
            if (data?.voteRoleId) {
              rs.setDefaultRoles(data.voteRoleId);
            }
            return rs;
          }),
      )
      .addLabelComponents((l) =>
        l
          .setLabel("Role Duration")
          .setDescription("Duration for which the role will be active")
          .setTextInputComponent((ti) =>
            ti
              .setCustomId("role_duration")
              .setMaxLength(2)
              .setStyle(1)
              .setPlaceholder("Hours")
              .setValue(data ? Math.floor(data.roleDurationSeconds / 3600).toString() : ""),
          ),
      ),
  );
}
