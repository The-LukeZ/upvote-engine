import { SlashCommandHandler } from "honocord";
import { MyContext } from "../../../../types";
import { ApplicationIntegrationType } from "discord-api-types/v10";
import { supportedPlatforms } from "../../../constants";

export const integrationsCommand = new SlashCommandHandler<MyContext>()
  .setName("integrations")
  .setDescription("Manage bot integrations for this server")
  .setContexts(0)
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
  .setDefaultMemberPermissions(32) // Manage Server
  .addSubcommand((sub) => sub.setName("list").setDescription("List all configured integrations"))
  .addSubcommand((sub) =>
    sub
      .setName("configure")
      .setDescription("Configure an integration for this guild")
      .addUserOption((opt) => opt.setName("bot").setDescription("The bot user to add").setRequired(true))
      .addStringOption((opt) =>
        opt
          .setName("source")
          .setDescription("The bot listing source")
          .setRequired(true)
          .addChoices(
            Object.keys(supportedPlatforms).map((key) => ({
              name: supportedPlatforms[key as keyof typeof supportedPlatforms],
              value: key,
            })),
          ),
      )
      .addRoleOption((opt) => opt.setName("role").setDescription("Role to assign on vote").setRequired(false))
      .addIntegerOption(
        (op) =>
          op
            .setName("duration")
            .setDescription("Duration in hours (!) for which the role will be active")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(336), // 14 days
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Remove an integration configuration")
      .addUserOption((opt) => opt.setName("bot").setDescription("The bot user to remove").setRequired(true))
      .addStringOption((opt) =>
        opt
          .setName("source")
          .setDescription("The bot listing source")
          .setRequired(true)
          .addChoices(
            Object.keys(supportedPlatforms).map((key) => ({
              name: supportedPlatforms[key as keyof typeof supportedPlatforms],
              value: key,
            })),
          ),
      ),
  )
  .addSubcommandGroup((group) =>
    group
      .setName("forwarding")
      .setDescription("Manage webhook forwarding for an application")
      .addSubcommand((sub) =>
        sub
          .setName("set")
          .setDescription("Set the forwarding configuration")
          .addUserOption((opt) => opt.setName("bot").setDescription("The bot user").setRequired(true))
          .addStringOption((opt) => opt.setName("url").setDescription("The target webhook URL").setRequired(true))
          .addStringOption((opt) => opt.setName("secret").setDescription("The webhook secret").setRequired(true)),
      )
      .addSubcommand((sub) =>
        sub
          .setName("edit")
          .setDescription("Edit the forwarding configuration")
          .addUserOption((opt) => opt.setName("bot").setDescription("The bot user").setRequired(true))
          .addStringOption((opt) => opt.setName("url").setDescription("The new target webhook URL").setRequired(false))
          .addStringOption((opt) => opt.setName("secret").setDescription("The new webhook secret").setRequired(false)),
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove")
          .setDescription("Remove the forwarding configuration")
          .addUserOption((opt) => opt.setName("bot").setDescription("The bot user").setRequired(true)),
      )
      .addSubcommand((sub) =>
        sub
          .setName("view")
          .setDescription("View the forwarding configuration")
          .addUserOption((opt) => opt.setName("bot").setDescription("The bot user").setRequired(true)),
      ),
  );
