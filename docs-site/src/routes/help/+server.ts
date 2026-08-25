import { redirect } from "@sveltejs/kit";

export const GET = () => {
  redirect(302, "https://github.com/The-LukeZ/upvote-engine/discussions/new?category=q-a");
};

export const prerender = true;
