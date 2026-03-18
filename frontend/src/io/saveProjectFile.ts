import { serializeProject } from "./loadProjectFile";
import type { TilejamProject } from "../types/project";

export async function saveProjectToHandle(handle: FileSystemFileHandle, project: TilejamProject): Promise<void> {
  const writable = await handle.createWritable();

  try {
    await writable.write(serializeProject(project));
  } finally {
    await writable.close();
  }
}

export async function saveProjectWithPicker(
  project: TilejamProject,
  suggestedName = "latest.tilejam.json",
): Promise<FileSystemFileHandle | null> {
  if (!window.showSaveFilePicker) {
    return null;
  }

  const handle = await window.showSaveFilePicker({
    excludeAcceptAllOption: false,
    suggestedName,
    types: [
      {
        description: "Tilejam project",
        accept: {
          "application/json": [".json", ".tilejam.json"],
        },
      },
    ],
  });

  await saveProjectToHandle(handle, project);

  return handle;
}

export function downloadProjectFile(project: TilejamProject, filename = "latest.tilejam.json"): void {
  const blob = new Blob([serializeProject(project)], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(objectUrl);
}
