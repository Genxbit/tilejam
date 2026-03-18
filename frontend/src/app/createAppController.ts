import type { ProjectState } from "../types/project";
import { loadProjectFile, loadProjectFromHandle, loadProjectFromUrl } from "../io/loadProjectFile";
import { downloadProjectFile, saveProjectToHandle, saveProjectWithPicker } from "../io/saveProjectFile";
import { renderWorkspace } from "../rendering/renderWorkspace";
import { clearSourceImageAsset, loadSourceImageFromFile, loadSourceImageFromUrl } from "../systems/sourceImageSystem";
import { getOutputGridMetrics, getProjectPixelSize, getProjectIndexRange, setOutputImageSize, setOutputTileSize, setSourceGridTileSize } from "../systems/tileGridSystem";
import { createShell } from "../ui/createShell";

export function createAppController(root: HTMLElement, state: ProjectState) {
  let resizeObserver: ResizeObserver | null = null;

  const shell = createShell({
    root,
    state,
    onFileSelected: async (file) => {
      await loadSourceImageFromFile(state, file);
      state.session.message = `Loaded source image: ${file.name}. The project stores this as a reference, so reopening may require relinking the image.`;
      render();
    },
    onProjectSelected: async (file) => {
      try {
        const project = await loadProjectFile(file);
        state.session.projectFileName = file.name;
        state.session.projectFileHandle = null;
        await loadProjectIntoState(state, project, `Loaded project: ${file.name}.`);
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
        state.session.projectFileName = file.name;
        state.session.projectFileHandle = handle;
        await loadProjectIntoState(state, project, `Loaded project: ${file.name}.`);
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
    onSourceGridSizeChanged: (tileSize) => {
      setSourceGridTileSize(state, tileSize);
      state.session.message = `Source grid set to ${tileSize} x ${tileSize}.`;
      render();
    },
    onOutputTileSizeChanged: (tileSize) => {
      setOutputTileSize(state, tileSize);
      const grid = getOutputGridMetrics(state.project);
      const outputPixels = getProjectPixelSize(state.project);
      state.session.message = `Output tile set to ${tileSize} x ${tileSize}. Output grid is now ${grid.columns} x ${grid.rows} inside ${outputPixels.width} x ${outputPixels.height}.`;
      render();
    },
    onOutputWidthChanged: (width) => {
      setOutputImageSize(state, width, state.project.outputHeight);
      const grid = getOutputGridMetrics(state.project);
      state.session.message = `Output image width set to ${state.project.outputWidth}. Output grid is ${grid.columns} x ${grid.rows}.`;
      render();
    },
    onOutputHeightChanged: (height) => {
      setOutputImageSize(state, state.project.outputWidth, height);
      const grid = getOutputGridMetrics(state.project);
      state.session.message = `Output image height set to ${state.project.outputHeight}. Output grid is ${grid.columns} x ${grid.rows}.`;
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
        state.session.projectFileName = "latest.tilejam.json";
        state.session.projectFileHandle = null;
        const project = await loadProjectFromUrl("/projects/latest.tilejam.json");
        await loadProjectIntoState(state, project, "Loaded default project.");
      } catch {
        await loadSourceImageFromUrl(state, "/sample-source.svg", "sample-source.svg");
        state.project.sourceTileWidth = 32;
        state.project.sourceTileHeight = 32;
        state.project.tileWidth = 32;
        state.project.tileHeight = 32;
        state.project.outputWidth = 1024;
        state.project.outputHeight = 1024;
        state.session.message = "Loaded fallback sample image with default source/output grid settings.";
      }

      render();
    },
  };
}

async function loadProjectIntoState(state: ProjectState, project: ProjectState["project"], messagePrefix: string): Promise<void> {
  state.project = project;

  if (!project.sourceImage) {
    clearSourceImageAsset(state);
    state.session.message = `${messagePrefix} No source image reference was included.`;
    return;
  }

  try {
    await loadSourceImageFromUrl(state, project.sourceImage, project.sourceImage);
    state.session.message = `${messagePrefix} Source image resolved from ${project.sourceImage}.`;
  } catch {
    clearSourceImageAsset(state);
    state.session.message = `${messagePrefix} Source image "${project.sourceImage}" could not be resolved automatically. Use "Choose image" to relink it.`;
  }
}
