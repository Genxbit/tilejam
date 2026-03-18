import type { ProjectState } from "../types/project";
import { applyProjectData, loadProjectFile, loadProjectFromHandle, loadProjectFromUrl } from "../io/loadProjectFile";
import { downloadProjectFile, saveProjectToHandle, saveProjectWithPicker } from "../io/saveProjectFile";
import { renderWorkspace } from "../rendering/renderWorkspace";
import { clearSourceImageAsset, loadSourceImageFromFile, loadSourceImageFromUrl } from "../systems/sourceImageSystem";
import { createShell } from "../ui/createShell";

export function createAppController(root: HTMLElement, state: ProjectState) {
  let resizeObserver: ResizeObserver | null = null;

  const shell = createShell({
    root,
    state,
    onFileSelected: async (file) => {
      await loadSourceImageFromFile(state, file);
      render();
    },
    onProjectSelected: async (file) => {
      try {
        const project = await loadProjectFile(file);
        await loadProjectIntoState(state, project, `Loaded project: ${file.name}.`);
        state.session.projectFileName = file.name;
        state.session.projectFileHandle = null;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown project import error.";
        state.session.message = `Project import failed: ${message}`;
      }

      render();
    },
    onOpenProject: async () => {
      if (!window.showOpenFilePicker) {
        return false;
      }

      try {
        const [handle] = await window.showOpenFilePicker({
          excludeAcceptAllOption: false,
          multiple: false,
          types: [
            {
              description: "Tilejam project",
              accept: {
                "application/json": [".json", ".tilejam.json"],
              },
            },
          ],
        });

        if (!handle) {
          return true;
        }

        const { file, project } = await loadProjectFromHandle(handle);
        await loadProjectIntoState(state, project, `Loaded project: ${file.name}.`);
        state.session.projectFileName = file.name;
        state.session.projectFileHandle = handle;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return true;
        }

        const message = error instanceof Error ? error.message : "Unknown project open error.";
        state.session.message = `Project open failed: ${message}`;
      }

      render();
      return true;
    },
    onSaveProject: async () => {
      try {
        if (state.session.projectFileHandle) {
          await saveProjectToHandle(state.session.projectFileHandle, state.project);
          state.session.message = `Saved project to ${state.session.projectFileName ?? "current file"}.`;
          render();
          return;
        }

        const suggestedName = state.session.projectFileName ?? "latest.tilejam.json";
        const handle = await saveProjectWithPicker(state.project, suggestedName);

        if (handle) {
          state.session.projectFileHandle = handle;
          state.session.projectFileName = suggestedName;
          state.session.message = `Saved project to ${suggestedName}. Future saves will overwrite that file in supported browsers.`;
          render();
          return;
        }

        downloadProjectFile(state.project, suggestedName);
        state.session.message = `Downloaded project as ${suggestedName}. Browser file overwrite is not supported here.`;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        const message = error instanceof Error ? error.message : "Unknown project save error.";
        state.session.message = `Project save failed: ${message}`;
      }

      render();
    },
  });

  function render(): void {
    shell.update(state);
    renderWorkspace(shell.canvas, state);
  }

  return {
    async initialize(): Promise<void> {
      resizeObserver = new ResizeObserver(() => {
        render();
      });
      resizeObserver.observe(shell.canvas);

      window.addEventListener("resize", render);

      try {
        const project = await loadProjectFromUrl("/projects/latest.tilejam.json");
        await loadProjectIntoState(state, project, "Loaded default project.");
        state.session.projectFileName = "latest.tilejam.json";
        state.session.projectFileHandle = null;
      } catch {
        await loadSourceImageFromUrl(state, "/sample-source.svg", "sample-source.svg");
      }

      render();
    },
  };
}

async function loadProjectIntoState(state: ProjectState, project: ProjectState["project"], messagePrefix: string): Promise<void> {
  applyProjectData(state, project);

  if (!project.sourceImage) {
    clearSourceImageAsset(state, `${messagePrefix} No source image reference was included.`);
    return;
  }

  try {
    await loadSourceImageFromUrl(state, project.sourceImage, project.sourceImage);
    state.session.message = `${messagePrefix} Source image resolved from ${project.sourceImage}.`;
  } catch {
    clearSourceImageAsset(
      state,
      `${messagePrefix} Source image "${project.sourceImage}" could not be resolved in the browser yet.`,
    );
  }
}
