import { redirect } from "@sveltejs/kit";
import { addBotUrl } from "$lib/constants";

export const GET = () => {
  redirect(302, addBotUrl(1));
};

export const prerender = true;
