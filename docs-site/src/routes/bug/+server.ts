import { redirect } from "@sveltejs/kit";

export const GET = () => {
  redirect(302, "https://github.com/The-LukeZ/upvote-engine/issues");
};

export const prerender = true;
