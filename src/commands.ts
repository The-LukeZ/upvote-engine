import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import { sendMessage, showModal } from "./utils";
import { Guild } from "./db";
import { ModalBuilder } from "@discordjs/builders";

export async function handleCommand(interaction: APIChatInputApplicationCommandInteraction, env: Env) {
  switch (interaction.data.name) {
    case "ping":
      return sendMessage({ content: "Pong!" }, true);
    case "config":
      return handleConfig(interaction, env);
    default:
      return sendMessage({ content: `Unknown command: ${interaction.data.name}` }, true);
  }
}

async function handleConfig(ctx: APIChatInputApplicationCommandInteraction, env: Env) {
  const data = await env.vote_handler
    .prepare("SELECT vote_role_id, role_duration_seconds FROM guilds WHERE guild_id = ?")
    .bind(ctx.guild_id)
    .first<Guild>();

  return showModal(
    new ModalBuilder({
      title: "Configuration",
      custom_id: "config_modal",
    }).addLabelComponents((l) =>
      l
        .setLabel("Vote Role")
        .setDescription("Role to assign on vote")
        .setRoleSelectMenuComponent((rs) => {
          rs.setCustomId("vote_role");
          if (data?.vote_role_id) {
            rs.setDefaultRoles(data.vote_role_id);
          }
          return rs;
        }),
    ),
  );
}
