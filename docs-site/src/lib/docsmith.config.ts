import { defineConfig } from "svelte-docsmith";

export const docsmithConfig = defineConfig({
  title: "Upvote Engine",
  description: "Discord vote-role bot documentation.",
  github: "https://github.com/The-LukeZ/upvote-engine",
  logo: "/upvote-engine.webp",
  nav: [
    { label: "Docs", href: "/docs/getting-started/" },
    { label: "Legal", href: "/legal/terms-of-service/" },
  ],
  footer: {
    poweredBy: true,
  },
  editUrl: "https://github.com/The-LukeZ/upvote-engine/edit/main/docs-site/src/routes",
});
