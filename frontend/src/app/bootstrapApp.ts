import { createProjectState } from "../data/createProjectState";
import { createAppController } from "./createAppController";

export async function bootstrapApp(root: HTMLDivElement | null): Promise<void> {
  if (!root) {
    throw new Error("App root was not found.");
  }

  const state = createProjectState();
  const controller = createAppController(root, state);

  await controller.initialize();
}
