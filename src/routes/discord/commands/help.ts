import { Colors, SlashCommandHandler } from "honocord";
import { MyContext } from "../../../../types";
import { ContainerBuilder, ButtonBuilder, type ActionRowBuilder } from "@discordjs/builders";
import { MessageFlags } from "discord-api-types/v10";

const helpMsg = (urlBase: string) => ({
  flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  components: [
    new ContainerBuilder()
      .setAccentColor(Colors.Blurple)
      .addTextDisplayComponents((t) =>
        t.setContent(
          "# Upvote Engine\nThis is an open-source Discord Bot that handles votes from platforms like top,gg and applies roles, either temporary or permanently, in your associated discord server.",
        ),
      )
      .addSeparatorComponents((s) => s.setSpacing(2).setDivider(false))
      .addActionRowComponents((row: ActionRowBuilder<ButtonBuilder>) =>
        row.addComponents(
          new ButtonBuilder({
            style: 5,
            label: "All Links",
            url: urlBase,
            emoji: {
              name: "🌐",
            },
          }),
          new ButtonBuilder({
            style: 5,
            label: "Wiki",
            url: urlBase + "/wiki",
            emoji: {
              name: "📖",
            },
          }),
          new ButtonBuilder({
            style: 5,
            label: "Report a Bug",
            url: urlBase + "/bug",
            emoji: {
              name: "🚨",
            },
          }),
          new ButtonBuilder({
            style: 5,
            label: "Q & A",
            url: urlBase + "/help",
            emoji: {
              name: "🙋‍♂️",
            },
          }),
        ),
      )
      .addSectionComponents((s) =>
        s
          .addTextDisplayComponents((t) =>
            t.setContent("💙 If you like this project, you can support the creator, by buying him a cup of tea! (He doesn't drink coffee)"),
          )
          .setButtonAccessory(
            new ButtonBuilder({
              style: 5,
              label: "Buy me a cup of tea!",
              url: "https://ko-fi.com/lukez",
              emoji: {
                name: "🍵",
              },
            }),
          ),
      )
      .toJSON(),
  ],
});

export const helpCommand = new SlashCommandHandler<MyContext>().addHandler((ctx) => {
  const currentUrl = new URL(ctx.context.req.url);
  currentUrl.pathname = "";
  return ctx.reply(helpMsg(currentUrl.toString().replace(/\/$/, "")));
});
