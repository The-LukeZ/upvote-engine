import { sveltekit } from "@sveltejs/kit/vite";
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { docsmith } from "svelte-docsmith/vite";
import { docsmith as docsmithPreprocess } from "svelte-docsmith/preprocess";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    docsmith({ content: "src/routes" }),
    tailwindcss(),
    sveltekit({
      extensions: [".svelte", ".md"],
      preprocess: [vitePreprocess(), docsmithPreprocess()],
      adapter: adapter({
        pages: "../public",
        assets: "../public",
        fallback: undefined,
        strict: true,
      }),
    }),
  ],
});
