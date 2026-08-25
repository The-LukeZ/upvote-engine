import { redirect } from "@sveltejs/kit";
import { DISCORD_APPLICATION_ID } from "$lib/constants";

export const GET = () => {
  redirect(302, `https://discord.com/discovery/applications/${DISCORD_APPLICATION_ID}`);
};

export const prerender = true;
