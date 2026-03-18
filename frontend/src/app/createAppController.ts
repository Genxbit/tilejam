import type { ProjectState } from "../types/project";
import { loadProjectFile, loadProjectFromHandle, loadProjectFromUrl } from "../io/loadProjectFile";
import { downloadProjectFile, saveProjectToHandle, saveProjectWithPicker } from "../io/saveProjectFile";
import { renderWorkspace } from "../rendering/renderWorkspace";
import { assignSelectionToOutputTile } from "../systems/tilePlacementSystem";
import { clearSelectionState, commitDraftSourceSelection, setHoveredOutputTile, updateDraftSourceSelection } from "../systems/selectionSystem";
import { clearSourceImageAsset, loadSourceImageFromFile, loadSourceImageFromUrl } from "../systems/sourceImageSystem";
import { getOutputGridMetrics, getProjectPixelSize, setOutputImageSize, setOutputTileSize, setSourceGridTileSize } from "../systems/tileGridSystem";
import {
  getCanvasPoint,
  getOutputGridCellAtPoint,
  getPanelAtPoint,
  getSourceGridCellAtPoint,
  getWorkspaceLayout,
  panWorkspacePanel,
  resetWorkspaceView,
  zoomWorkspacePanel,
} from "../systems/workspaceSystem";
import { createShell } from "../ui/createShell";

export function createAppController(root: HTMLElement, state: ProjectState) {
  let resizeObserver: ResizeObserver | null = null;
  let activePointerId: number | null = null;
  let sourceDragAnchor: { col: number; row: number } | null = null;
  let dragMode: "select" | "pan" | null = null;
  let panPanel: "source" | "output" | null = null;
  let lastPointerPoint: { x: number; y: number } | null = null;

  const shell = createShell({
    root,
    state,
    onFileSelected: async (file) => {
      await loadSourceImageFromFile(state, file);
      clearSelectionState(state);
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
      clearSelectionState(state);
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

  function handlePointerDown(event: PointerEvent): void {
    const point = getCanvasPoint(shell.canvas, event);
    const layout = getWorkspaceLayout(shell.canvas.width, shell.canvas.height, state);
    const hoveredPanel = getPanelAtPoint(layout, point.x, point.y);
    state.session.hoveredPanel = hoveredPanel;

    if ((event.button === 1 || event.altKey) && hoveredPanel) {
      activePointerId = event.pointerId;
      dragMode = "pan";
      panPanel = hoveredPanel;
      lastPointerPoint = point;
      sourceDragAnchor = null;
      shell.canvas.setPointerCapture(event.pointerId);
      state.session.message = `Panning ${hoveredPanel} view.`;
      render();
      return;
    }

    const sourceHit = getSourceGridCellAtPoint(layout, state, point.x, point.y);

    if (event.button === 0 && sourceHit) {
      activePointerId = event.pointerId;
      dragMode = "select";
      sourceDragAnchor = sourceHit;
      lastPointerPoint = point;
      updateDraftSourceSelection(state, sourceHit, sourceHit);
      setHoveredOutputTile(state, null);
      shell.canvas.setPointerCapture(event.pointerId);
      state.session.message = `Selecting source tiles from ${sourceHit.col}, ${sourceHit.row}.`;
      render();
      return;
    }

    const outputHit = getOutputGridCellAtPoint(layout, point.x, point.y);

    if (event.button !== 0 || !outputHit) {
      setHoveredOutputTile(state, null);
      render();
      return;
    }

    setHoveredOutputTile(state, outputHit);

    if (!state.session.sourceSelection) {
      state.session.message = "Select one or more source tiles first, then click the output grid to place them.";
      render();
      return;
    }

    const assignedCount = assignSelectionToOutputTile(
      state,
      state.session.sourceSelection,
      outputHit.col,
      outputHit.row,
    );

    if (assignedCount > 0) {
      state.session.sourceSelection = null;
      state.session.draftSourceSelection = null;
      state.session.message = `Placed ${assignedCount} tile${assignedCount === 1 ? "" : "s"} starting at output tile ${outputHit.col}, ${outputHit.row}. Select source tiles again for the next placement.`;
    } else {
      state.session.message = "Selection did not fit inside the output grid.";
    }
    render();
  }

  function handlePointerMove(event: PointerEvent): void {
    const point = getCanvasPoint(shell.canvas, event);
    const layout = getWorkspaceLayout(shell.canvas.width, shell.canvas.height, state);
    state.session.hoveredPanel = getPanelAtPoint(layout, point.x, point.y);

    if (activePointerId === event.pointerId && dragMode === "pan" && panPanel && lastPointerPoint) {
      panWorkspacePanel(state, panPanel, point.x - lastPointerPoint.x, point.y - lastPointerPoint.y, layout);
      lastPointerPoint = point;
      state.session.message = `Panning ${panPanel} view.`;
      render();
      return;
    }

    if (activePointerId === event.pointerId && dragMode === "select" && sourceDragAnchor) {
      const sourceHit = getSourceGridCellAtPoint(layout, state, point.x, point.y, true);

      if (sourceHit) {
        updateDraftSourceSelection(state, sourceDragAnchor, sourceHit);
        state.session.message = `Selecting ${state.session.draftSourceSelection?.columns ?? 0} x ${state.session.draftSourceSelection?.rows ?? 0} source tiles.`;
        render();
      }

      return;
    }

    const outputHit = getOutputGridCellAtPoint(layout, point.x, point.y);
    const currentHovered = state.session.hoveredOutputTile;

    if (
      currentHovered?.col === outputHit?.col &&
      currentHovered?.row === outputHit?.row
    ) {
      return;
    }

    setHoveredOutputTile(state, outputHit);
    render();
  }

  function handlePointerUp(event: PointerEvent): void {
    if (activePointerId !== event.pointerId) {
      return;
    }

    if (dragMode === "pan") {
      activePointerId = null;
      dragMode = null;
      panPanel = null;
      lastPointerPoint = null;

      if (shell.canvas.hasPointerCapture(event.pointerId)) {
        shell.canvas.releasePointerCapture(event.pointerId);
      }

      render();
      return;
    }

    if (!sourceDragAnchor) {
      activePointerId = null;
      dragMode = null;
      lastPointerPoint = null;
      return;
    }

    const selection = commitDraftSourceSelection(state);
    activePointerId = null;
    dragMode = null;
    sourceDragAnchor = null;
    lastPointerPoint = null;

    if (shell.canvas.hasPointerCapture(event.pointerId)) {
      shell.canvas.releasePointerCapture(event.pointerId);
    }

    state.session.message = selection
      ? `Selected ${selection.columns} x ${selection.rows} source tile${selection.columns * selection.rows === 1 ? "" : "s"}. Click the output grid to place them.`
      : "Source selection cleared.";
    render();
  }

  function handlePointerCancel(event: PointerEvent): void {
    if (activePointerId !== event.pointerId) {
      return;
    }

    state.session.draftSourceSelection = null;
    activePointerId = null;
    dragMode = null;
    panPanel = null;
    sourceDragAnchor = null;
    lastPointerPoint = null;

    if (shell.canvas.hasPointerCapture(event.pointerId)) {
      shell.canvas.releasePointerCapture(event.pointerId);
    }

    render();
  }

  function handleWheel(event: WheelEvent): void {
    const point = getCanvasPoint(shell.canvas, event);
    const layout = getWorkspaceLayout(shell.canvas.width, shell.canvas.height, state);
    const panel = getPanelAtPoint(layout, point.x, point.y);

    if (!panel) {
      return;
    }

    const zoom = zoomWorkspacePanel(state, panel, layout, point.x, point.y, event.deltaY);

    if (zoom === null) {
      return;
    }

    event.preventDefault();
    state.session.hoveredPanel = panel;
    state.session.message = `${panel === "source" ? "Source" : "Output"} zoom set to ${zoom.toFixed(2)}x.`;
    render();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if ((event.code === "Digit0" || event.code === "Numpad0") && state.session.hoveredPanel) {
      resetWorkspaceView(state, state.session.hoveredPanel);
      state.session.message = `${state.session.hoveredPanel === "source" ? "Source" : "Output"} view reset.`;
      render();
    }
  }

  return {
    async initialize(): Promise<void> {
      resizeObserver = new ResizeObserver(() => {
        render();
      });
      resizeObserver.observe(shell.canvas);

      window.addEventListener("resize", render);
      window.addEventListener("keydown", handleKeyDown);
      shell.canvas.addEventListener("pointerdown", handlePointerDown);
      shell.canvas.addEventListener("pointermove", handlePointerMove);
      shell.canvas.addEventListener("pointerup", handlePointerUp);
      shell.canvas.addEventListener("pointercancel", handlePointerCancel);
      shell.canvas.addEventListener("wheel", handleWheel, { passive: false });
      shell.canvas.addEventListener("contextmenu", (event) => {
        event.preventDefault();
      });

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
  clearSelectionState(state);

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
