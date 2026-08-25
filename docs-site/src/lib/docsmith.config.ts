import { defineConfig } from "svelte-docsmith";

export const docsmithConfig = defineConfig({
  title: "Upvote Engine",
  description: "Discord vote-handler bot documentation.",
  github: "https://github.com/The-LukeZ/upvote-engine",
  logo: "/upvote-engine.webp",
  nav: [{ label: "Docs", href: "/docs/getting-started/" }],
  url: "https://upvote-engine.thelukez.com/",
  footer: {
    poweredBy: true,
  },
  editUrl: "https://github.com/The-LukeZ/upvote-engine/edit/main/docs-site/src/routes",
});
