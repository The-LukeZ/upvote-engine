import { sveltekit } from "@sveltejs/kit/vite";
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { docsmith } from "svelte-docsmith/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    docsmith({
      content: "src/routes",
      site: {
        title: "Upvote Engine",
        description: "Discord vote-handler bot documentation.",
        github: "https://github.com/The-LukeZ/upvote-engine",
        logo: "/upvote-engine.webp",
        nav: [{ label: "Docs", href: "/docs/getting-started/" }],
        url: "https://upvote-engine.thelukez.com/",
        footer: {
          poweredBy: true,
        },
        editUrl: "https://github.com/The-LukeZ/upvote-engine/edit/main/docs-site",
      },
      // Keep the pre-0.22 code block colours instead of following the theme tokens.
      codeTheme: { light: "github-light", dark: "github-dark" },
    }),
    tailwindcss(),
    sveltekit({
      extensions: [".svelte", ".md"],
      preprocess: [vitePreprocess()],
      adapter: adapter({
        pages: "../public",
        assets: "../public",
        fallback: undefined,
        strict: true,
      }),
    }),
  ],
});
