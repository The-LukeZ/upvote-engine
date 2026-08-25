export const DISCORD_APPLICATION_ID = "1435613778547834910";

export const addBotUrl = (integrationType: 0 | 1 = 0) =>
  `https://discord.com/oauth2/authorize?integration_type=${integrationType}&client_id=${DISCORD_APPLICATION_ID}&scope=applications.commands${
    integrationType === 0 ? "+bot" : ""
  }`;
