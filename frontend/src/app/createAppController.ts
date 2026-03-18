import type { ProjectState } from "../types/project";
import { exportTilesetPng, exportTilesetTsj } from "../io/exportTileset";
import { loadProjectFile, loadProjectFromHandle, loadProjectFromUrl } from "../io/loadProjectFile";
import { downloadProjectFile, saveProjectToHandle, saveProjectWithPicker } from "../io/saveProjectFile";
import { renderWorkspace } from "../rendering/renderWorkspace";
import { clearSelectedOutputTile, moveSelectedOutputTileBy, moveTileToCell, selectOutputTileAtCell, updateSelectedOutputTile } from "../systems/tileEditorSystem";
import { assignAllSourceTilesToOutputGrid, assignSelectionToOutputTile } from "../systems/tilePlacementSystem";
import { clearSelectionState, commitDraftSourceSelection, setHoveredOutputTile, updateDraftSourceSelection } from "../systems/selectionSystem";
import { clearSourceImageAsset, loadSourceImageFromFile, loadSourceImageFromUrl } from "../systems/sourceImageSystem";
import { getOutputGridMetrics, getProjectPixelSize, normalizeProjectTilesToGrid, setOutputImageSize, setOutputTileSize, setSourceGridTileSize } from "../systems/tileGridSystem";
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

type HistoryEntry = {
  project: ProjectState["project"];
  selectedOutputTileId: number | null;
};

export function createAppController(root: HTMLElement, state: ProjectState) {
  let resizeObserver: ResizeObserver | null = null;
  let activePointerId: number | null = null;
  let sourceDragAnchor: { col: number; row: number } | null = null;
  let dragMode: "select" | "pan" | "move-tile" | null = null;
  let panPanel: "source" | "output" | null = null;
  let lastPointerPoint: { x: number; y: number } | null = null;
  let movingTileId: number | null = null;
  let movingTileOrigin: { col: number; row: number } | null = null;
  let canvasRenderQueued = false;
  const undoStack: HistoryEntry[] = [];
  const redoStack: HistoryEntry[] = [];

  const shell = createShell({
    root,
    state,
    onFileSelected: async (file) => {
      await loadSourceImageFromFile(state, file);
      bumpRenderRevision();
      clearSelectionState(state);
      clearSelectedOutputTile(state);
      state.session.message = `Loaded source image: ${file.name}. Existing output tiles keep their previous source references when available.`;
      renderAll();
    },
    onProjectSelected: async (file) => {
      try {
        const project = await loadProjectFile(file);
        state.session.projectFileName = file.name;
        state.session.projectFileHandle = null;
        await loadProjectIntoState(state, project, `Loaded project: ${file.name}.`);
        bumpRenderRevision();
        undoStack.length = 0;
        redoStack.length = 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown project import error.";
        state.session.message = `Project import failed: ${message}`;
      }

      renderAll();
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
        bumpRenderRevision();
        undoStack.length = 0;
        redoStack.length = 0;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return true;
        }

        const message = error instanceof Error ? error.message : "Unknown project open error.";
        state.session.message = `Project open failed: ${message}`;
      }

      renderAll();
      return true;
    },
    onSaveProject: async () => {
      try {
        if (state.session.projectFileHandle) {
          await saveProjectToHandle(state.session.projectFileHandle, state.project);
          state.session.message = `Saved project to ${state.session.projectFileName ?? "current file"}.`;
          renderAll();
          return;
        }

        const suggestedName = state.session.projectFileName ?? "latest.tilejam.json";
        const handle = await saveProjectWithPicker(state.project, suggestedName);

        if (handle) {
          state.session.projectFileHandle = handle;
          state.session.projectFileName = suggestedName;
          state.session.message = `Saved project to ${suggestedName}. Future saves will overwrite that file in supported browsers.`;
          renderAll();
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

      renderAll();
    },
    onExportPng: async () => {
      try {
        const filename = getExportFilename(state, "png");
        const result = await exportTilesetPng(state, filename);
        state.session.message = result.missingTileCount > 0
          ? `Exported ${filename}. ${result.missingTileCount} tile${result.missingTileCount === 1 ? "" : "s"} could not be rendered because their source image is unavailable.`
          : `Exported ${filename}.`;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown PNG export error.";
        state.session.message = `PNG export failed: ${message}`;
      }

      renderAll();
    },
    onExportTsj: async () => {
      try {
        const filename = getExportFilename(state, "tsj");
        exportTilesetTsj(state, filename);
        state.session.message = `Exported ${filename}.`;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown TSJ export error.";
        state.session.message = `TSJ export failed: ${message}`;
      }

      renderAll();
    },
    onSourceGridSizeChanged: (tileSize) => {
      recordHistory();
      setSourceGridTileSize(state, tileSize);
      bumpRenderRevision();
      clearSelectionState(state);
      state.session.message = `Source grid set to ${tileSize} x ${tileSize}.`;
      renderAll();
    },
    onOutputTileSizeChanged: (tileSize) => {
      recordHistory();
      setOutputTileSize(state, tileSize);
      const dropped = normalizeProjectTilesToGrid(state);
      bumpRenderRevision();
      const grid = getOutputGridMetrics(state.project);
      const outputPixels = getProjectPixelSize(state.project);
      state.session.message = dropped > 0
        ? `Output tile set to ${tileSize} x ${tileSize}. Output grid is now ${grid.columns} x ${grid.rows} inside ${outputPixels.width} x ${outputPixels.height}. ${dropped} out-of-bounds tile${dropped === 1 ? "" : "s"} were removed.`
        : `Output tile set to ${tileSize} x ${tileSize}. Output grid is now ${grid.columns} x ${grid.rows} inside ${outputPixels.width} x ${outputPixels.height}.`;
      renderAll();
    },
    onOutputWidthChanged: (width) => {
      recordHistory();
      setOutputImageSize(state, width, state.project.outputHeight);
      const dropped = normalizeProjectTilesToGrid(state);
      bumpRenderRevision();
      const grid = getOutputGridMetrics(state.project);
      state.session.message = dropped > 0
        ? `Output image width set to ${state.project.outputWidth}. Output grid is ${grid.columns} x ${grid.rows}. ${dropped} out-of-bounds tile${dropped === 1 ? "" : "s"} were removed.`
        : `Output image width set to ${state.project.outputWidth}. Output grid is ${grid.columns} x ${grid.rows}.`;
      renderAll();
    },
    onOutputHeightChanged: (height) => {
      recordHistory();
      setOutputImageSize(state, state.project.outputWidth, height);
      const dropped = normalizeProjectTilesToGrid(state);
      bumpRenderRevision();
      const grid = getOutputGridMetrics(state.project);
      state.session.message = dropped > 0
        ? `Output image height set to ${state.project.outputHeight}. Output grid is ${grid.columns} x ${grid.rows}. ${dropped} out-of-bounds tile${dropped === 1 ? "" : "s"} were removed.`
        : `Output image height set to ${state.project.outputHeight}. Output grid is ${grid.columns} x ${grid.rows}.`;
      renderAll();
    },
    onSelectedTileUpdated: (patch) => {
      recordHistory();
      const tile = updateSelectedOutputTile(state, patch);

      if (!tile) {
        undoStack.pop();
        state.session.message = "Select an output tile before editing it.";
        renderAll();
        return;
      }

      bumpRenderRevision();
      state.session.message = `Updated tile ${tile.id} at ${tile.destCol}, ${tile.destRow}.`;
      renderAll();
    },
    onUndo: () => {
      applyUndo();
    },
    onRedo: () => {
      applyRedo();
    },
    onCopyAllTiles: () => {
      recordHistory();
      clearSelectedOutputTile(state);
      const placed = assignAllSourceTilesToOutputGrid(state);

      if (placed < 1) {
        undoStack.pop();
        state.session.message = "Load a source image before copying all source tiles.";
      } else {
        bumpRenderRevision();
        state.session.sourceSelection = null;
        state.session.draftSourceSelection = null;
        state.session.message = `Copied ${placed} source tile${placed === 1 ? "" : "s"} into the output grid.`;
      }

      renderAll();
    },
  });

  function renderAll(): void {
    shell.update(state);
    renderWorkspace(shell.canvas, state);
  }

  function renderCanvas(): void {
    renderWorkspace(shell.canvas, state);
  }

  function requestCanvasRender(): void {
    if (canvasRenderQueued) {
      return;
    }

    canvasRenderQueued = true;
    requestAnimationFrame(() => {
      canvasRenderQueued = false;
      renderCanvas();
    });
  }

  function recordHistory(): void {
    undoStack.push(createHistoryEntry(state));
    redoStack.length = 0;
  }

  function bumpRenderRevision(): void {
    state.session.renderRevision += 1;
  }

  function applyUndo(): void {
    const entry = undoStack.pop();

    if (!entry) {
      state.session.message = "Nothing to undo.";
      renderAll();
      return;
    }

    redoStack.push(createHistoryEntry(state));
    restoreHistoryEntry(state, entry);
    bumpRenderRevision();
    state.session.message = "Undid the last change.";
    renderAll();
  }

  function applyRedo(): void {
    const entry = redoStack.pop();

    if (!entry) {
      state.session.message = "Nothing to redo.";
      renderAll();
      return;
    }

    undoStack.push(createHistoryEntry(state));
    restoreHistoryEntry(state, entry);
    bumpRenderRevision();
    state.session.message = "Redid the last change.";
    renderAll();
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
      renderAll();
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
      renderAll();
      return;
    }

    const outputHit = getOutputGridCellAtPoint(layout, point.x, point.y);

    if (event.button !== 0 || !outputHit) {
      setHoveredOutputTile(state, null);
      requestCanvasRender();
      return;
    }

    setHoveredOutputTile(state, outputHit);

    if (!state.session.sourceSelection) {
      const selectedTile = selectOutputTileAtCell(state, outputHit.col, outputHit.row);
      if (selectedTile) {
        activePointerId = event.pointerId;
        dragMode = "move-tile";
        movingTileId = selectedTile.id;
        movingTileOrigin = { col: selectedTile.destCol, row: selectedTile.destRow };
        shell.canvas.setPointerCapture(event.pointerId);
        state.session.message = `Selected tile ${selectedTile.id} at ${selectedTile.destCol}, ${selectedTile.destRow}. Drag to move it.`;
      } else {
        clearSelectedOutputTile(state);
        state.session.message = "No placed tile at that output cell.";
      }
      renderAll();
      return;
    }

    recordHistory();
    const assignedCount = assignSelectionToOutputTile(
      state,
      state.session.sourceSelection,
      outputHit.col,
      outputHit.row,
    );

    if (assignedCount > 0) {
      bumpRenderRevision();
      clearSelectedOutputTile(state);
      state.session.sourceSelection = null;
      state.session.draftSourceSelection = null;
      state.session.message = `Placed ${assignedCount} tile${assignedCount === 1 ? "" : "s"} starting at output tile ${outputHit.col}, ${outputHit.row}. Select source tiles again for the next placement.`;
    } else {
      undoStack.pop();
      state.session.message = "Selection did not fit inside the output grid.";
    }
    renderAll();
  }

  function handlePointerMove(event: PointerEvent): void {
    const point = getCanvasPoint(shell.canvas, event);
    const layout = getWorkspaceLayout(shell.canvas.width, shell.canvas.height, state);
    state.session.hoveredPanel = getPanelAtPoint(layout, point.x, point.y);

    if (activePointerId === event.pointerId && dragMode === "pan" && panPanel && lastPointerPoint) {
      panWorkspacePanel(state, panPanel, point.x - lastPointerPoint.x, point.y - lastPointerPoint.y, layout);
      lastPointerPoint = point;
      requestCanvasRender();
      return;
    }

    if (activePointerId === event.pointerId && dragMode === "select" && sourceDragAnchor) {
      const sourceHit = getSourceGridCellAtPoint(layout, state, point.x, point.y, true);

      if (sourceHit) {
        updateDraftSourceSelection(state, sourceDragAnchor, sourceHit);
        requestCanvasRender();
      }

      return;
    }

    if (activePointerId === event.pointerId && dragMode === "move-tile" && movingTileId !== null) {
      const outputHit = getOutputGridCellAtPoint(layout, point.x, point.y);
      const currentHovered = state.session.hoveredOutputTile;
      setHoveredOutputTile(state, outputHit);
      if (currentHovered?.col !== outputHit?.col || currentHovered?.row !== outputHit?.row) {
        requestCanvasRender();
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
    requestCanvasRender();
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

      renderAll();
      return;
    }

    if (dragMode === "move-tile" && movingTileId !== null) {
      const point = getCanvasPoint(shell.canvas, event);
      const layout = getWorkspaceLayout(shell.canvas.width, shell.canvas.height, state);
      const outputHit = getOutputGridCellAtPoint(layout, point.x, point.y);
      const shouldMove = outputHit && movingTileOrigin
        ? outputHit.col !== movingTileOrigin.col || outputHit.row !== movingTileOrigin.row
        : false;

      if (shouldMove) {
        recordHistory();
      }

      const movedTile = outputHit ? moveTileToCell(state, movingTileId, outputHit.col, outputHit.row) : null;
      const moved = movedTile && movingTileOrigin
        ? movedTile.destCol !== movingTileOrigin.col || movedTile.destRow !== movingTileOrigin.row
        : false;

      activePointerId = null;
      dragMode = null;
      movingTileId = null;
      movingTileOrigin = null;
      lastPointerPoint = null;

      if (shell.canvas.hasPointerCapture(event.pointerId)) {
        shell.canvas.releasePointerCapture(event.pointerId);
      }

      state.session.message = movedTile
        ? moved
          ? `Moved tile ${movedTile.id} to ${movedTile.destCol}, ${movedTile.destRow}.`
          : `Selected tile ${movedTile.id} at ${movedTile.destCol}, ${movedTile.destRow}.`
        : "Tile move cancelled.";
      if (moved) {
        bumpRenderRevision();
      }
      renderAll();
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
    renderAll();
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
    movingTileId = null;
    movingTileOrigin = null;
    lastPointerPoint = null;

    if (shell.canvas.hasPointerCapture(event.pointerId)) {
      shell.canvas.releasePointerCapture(event.pointerId);
    }

    renderAll();
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
    renderAll();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) {
      return;
    }

    if ((event.code === "Digit0" || event.code === "Numpad0") && state.session.hoveredPanel) {
      resetWorkspaceView(state, state.session.hoveredPanel);
      state.session.message = `${state.session.hoveredPanel === "source" ? "Source" : "Output"} view reset.`;
      renderAll();
      return;
    }

    const movement =
      event.code === "ArrowLeft" ? { col: -1, row: 0 } :
      event.code === "ArrowRight" ? { col: 1, row: 0 } :
      event.code === "ArrowUp" ? { col: 0, row: -1 } :
      event.code === "ArrowDown" ? { col: 0, row: 1 } :
      null;

    if (movement) {
      const movedTile = moveSelectedOutputTileBy(state, movement.col, movement.row);

      if (movedTile) {
        event.preventDefault();
        state.session.message = `Moved tile ${movedTile.id} to ${movedTile.destCol}, ${movedTile.destRow}.`;
        renderAll();
      }
    }
  }

  return {
    async initialize(): Promise<void> {
      resizeObserver = new ResizeObserver(() => {
        renderCanvas();
      });
      resizeObserver.observe(shell.canvas);

      window.addEventListener("resize", renderCanvas);
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
        bumpRenderRevision();
        undoStack.length = 0;
        redoStack.length = 0;
      } catch {
        await loadSourceImageFromUrl(state, "/sample-source.svg", "sample-source.svg");
        state.project.sourceTileWidth = 32;
        state.project.sourceTileHeight = 32;
        state.project.tileWidth = 32;
        state.project.tileHeight = 32;
        state.project.outputWidth = 1024;
        state.project.outputHeight = 1024;
        state.session.message = "Loaded fallback sample image with default source/output grid settings.";
        bumpRenderRevision();
        undoStack.length = 0;
        redoStack.length = 0;
      }

      renderAll();
    },
  };
}

function createHistoryEntry(state: ProjectState): HistoryEntry {
  return {
    project: JSON.parse(JSON.stringify(state.project)) as ProjectState["project"],
    selectedOutputTileId: state.session.selectedOutputTileId,
  };
}

function restoreHistoryEntry(state: ProjectState, entry: HistoryEntry): void {
  state.project = JSON.parse(JSON.stringify(entry.project)) as ProjectState["project"];
  state.session.selectedOutputTileId = entry.selectedOutputTileId;
  normalizeProjectTilesToGrid(state);
}

function getExportFilename(state: ProjectState, extension: "png" | "tsj"): string {
  const projectName = state.session.projectFileName ?? "latest.tilejam.json";
  const baseName = projectName.replace(/(?:\.tilejam)?\.json$/i, "");
  return `${baseName || "tileset"}.${extension}`;
}

async function loadProjectIntoState(state: ProjectState, project: ProjectState["project"], messagePrefix: string): Promise<void> {
  state.project = project;
  clearSelectionState(state);
  clearSelectedOutputTile(state);

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
