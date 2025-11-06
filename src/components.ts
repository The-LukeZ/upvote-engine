import { APIMessageComponentInteraction } from "discord-api-types/v10";
import { ModalInteraction } from "./discord/ModalInteraction";
import { MyContext } from "../types";

export async function handleComponentInteraction(c: MyContext) {
  await c.get("modal").reply({ content: "Component interaction received!" }, true);
}
