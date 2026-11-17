import { redirect } from "@sveltejs/kit";
import { addBotUrl } from "#lib/constants.ts";

export const GET = () => {
  redirect(302, addBotUrl(0), { external: true });
};

export const prerender = true;
