import type { ProjectState, TilePlacement } from "../types/project";
import { saveTilesetPngToHandle, saveTilesetPngWithPicker, saveTilesetTsjWithPicker } from "../io/exportTileset";
import { loadProjectFile, loadProjectFromHandle, loadProjectFromUrl } from "../io/loadProjectFile";
import { loadSceneFile, loadSceneFromHandle, loadSceneFromUrl, saveSceneToHandle, saveSceneWithPicker } from "../io/sceneFile";
import { downloadProjectFile, saveProjectToHandle, saveProjectWithPicker } from "../io/saveProjectFile";
import { renderWorkspace } from "../rendering/renderWorkspace";
import { createProjectState } from "../data/createProjectState";
import {
  alignSelectedOutputTile,
  clearSelectedOutputTile,
  copySelectedOutputTiles,
  deleteSelectedOutputTile,
  getSelectedOutputCells,
  getSelectedOutputTile,
  getSelectedOutputTiles,
  moveSelectedOutputTileBy,
  moveTileToCell,
  nudgeSelectedOutputTile,
  pasteOutputTileClipboard,
  rotateSelectedOutputTileByQuarterTurns,
  selectOutputTileAtCell,
  selectOutputTileRectangle,
  setSelectedOutputTileFitMode,
  snapSelectedOutputTileToEdges,
  trimSelectedOutputTileTransparentBounds,
  updateSelectedOutputTile,
} from "../systems/tileEditorSystem";
import { assignAllSourceTilesToOutputGrid, assignSelectionToOutputTile, copySourceSelectionToOutputClipboard, rebuildTilesFromWorkingSheet } from "../systems/tilePlacementSystem";
import { addSceneLayer, clearSceneLayers, copySelectedSceneCells, copySourceSelectionToSceneClipboard, deleteSelectedSceneCells, ensureScene, getActiveSceneLayer, getSelectedSceneCells, moveActiveSceneLayerBy, moveSelectedSceneCellBy, moveSelectedSceneCellsTo, pasteSceneClipboard, placeSelectionIntoScene, resetScene, resizeScene, selectSceneCell, selectSceneCellRectangle, selectSceneLayer, setSceneTilesetSource, updateActiveSceneLayer } from "../systems/sceneSystem";
import { clearSelectionState, commitDraftSourceSelection, moveHoveredOutputTileBy, moveSourceSelectionBy, setHoveredOutputTile, updateDraftSourceSelection } from "../systems/selectionSystem";
import {
  clearSourceImageAsset,
  ensureActiveSourceImageFromProject,
  getSourceImageForRef,
  loadImageAssetFromFile,
  loadImageAssetFromUrl,
  loadSourceImageFromFile,
  loadSourceImageFromFileWithRef,
  loadSourceImageFromUrl,
} from "../systems/sourceImageSystem";
import {
  bakeSelectedTilesColorReplace,
  bakeSelectedTilesEdgeExtend,
  bakeSelectedTilesGroupFlip,
  bakeSelectedTilesGroupScale,
  bakeSelectedTilesGroupShift,
  bakeSelectedTilesGroupStretch,
  fillSelectedOutputCells,
  normalizeHexColor,
  parseHexColor,
  resetTileToBakedImage,
} from "../systems/groupedTileBakeSystem";
import { getSeamRepairPairs, getSeamRepairSettings, repairSeamPair } from "../systems/seamRepairSystem";
import { renderTileCanvas } from "../systems/tileRenderSystem";
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
  selectedOutputTileIds: number[];
  selectedOutputCells: ProjectState["session"]["selectedOutputCells"];
  selectedSceneCell: ProjectState["session"]["selectedSceneCell"];
  selectedSceneCells: ProjectState["session"]["selectedSceneCells"];
  activeSceneLayerId: number | null;
};

type UnresolvedProjectAssets = {
  sourceImageRef: string | null;
  workingImageRef: string | null;
  sceneFileRef: string | null;
};

const HISTORY_LIMIT = 40;

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
  let wheelGestureDirection: -1 | 1 | null = null;
  let wheelGestureLastAt = 0;
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
    onOpenSource: async () => {
      if (!window.showOpenFilePicker) {
        return false;
      }

      try {
        const [handle] = await window.showOpenFilePicker({
          excludeAcceptAllOption: false,
          multiple: false,
          types: [
            {
              description: "Image",
              accept: {
                "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
              },
            },
          ],
        });

        if (!handle) {
          return true;
        }

        const file = await handle.getFile();
        const sourceImageRef = await deriveProjectRelativePathFromHandle(state, handle) ?? file.name;
        await loadSourceImageFromFileWithRef(state, file, sourceImageRef);
        bumpRenderRevision();
        clearSelectionState(state);
        clearSelectedOutputTile(state);
        state.session.message = `Loaded source image: ${sourceImageRef}. Existing output tiles keep their previous source references when available.`;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return true;
        }

        const message = error instanceof Error ? error.message : "Unknown source image open error.";
        state.session.message = `Source image open failed: ${message}`;
      }

      renderAll();
      return true;
    },
    onNewProject: () => {
      const freshState = createProjectState();
      state.project = freshState.project;
      state.sourceImageAsset = freshState.sourceImageAsset;
      state.session.message = "Started a new project.";
      state.session.projectFileName = null;
      state.session.projectFileHandle = null;
      state.session.projectDirectoryHandle = null;
      state.session.projectBaseUrl = null;
      state.session.workingImageFileName = null;
      state.session.workingImageFileHandle = null;
      state.session.sceneFileName = null;
      state.session.sceneFileHandle = null;
      state.session.activeWorkspaceMode = freshState.session.activeWorkspaceMode;
      state.session.activeSceneLayerId = freshState.session.activeSceneLayerId;
      state.session.sourceSelection = freshState.session.sourceSelection;
      state.session.draftSourceSelection = freshState.session.draftSourceSelection;
      state.session.hoveredOutputTile = freshState.session.hoveredOutputTile;
      state.session.selectedOutputTileId = freshState.session.selectedOutputTileId;
      state.session.selectedOutputTileIds = freshState.session.selectedOutputTileIds;
      state.session.selectedOutputCells = freshState.session.selectedOutputCells;
      state.session.outputTileClipboard = freshState.session.outputTileClipboard;
      state.session.sceneClipboard = freshState.session.sceneClipboard;
      state.session.groupScaleX = freshState.session.groupScaleX;
      state.session.groupScaleY = freshState.session.groupScaleY;
      state.session.groupStretchLeft = freshState.session.groupStretchLeft;
      state.session.groupStretchRight = freshState.session.groupStretchRight;
      state.session.groupStretchTop = freshState.session.groupStretchTop;
      state.session.groupStretchBottom = freshState.session.groupStretchBottom;
      state.session.selectedSceneCell = freshState.session.selectedSceneCell;
      state.session.selectedSceneCells = freshState.session.selectedSceneCells;
      state.session.hoveredPanel = freshState.session.hoveredPanel;
      state.session.tilePreviewMode = freshState.session.tilePreviewMode;
      state.session.showSceneGrid = freshState.session.showSceneGrid;
      state.session.scenePreviewPointer = freshState.session.scenePreviewPointer;
      state.session.fillTileColor = freshState.session.fillTileColor;
      state.session.colorReplaceSourceColor = freshState.session.colorReplaceSourceColor;
      state.session.colorReplaceTargetMode = freshState.session.colorReplaceTargetMode;
      state.session.colorReplaceTargetColor = freshState.session.colorReplaceTargetColor;
      state.session.colorReplaceTolerance = freshState.session.colorReplaceTolerance;
      state.session.seamRepairDirection = freshState.session.seamRepairDirection;
      state.session.seamRepairStripWidth = freshState.session.seamRepairStripWidth;
      state.session.seamRepairFalloff = freshState.session.seamRepairFalloff;
      state.session.seamRepairMode = freshState.session.seamRepairMode;
      state.session.seamRepairReference = freshState.session.seamRepairReference;
      state.session.seamRepairStrength = freshState.session.seamRepairStrength;
      state.session.seamRepairQuantize = freshState.session.seamRepairQuantize;
      state.session.seamRepairPreserveContrast = freshState.session.seamRepairPreserveContrast;
      state.session.seamRepairContinueRamp = freshState.session.seamRepairContinueRamp;
      state.session.seamRepairPreview = freshState.session.seamRepairPreview;
      state.session.sourceCamera = freshState.session.sourceCamera;
      state.session.outputCamera = freshState.session.outputCamera;
      state.session.sourceImageAssetCache = freshState.session.sourceImageAssetCache;
      state.session.renderRevision += 1;
      undoStack.length = 0;
      redoStack.length = 0;
      renderAll();
    },
    onProjectSelected: async (file) => {
      try {
        const project = await loadProjectFile(file);
        state.session.projectFileName = file.name;
        state.session.projectFileHandle = null;
        state.session.projectDirectoryHandle = null;
        state.session.projectBaseUrl = null;
        const unresolved = await loadProjectIntoState(state, project, `Loaded project: ${file.name}.`);
        await tryResolveProjectAssetsFromDirectory(state, unresolved);
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
        state.session.projectBaseUrl = null;
        const unresolved = await loadProjectIntoState(state, project, `Loaded project: ${file.name}.`);
        await tryResolveProjectAssetsFromDirectory(state, unresolved);
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
          state.session.projectFileName = handle.name;
          state.session.message = `Saved project to ${handle.name}. Future saves will overwrite that file in supported browsers.`;
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
    onWorkingImageSelected: async (file) => {
      try {
        recordHistory();
        await loadWorkingImageIntoState(state, file, null);
      } catch (error) {
        undoStack.pop();
        const message = error instanceof Error ? error.message : "Unknown working PNG import error.";
        state.session.message = `Working PNG import failed: ${message}`;
      }

      renderAll();
    },
    onOpenWorkingImage: async () => {
      if (!window.showOpenFilePicker) {
        return false;
      }

      try {
        const [handle] = await window.showOpenFilePicker({
          excludeAcceptAllOption: false,
          multiple: false,
          types: [
            {
              description: "PNG image",
              accept: {
                "image/png": [".png"],
              },
            },
          ],
        });

        if (!handle) {
          return true;
        }

        const file = await handle.getFile();
        recordHistory();
        await loadWorkingImageIntoState(state, file, handle);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return true;
        }

        undoStack.pop();
        const message = error instanceof Error ? error.message : "Unknown working PNG open error.";
        state.session.message = `Working PNG open failed: ${message}`;
      }

      renderAll();
      return true;
    },
    onSaveWorkingImage: async () => {
      try {
        const suggestedName = getWorkingImageFilename(state);

        if (state.session.workingImageFileHandle) {
          const result = await saveTilesetPngToHandle(state.session.workingImageFileHandle, state);
          const fileName = state.session.workingImageFileName ?? suggestedName;
          state.project.workingImage = await deriveProjectRelativePathFromHandle(state, state.session.workingImageFileHandle) ?? fileName;
          state.session.message = result.missingTileCount > 0
            ? `Saved working PNG to ${fileName}. ${result.missingTileCount} tile${result.missingTileCount === 1 ? "" : "s"} could not be rendered because their source image is unavailable.`
            : `Saved working PNG to ${fileName}.`;
          renderAll();
          return;
        }

        const result = await saveTilesetPngWithPicker(state, suggestedName);

        if (result.handle) {
          state.session.workingImageFileHandle = result.handle;
          state.session.workingImageFileName = result.handle.name;
          state.project.workingImage = await deriveProjectRelativePathFromHandle(state, result.handle) ?? result.handle.name;
          syncSceneTilesetSourceToDefault(state);
          state.session.message = result.missingTileCount > 0
            ? `Saved working PNG to ${result.handle.name}. ${result.missingTileCount} tile${result.missingTileCount === 1 ? "" : "s"} could not be rendered because their source image is unavailable.`
            : `Saved working PNG to ${result.handle.name}.`;
          renderAll();
          return;
        }

        state.session.workingImageFileName = suggestedName;
        state.project.workingImage = suggestedName;
        syncSceneTilesetSourceToDefault(state);
        state.session.message = result.missingTileCount > 0
          ? `Downloaded working PNG as ${suggestedName}. ${result.missingTileCount} tile${result.missingTileCount === 1 ? "" : "s"} could not be rendered because their source image is unavailable.`
          : `Downloaded working PNG as ${suggestedName}. Browser file overwrite is not supported here.`;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        const message = error instanceof Error ? error.message : "Unknown working PNG save error.";
        state.session.message = `Working PNG save failed: ${message}`;
      }

      renderAll();
    },
    onNewTilesheet: () => {
      recordHistory();
      const freshState = createProjectState();
      state.project.workingImage = null;
      state.project.tiles = [];
      state.session.workingImageFileName = null;
      state.session.workingImageFileHandle = null;
      state.session.selectedOutputTileId = null;
      state.session.selectedOutputTileIds = [];
      state.session.selectedOutputCells = [];
      state.session.hoveredOutputTile = null;
      clearSelectionState(state);
      state.session.outputCamera = { ...freshState.session.outputCamera };
      state.session.message = "Started a new blank working tilesheet. Source image and grid settings were kept.";
      bumpRenderRevision();
      renderAll();
    },
    onExportTsj: async () => {
      try {
        const filename = getExportFilename(state, "tsj");
        const handle = await saveTilesetTsjWithPicker(state, filename);
        state.session.message = handle
          ? `Saved ${filename}.`
          : `Downloaded ${filename}. Browser file overwrite is not supported here.`;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        const message = error instanceof Error ? error.message : "Unknown TSJ export error.";
        state.session.message = `TSJ export failed: ${message}`;
      }

      renderAll();
    },
    onSceneSelected: async (file) => {
      try {
        recordHistory();
        const scene = await loadSceneFile(file);
        state.project.scene = scene;
        state.project.sceneFile = file.name;
        state.session.sceneFileName = file.name;
        state.session.sceneFileHandle = null;
        state.session.activeSceneLayerId = scene.layers[0]?.id ?? null;
        state.session.selectedSceneCell = null;
        state.session.selectedSceneCells = [];
        state.session.activeWorkspaceMode = "scene";
        await resolveSceneImageLayersFromSceneFile(state, scene);
        const tilesheetResolution = await resolveSceneTilesheetIfPossible(state);
        bumpRenderRevision();
        state.session.message = `Loaded scene: ${file.name}.${tilesheetResolution ? ` ${tilesheetResolution}` : ""}`;
      } catch (error) {
        undoStack.pop();
        const message = error instanceof Error ? error.message : "Unknown TMJ import error.";
        state.session.message = `Scene import failed: ${message}`;
      }

      renderAll();
    },
    onOpenScene: async () => {
      if (!window.showOpenFilePicker) {
        return false;
      }

      try {
        const [handle] = await window.showOpenFilePicker({
          excludeAcceptAllOption: false,
          multiple: false,
          types: [
            {
              description: "Tiled JSON map",
              accept: {
                "application/json": [".tmj"],
              },
            },
          ],
        });

        if (!handle) {
          return true;
        }

        recordHistory();
        const { file, scene } = await loadSceneFromHandle(handle);
        state.project.scene = scene;
        state.project.sceneFile = file.name;
        state.session.sceneFileName = file.name;
        state.session.sceneFileHandle = handle;
        state.session.activeSceneLayerId = scene.layers[0]?.id ?? null;
        state.session.selectedSceneCell = null;
        state.session.selectedSceneCells = [];
        state.session.activeWorkspaceMode = "scene";
        await resolveSceneImageLayersFromSceneFile(state, scene);
        const tilesheetResolution = await resolveSceneTilesheetIfPossible(state);
        bumpRenderRevision();
        state.session.message = `Loaded scene: ${file.name}.${tilesheetResolution ? ` ${tilesheetResolution}` : ""}`;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return true;
        }

        undoStack.pop();
        const message = error instanceof Error ? error.message : "Unknown TMJ open error.";
        state.session.message = `Scene open failed: ${message}`;
      }

      renderAll();
      return true;
    },
    onSaveScene: async () => {
      try {
        const scene = ensureScene(state);
        syncSceneTilesetSourceToDefault(state);
        const suggestedName = state.session.sceneFileName ?? "scene.tmj";

        if (state.session.sceneFileHandle) {
          await saveSceneToHandle(state.session.sceneFileHandle, scene);
          state.project.sceneFile = state.session.sceneFileName ?? suggestedName;
          state.session.message = `Saved scene to ${state.session.sceneFileName ?? suggestedName}.`;
          renderAll();
          return;
        }

        const handle = await saveSceneWithPicker(scene, suggestedName);

        if (handle) {
          state.session.sceneFileHandle = handle;
          state.session.sceneFileName = handle.name;
          state.project.sceneFile = handle.name;
          state.session.message = `Saved scene to ${handle.name}.`;
        } else {
          state.session.sceneFileName = suggestedName;
          state.project.sceneFile = suggestedName;
          state.session.message = `Downloaded scene as ${suggestedName}. Browser file overwrite is not supported here.`;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        const message = error instanceof Error ? error.message : "Unknown scene save error.";
        state.session.message = `Scene save failed: ${message}`;
      }

      renderAll();
    },
    onNewScene: () => {
      recordHistory();
      const scene = resetScene(state);
      syncSceneTilesetSourceToDefault(state);
      state.project.sceneFile = null;
      state.session.sceneFileName = null;
      state.session.sceneFileHandle = null;
      state.session.activeWorkspaceMode = "scene";
      bumpRenderRevision();
      state.session.message = `Started a new blank scene (${scene.width} x ${scene.height}).`;
      renderAll();
    },
    onClearScene: () => {
      recordHistory();
      const clearedCount = clearSceneLayers(state);

      if (clearedCount < 1) {
        undoStack.pop();
        state.session.message = "There are no placed scene tiles to clear.";
        renderAll();
        return;
      }

      bumpRenderRevision();
      state.session.activeWorkspaceMode = "scene";
      state.session.message = `Cleared ${clearedCount} scene tile${clearedCount === 1 ? "" : "s"} across the current scene.`;
      renderAll();
    },
    onCopySceneSelection: () => {
      if (state.session.activeWorkspaceMode !== "scene") {
        return;
      }

      const clipboard = state.session.sourceSelection
        ? copySourceSelectionToSceneClipboard(state)
        : copySelectedSceneCells(state);

      if (!clipboard) {
        state.session.message = "Select source tiles or scene cells before copying.";
        renderAll();
        return;
      }

      state.session.sceneClipboard = clipboard;
      state.session.message = `Copied a ${clipboard.width} x ${clipboard.height} scene patch.`;
      renderAll();
    },
    onPasteSceneSelection: () => {
      if (state.session.activeWorkspaceMode !== "scene" || !state.session.sceneClipboard) {
        state.session.message = "Copy source tiles or scene cells before pasting.";
        renderAll();
        return;
      }

      const target = state.session.hoveredOutputTile ?? state.session.selectedSceneCell;

      if (!target) {
        state.session.message = "Hover or select a destination scene cell before pasting.";
        renderAll();
        return;
      }

      recordHistory();
      const pasted = pasteSceneClipboard(state, state.session.sceneClipboard, target.col, target.row);

      if (pasted < 1) {
        undoStack.pop();
        state.session.message = "Scene paste did not fit inside the scene grid.";
        renderAll();
        return;
      }

      bumpRenderRevision();
      state.session.message = `Pasted ${pasted} scene cell${pasted === 1 ? "" : "s"} at ${target.col}, ${target.row}.`;
      renderAll();
    },
    onDeleteSceneSelection: () => {
      if (state.session.activeWorkspaceMode !== "scene" || !state.session.selectedSceneCell) {
        state.session.message = "Select scene cells before deleting them.";
        renderAll();
        return;
      }

      recordHistory();
      const deleted = deleteSelectedSceneCells(state);

      if (deleted.count < 1) {
        undoStack.pop();
        state.session.message = "Selected scene cells were already empty.";
        renderAll();
        return;
      }

      bumpRenderRevision();
      state.session.message = deleted.count > 1
        ? `Cleared ${deleted.count} selected scene cells.`
        : `Cleared scene cell ${deleted.primaryCell?.col ?? 0}, ${deleted.primaryCell?.row ?? 0}.`;
      renderAll();
    },
    onMoveSceneSelection: (deltaCol, deltaRow) => {
      if (state.session.activeWorkspaceMode !== "scene" || !state.session.selectedSceneCell) {
        state.session.message = "Select scene cells before moving them.";
        renderAll();
        return;
      }

      recordHistory();
      const movedCell = moveSelectedSceneCellBy(state, deltaCol, deltaRow);

      if (!movedCell) {
        undoStack.pop();
        state.session.message = "Scene selection could not move in that direction.";
        renderAll();
        return;
      }

      bumpRenderRevision();
      const count = getSelectedSceneCells(state).length;
      state.session.message = count > 1
        ? `Moved ${count} selected scene cells.`
        : `Moved scene cell to ${movedCell.col}, ${movedCell.row}.`;
      renderAll();
    },
    onWorkspaceModeChanged: (mode) => {
      state.session.activeWorkspaceMode = mode;
      if (mode === "scene") {
        ensureScene(state);
        syncSceneTilesetSourceToDefault(state);
      }
      clearSelectionState(state);
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
    onSceneWidthChanged: (width) => {
      recordHistory();
      const scene = resizeScene(state, width, state.project.scene?.height ?? 32);
      bumpRenderRevision();
      state.session.message = `Scene width set to ${scene.width}.`;
      renderAll();
    },
    onSceneHeightChanged: (height) => {
      recordHistory();
      const scene = resizeScene(state, state.project.scene?.width ?? 32, height);
      bumpRenderRevision();
      state.session.message = `Scene height set to ${scene.height}.`;
      renderAll();
    },
    onSceneTilesetSourceChanged: (tilesetSource) => {
      recordHistory();
        const scene = setSceneTilesetSource(state, tilesetSource);
        state.session.message = `Scene tileset source set to ${scene.tilesetSource}.`;
        renderAll();
    },
    onSceneLayerChanged: (layerId) => {
      const layer = selectSceneLayer(state, layerId);
      state.session.selectedSceneCell = null;
      state.session.selectedSceneCells = [];
      renderAll();
      state.session.message = layer ? `Selected scene layer ${layer.name}.` : "Scene layer not found.";
      return;
    },
    onSceneLayerAdded: (type) => {
      recordHistory();
      const layer = addSceneLayer(state, type);
      bumpRenderRevision();
      state.session.selectedSceneCell = null;
      state.session.selectedSceneCells = [];
      state.session.message = `Added scene layer ${layer.name}.`;
      renderAll();
    },
    onSceneLayerImageSelected: async (file) => {
      recordHistory();
      const layer = getActiveSceneLayer(state);

      if (!layer || layer.type !== "imagelayer") {
        undoStack.pop();
        state.session.message = "Select an image layer before choosing an image.";
        renderAll();
        return;
      }

      const imagePath = file.name;
      await loadImageAssetFromFile(state, file, imagePath);
      updateActiveSceneLayer(state, { image: imagePath });
      bumpRenderRevision();
      state.session.message = `Loaded image layer source ${imagePath}.`;
      renderAll();
    },
    onOpenSceneLayerImage: async () => {
      if (!window.showOpenFilePicker) {
        return false;
      }

      try {
        const layer = getActiveSceneLayer(state);

        if (!layer || layer.type !== "imagelayer") {
          state.session.message = "Select an image layer before choosing an image.";
          renderAll();
          return true;
        }

        const [handle] = await window.showOpenFilePicker({
          excludeAcceptAllOption: false,
          multiple: false,
          types: [
            {
              description: "Image",
              accept: {
                "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
              },
            },
          ],
        });

        if (!handle) {
          return true;
        }

        const file = await handle.getFile();
        recordHistory();
        const projectRelativePath = await deriveProjectRelativePathFromHandle(state, handle);
        const imagePath = state.project.sceneFile && projectRelativePath
          ? makePathRelativeToSceneFile(state.project.sceneFile, projectRelativePath)
          : file.name;
        await loadImageAssetFromFile(state, file, imagePath);
        updateActiveSceneLayer(state, { image: imagePath });
        bumpRenderRevision();
        state.session.message = `Loaded image layer source ${imagePath}.`;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return true;
        }

        const message = error instanceof Error ? error.message : "Unknown image layer open error.";
        state.session.message = `Image layer open failed: ${message}`;
      }

      renderAll();
      return true;
    },
    onSceneLayerUpdated: (patch) => {
      recordHistory();
      const layer = updateActiveSceneLayer(state, patch);

      if (!layer) {
        undoStack.pop();
        state.session.message = "Select a scene layer before editing it.";
        renderAll();
        return;
      }

      if (layer.type === "imagelayer" && typeof patch.image === "string" && patch.image.trim().length > 0) {
        void resolveSceneImageLayerPath(state, patch.image.trim())
          .then((resolved) => {
            if (!resolved) {
              state.session.message = `Updated scene layer ${layer.name}. Image path was saved but could not be resolved in the current session.`;
            }
            bumpRenderRevision();
            renderAll();
          });
      }

      bumpRenderRevision();
      state.session.message = `Updated scene layer ${layer.name}.`;
      renderAll();
    },
    onSceneLayerMoved: (delta) => {
      recordHistory();
      const layer = moveActiveSceneLayerBy(state, delta);

      if (!layer) {
        undoStack.pop();
        state.session.message = "Select a scene layer before reordering it.";
        renderAll();
        return;
      }

      bumpRenderRevision();
      state.session.message = `Moved scene layer ${layer.name} ${delta < 0 ? "up" : "down"} in the stack.`;
      renderAll();
    },
    onSceneGridVisibilityChanged: (visible) => {
      state.session.showSceneGrid = visible;
      state.session.message = visible ? "Scene editing grid shown." : "Scene preview enabled.";
      renderCanvas();
    },
    onSelectedTileUpdated: async (patch) => {
      recordHistory();
      const selectedTiles = getSelectedOutputTiles(state);

      if (selectedTiles.length > 1 && (typeof patch.flipX === "boolean" || typeof patch.flipY === "boolean")) {
        const flippedCount = await bakeSelectedTilesGroupFlip(
          state,
          selectedTiles,
          patch.flipX === true,
          patch.flipY === true,
        );

        if (flippedCount < 1) {
          undoStack.pop();
          state.session.message = "Select output tiles with resolved images before flipping the group.";
          renderAll();
          return;
        }

        bumpRenderRevision();
        state.session.message = flippedCount > 1
          ? `Flipped ${flippedCount} selected tiles as one group.`
          : "Flipped 1 selected tile.";
        renderAll();
        return;
      }

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
    onNudgeSelectedTile: async (deltaX, deltaY) => {
      recordHistory();
      const selectedTiles = getSelectedOutputTiles(state);

      if (selectedTiles.length > 1) {
        const shiftedCount = await bakeSelectedTilesGroupShift(state, selectedTiles, deltaX, deltaY);

        if (shiftedCount < 1) {
          undoStack.pop();
          state.session.message = "Select output tiles with resolved images before shifting the group.";
          renderAll();
          return;
        }

        bumpRenderRevision();
        state.session.message = `Shifted ${shiftedCount} selected tiles as one group by ${deltaX}, ${deltaY}.`;
        renderAll();
        return;
      }

      const tile = nudgeSelectedOutputTile(state, deltaX, deltaY);

      if (!tile) {
        undoStack.pop();
        state.session.message = "Select an output tile before nudging it.";
        renderAll();
        return;
      }

      bumpRenderRevision();
      state.session.message = `Nudged tile ${tile.id} by ${deltaX}, ${deltaY}.`;
      renderAll();
    },
    onGroupScaleXChanged: (value) => {
      state.session.groupScaleX = Math.max(0.1, value);
      renderAll();
    },
    onGroupScaleYChanged: (value) => {
      state.session.groupScaleY = Math.max(0.1, value);
      renderAll();
    },
    onApplyGroupScale: async () => {
      recordHistory();
      const selectedTiles = getSelectedOutputTiles(state);

      if (selectedTiles.length < 2) {
        undoStack.pop();
        state.session.message = "Select multiple output tiles before applying group scale.";
        renderAll();
        return;
      }

      const scaledCount = await bakeSelectedTilesGroupScale(
        state,
        selectedTiles,
        state.session.groupScaleX,
        state.session.groupScaleY,
      );

      if (scaledCount < 1) {
        undoStack.pop();
        state.session.message = "Unable to scale the selected patch. Check that the selected tiles have resolved images.";
        renderAll();
        return;
      }

      bumpRenderRevision();
      state.session.message = scaledCount > 1
        ? `Scaled the selected patch into ${scaledCount} tiles. Use Undo to restore the previous patch.`
        : "Scaled the selected patch.";
      renderAll();
    },
    onGroupStretchUpdated: (patch) => {
      if (typeof patch.left === "number") {
        state.session.groupStretchLeft = patch.left;
      }
      if (typeof patch.right === "number") {
        state.session.groupStretchRight = patch.right;
      }
      if (typeof patch.top === "number") {
        state.session.groupStretchTop = patch.top;
      }
      if (typeof patch.bottom === "number") {
        state.session.groupStretchBottom = patch.bottom;
      }
      renderAll();
    },
    onApplyGroupStretch: async () => {
      recordHistory();
      const selectedTiles = getSelectedOutputTiles(state);

      if (selectedTiles.length < 2) {
        undoStack.pop();
        state.session.message = "Select multiple output tiles before applying group stretch.";
        renderAll();
        return;
      }

      const stretchedCount = await bakeSelectedTilesGroupStretch(
        state,
        selectedTiles,
        state.session.groupStretchLeft,
        state.session.groupStretchRight,
        state.session.groupStretchTop,
        state.session.groupStretchBottom,
      );

      if (stretchedCount < 1) {
        undoStack.pop();
        state.session.message = "Unable to stretch the selected patch. Check that the stretch keeps a visible result.";
        renderAll();
        return;
      }

      bumpRenderRevision();
      state.session.message = stretchedCount > 1
        ? `Stretched the selected patch into ${stretchedCount} tiles. Use Undo to restore the previous patch.`
        : "Stretched the selected patch.";
      renderAll();
    },
    onSetSelectedTileFitMode: (fitMode) => {
      recordHistory();
      const tile = setSelectedOutputTileFitMode(state, fitMode);

      if (!tile) {
        undoStack.pop();
        state.session.message = "Select an output tile before changing fit mode.";
        renderAll();
        return;
      }

      bumpRenderRevision();
      state.session.message = `Set tile ${tile.id} fit mode to ${fitMode}.`;
      renderAll();
    },
    onAlignSelectedTile: (anchorX, anchorY) => {
      recordHistory();
      const tile = alignSelectedOutputTile(state, anchorX, anchorY);

      if (!tile) {
        undoStack.pop();
        state.session.message = "Select an output tile before aligning it.";
        renderAll();
        return;
      }

      bumpRenderRevision();
      state.session.message = `Aligned tile ${tile.id} to ${anchorX}/${anchorY}.`;
      renderAll();
    },
    onSnapSelectedTileToEdges: () => {
      recordHistory();
      const tile = snapSelectedOutputTileToEdges(state);

      if (!tile) {
        undoStack.pop();
        state.session.message = "Select an output tile before snapping it.";
        renderAll();
        return;
      }

      bumpRenderRevision();
      state.session.message = `Snapped tile ${tile.id} to the nearest tile edges.`;
      renderAll();
    },
    onBakeSelectedTileEdgeExtend: async () => {
      recordHistory();
      const selectedTiles = getSelectedOutputTiles(state);

      if (selectedTiles.length < 1) {
        undoStack.pop();
        state.session.message = "Select an output tile before baking edge extend.";
        renderAll();
        return;
      }

      const bakedCount = await bakeSelectedTilesEdgeExtend(state, selectedTiles);

      if (bakedCount < 1) {
        undoStack.pop();
        state.session.message = "Could not bake edge extend because the selected tile images were unavailable.";
        renderAll();
        return;
      }

      bumpRenderRevision();
      state.session.message = bakedCount > 1
        ? `Baked edge extend into ${bakedCount} selected tiles.`
        : `Baked edge extend into tile ${selectedTiles[0]?.id ?? ""}.`;
      renderAll();
    },
    onRotateSelectedTile: (delta) => {
      recordHistory();
      const tile = rotateSelectedOutputTileByQuarterTurns(state, delta);

      if (!tile) {
        undoStack.pop();
        state.session.message = "Select an output tile before rotating it.";
        renderAll();
        return;
      }

      bumpRenderRevision();
      state.session.message = `Rotated tile ${tile.id} by ${delta > 0 ? "90" : "-90"} degrees.`;
      renderAll();
    },
    onTrimSelectedTileTransparent: () => {
      recordHistory();
      const tile = getSelectedOutputTile(state);
      const image = tile ? (getSourceImageForRef(state, tile.sourceImageRef) ?? state.sourceImageAsset.image) : null;

      if (!tile || !image) {
        undoStack.pop();
        state.session.message = "Select an output tile with a resolved image before trimming transparency.";
        renderAll();
        return;
      }

      trimSelectedOutputTileTransparentBounds(state, image);
      bumpRenderRevision();
      state.session.message = `Trimmed transparent edges for tile ${tile.id}.`;
      renderAll();
    },
    onTilePreviewModeChanged: (previewMode) => {
      state.session.tilePreviewMode = previewMode;
      renderAll();
    },
    onFillTileColorChanged: (color) => {
      state.session.fillTileColor = normalizeHexColor(color, "#000000");
      renderAll();
    },
    onApplyTileFill: async () => {
      recordHistory();
      const selectedCells = getSelectedOutputCells(state);

      if (selectedCells.length < 1) {
        undoStack.pop();
        state.session.message = "Select one or more output cells before filling them.";
        renderAll();
        return;
      }

      const appliedCount = await fillSelectedOutputCells(state, selectedCells, state.session.fillTileColor);

      if (appliedCount < 1) {
        undoStack.pop();
        state.session.message = "Could not fill the selected output cells.";
        renderAll();
        return;
      }

      bumpRenderRevision();
      state.session.message = appliedCount > 1
        ? `Filled ${appliedCount} selected output cells.`
        : "Filled 1 selected output cell.";
      renderAll();
    },
    onColorReplaceSourceColorChanged: (color) => {
      state.session.colorReplaceSourceColor = normalizeHexColor(color, "#0000ff");
      renderAll();
    },
    onColorReplaceTargetModeChanged: (mode) => {
      state.session.colorReplaceTargetMode = mode;
      renderAll();
    },
    onColorReplaceTargetColorChanged: (color) => {
      state.session.colorReplaceTargetColor = normalizeHexColor(color, "#000000");
      renderAll();
    },
    onColorReplaceToleranceChanged: (tolerance) => {
      state.session.colorReplaceTolerance = Math.max(0, Math.min(441, Math.round(tolerance)));
      renderAll();
    },
    onApplyColorReplace: async () => {
      recordHistory();
      const selectedTiles = getSelectedOutputTiles(state);

      if (selectedTiles.length < 1) {
        undoStack.pop();
        state.session.message = "Select an output tile before applying color replace.";
        renderAll();
        return;
      }

      const sourceColor = parseHexColor(state.session.colorReplaceSourceColor);
      const targetColor = state.session.colorReplaceTargetMode === "color"
        ? parseHexColor(state.session.colorReplaceTargetColor)
        : null;

      if (!sourceColor || (state.session.colorReplaceTargetMode === "color" && !targetColor)) {
        undoStack.pop();
        state.session.message = "Choose valid source and target colors before applying color replace.";
        renderAll();
        return;
      }

      const appliedCount = await bakeSelectedTilesColorReplace(
        state,
        selectedTiles,
        sourceColor,
        state.session.colorReplaceTargetMode,
        targetColor,
        state.session.colorReplaceTolerance,
      );

      if (appliedCount < 1) {
        undoStack.pop();
        state.session.message = "Could not apply color replace because the selected tile images were unavailable.";
        renderAll();
        return;
      }

      bumpRenderRevision();
      state.session.message = appliedCount > 1
        ? `Applied color replace to ${appliedCount} selected tiles.`
        : `Applied color replace to tile ${selectedTiles[0]?.id ?? ""}.`;
      renderAll();
    },
    onSeamRepairDirectionChanged: (direction) => {
      state.session.seamRepairDirection = direction;
      renderAll();
    },
    onSeamRepairStripWidthChanged: (width) => {
      state.session.seamRepairStripWidth = Math.max(1, Math.round(width));
      renderAll();
    },
    onSeamRepairFalloffChanged: (falloff) => {
      state.session.seamRepairFalloff = Math.max(1, Math.round(falloff));
      renderAll();
    },
    onSeamRepairModeChanged: (mode) => {
      state.session.seamRepairMode = mode;
      renderAll();
    },
    onSeamRepairReferenceChanged: (reference) => {
      state.session.seamRepairReference = reference;
      renderAll();
    },
    onSeamRepairStrengthChanged: (strength) => {
      state.session.seamRepairStrength = Math.max(0, Math.min(1, strength));
      renderAll();
    },
    onSeamRepairQuantizeChanged: (enabled) => {
      state.session.seamRepairQuantize = enabled;
      renderAll();
    },
    onSeamRepairPreserveContrastChanged: (enabled) => {
      state.session.seamRepairPreserveContrast = enabled;
      renderAll();
    },
    onSeamRepairContinueRampChanged: (enabled) => {
      state.session.seamRepairContinueRamp = enabled;
      renderAll();
    },
    onSeamRepairPreviewChanged: (enabled) => {
      state.session.seamRepairPreview = enabled;
      renderAll();
    },
    onApplySeamRepair: async () => {
      recordHistory();
      const seamPairs = getSeamRepairPairs(state);

      if (seamPairs.length < 1) {
        undoStack.pop();
        state.session.message = "Select tiles with at least one adjacent neighbor in the chosen direction before applying seam repair.";
        renderAll();
        return;
      }

      const repairedCanvases = new Map<number, HTMLCanvasElement>();
      let repairedPairCount = 0;
      const timestamp = Date.now();

      for (const seamPair of seamPairs) {
        const primaryCanvas = repairedCanvases.get(seamPair.primary.id)
          ?? getRenderedSeamRepairTileCanvas(state, seamPair.primary);
        const neighborCanvas = repairedCanvases.get(seamPair.neighbor.id)
          ?? getRenderedSeamRepairTileCanvas(state, seamPair.neighbor);

        if (!primaryCanvas || !neighborCanvas) {
          continue;
        }

        const repaired = repairSeamPair(primaryCanvas, neighborCanvas, getSeamRepairSettings(state));

        if (!repaired) {
          continue;
        }

        repairedCanvases.set(seamPair.primary.id, repaired.primaryCanvas);
        repairedCanvases.set(seamPair.neighbor.id, repaired.neighborCanvas);
        repairedPairCount += 1;
      }

      if (repairedPairCount < 1 || repairedCanvases.size < 1) {
        undoStack.pop();
        state.session.message = "Seam repair preview could not be generated for the selected seam set.";
        renderAll();
        return;
      }

      for (const [tileId, canvas] of repairedCanvases) {
        const tile = state.project.tiles.find((entry) => entry.id === tileId);

        if (!tile) {
          continue;
        }

        const ref = `runtime:seam-repair:${timestamp}:${tile.id}:${Math.random().toString(36).slice(2, 8)}`;
        await loadImageAssetFromUrl(state, canvas.toDataURL("image/png"), ref);
        resetTileToBakedImage(tile, ref, state.project.tileWidth, state.project.tileHeight);
      }

      state.session.seamRepairPreview = false;
      bumpRenderRevision();
      state.session.message = repairedPairCount > 1
        ? `Applied seam repair across ${repairedPairCount} seam pairs in the selection.`
        : `Applied seam repair across ${repairedPairCount} seam pair.`;
      renderAll();
    },
    onCopySelectedTiles: () => {
      if (state.session.activeWorkspaceMode !== "tilesheet") {
        return;
      }

      const clipboard = copySelectedOutputTiles(state);

      if (!clipboard) {
        state.session.message = "Select one or more tiles before copying.";
        renderAll();
        return;
      }

      state.session.outputTileClipboard = clipboard;
      state.session.message = clipboard.tiles.length > 1
        ? `Copied ${clipboard.tiles.length} tiles from the working tilesheet.`
        : "Copied 1 tile from the working tilesheet.";
      renderAll();
    },
    onPasteSelectedTiles: () => {
      if (state.session.activeWorkspaceMode !== "tilesheet" || !state.session.outputTileClipboard) {
        state.session.message = "Copy tiles before pasting them.";
        renderAll();
        return;
      }

      const target = state.session.hoveredOutputTile
        ?? (() => {
          const tile = getSelectedOutputTile(state);
          return tile ? { col: tile.destCol, row: tile.destRow } : null;
        })();

      if (!target) {
        state.session.message = "Hover or select a destination tile before pasting.";
        renderAll();
        return;
      }

      recordHistory();
      const pastedTiles = pasteOutputTileClipboard(state, state.session.outputTileClipboard, target.col, target.row);

      if (!pastedTiles || pastedTiles.length < 1) {
        undoStack.pop();
        state.session.message = "Clipboard paste did not fit inside the output grid.";
        renderAll();
        return;
      }

      bumpRenderRevision();
      state.session.message = pastedTiles.length > 1
        ? `Pasted ${pastedTiles.length} tiles at ${target.col}, ${target.row}.`
        : `Pasted tile at ${target.col}, ${target.row}.`;
      renderAll();
    },
    onMoveSelectedTiles: (deltaCol, deltaRow) => {
      if (state.session.activeWorkspaceMode !== "tilesheet") {
        return;
      }

      const selectedTile = getSelectedOutputTile(state);

      if (!selectedTile) {
        state.session.message = "Select tiles before moving them.";
        renderAll();
        return;
      }

      recordHistory();
      const movedTile = moveSelectedOutputTileBy(state, deltaCol, deltaRow);

      if (!movedTile) {
        undoStack.pop();
        state.session.message = "Selected tiles could not move in that direction.";
        renderAll();
        return;
      }

      bumpRenderRevision();
      const selectedCount = state.session.selectedOutputCells.length || state.session.selectedOutputTileIds.length || 1;
      state.session.message = selectedCount > 1
        ? `Moved ${selectedCount} selected tiles.`
        : `Moved tile ${movedTile.id} to ${movedTile.destCol}, ${movedTile.destRow}.`;
      renderAll();
    },
    onClearSelectedTile: () => {
      recordHistory();
      const deletedTile = deleteSelectedOutputTile(state);

      if (!deletedTile) {
        undoStack.pop();
        state.session.message = "Select an output tile before clearing it.";
        renderAll();
        return;
      }

      bumpRenderRevision();
      state.session.message = `Cleared tile ${deletedTile.id} from ${deletedTile.destCol}, ${deletedTile.destRow}.`;
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
    onClearAllTiles: () => {
      recordHistory();

      if (state.project.tiles.length < 1) {
        undoStack.pop();
        state.session.message = "There are no placed tiles to clear.";
        renderAll();
        return;
      }

      const clearedCount = state.project.tiles.length;
      state.project.tiles = [];
      state.session.selectedOutputTileId = null;
      state.session.selectedOutputTileIds = [];
      state.session.selectedOutputCells = [];
      state.session.hoveredOutputTile = null;
      state.project.workingImage = null;
      state.session.workingImageFileName = null;
      state.session.workingImageFileHandle = null;
      bumpRenderRevision();
      state.session.message = `Cleared ${clearedCount} placed tile${clearedCount === 1 ? "" : "s"} from the working tilesheet.`;
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
    if (undoStack.length > HISTORY_LIMIT) {
      undoStack.splice(0, undoStack.length - HISTORY_LIMIT);
    }
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

    if (state.session.activeWorkspaceMode === "scene") {
      if (state.session.sourceSelection) {
        ensureScene(state);
        recordHistory();
        const assignedCount = placeSelectionIntoScene(
          state,
          state.session.sourceSelection,
          outputHit.col,
          outputHit.row,
        );

        if (assignedCount > 0) {
          bumpRenderRevision();
          state.session.selectedSceneCell = { col: outputHit.col, row: outputHit.row };
          state.session.selectedSceneCells = [{ col: outputHit.col, row: outputHit.row }];
          state.session.sourceSelection = null;
          state.session.draftSourceSelection = null;
          state.session.message = `Placed ${assignedCount} scene tile${assignedCount === 1 ? "" : "s"} starting at ${outputHit.col}, ${outputHit.row}. Copy source tiles again or use Paste to place another copy.`;
        } else {
          undoStack.pop();
          state.session.message = "Selection did not fit inside the scene grid.";
        }

        renderAll();
        return;
      }

      if (event.shiftKey) {
        const anchorCell = state.session.selectedSceneCell;
        const selectedCells = selectSceneCellRectangle(
          state,
          anchorCell?.col ?? outputHit.col,
          anchorCell?.row ?? outputHit.row,
          outputHit.col,
          outputHit.row,
        );
        state.session.message = `Selected ${selectedCells.length} scene cell${selectedCells.length === 1 ? "" : "s"} in a rectangle.`;
        renderAll();
        return;
      }

      const clickedInExistingSelection = getSelectedSceneCells(state).some(
        (cell) => cell.col === outputHit.col && cell.row === outputHit.row,
      );
      const sceneCell = clickedInExistingSelection
        ? (state.session.selectedSceneCell ?? { col: outputHit.col, row: outputHit.row })
        : selectSceneCell(state, outputHit.col, outputHit.row);

      if (sceneCell) {
        activePointerId = event.pointerId;
        dragMode = "move-tile";
        movingTileOrigin = sceneCell;
        shell.canvas.setPointerCapture(event.pointerId);
        state.session.message = `Selected scene cell ${sceneCell.col}, ${sceneCell.row}. Drag to move it.`;
      }

      renderAll();
      return;
    }

    if (!state.session.sourceSelection) {
      if (event.shiftKey) {
        const anchorTile = getSelectedOutputTile(state);
        const anchorCell = state.session.selectedOutputCells[0] ?? null;
        const selectedTiles = selectOutputTileRectangle(
          state,
          anchorTile?.destCol ?? anchorCell?.col ?? outputHit.col,
          anchorTile?.destRow ?? anchorCell?.row ?? outputHit.row,
          outputHit.col,
          outputHit.row,
        );
        const selectedCellCount = state.session.selectedOutputCells.length;
        state.session.message = selectedCellCount > 0
          ? selectedTiles.length > 0
            ? `Selected ${selectedCellCount} cells with ${selectedTiles.length} placed tile${selectedTiles.length === 1 ? "" : "s"} in the rectangle.`
            : `Selected ${selectedCellCount} empty cell${selectedCellCount === 1 ? "" : "s"} in a rectangle.`
          : "No output cells inside the selected rectangle.";
        renderAll();
        return;
      }

      const clickedInExistingSelection = state.session.selectedOutputCells.some(
        (cell) => cell.col === outputHit.col && cell.row === outputHit.row,
      );
      const selectedTile = clickedInExistingSelection
        ? getSelectedOutputTile(state)
        : selectOutputTileAtCell(state, outputHit.col, outputHit.row);
      if (selectedTile) {
        activePointerId = event.pointerId;
        dragMode = "move-tile";
        movingTileId = selectedTile.id;
        movingTileOrigin = { col: selectedTile.destCol, row: selectedTile.destRow };
        shell.canvas.setPointerCapture(event.pointerId);
        state.session.message = `Selected tile ${selectedTile.id} at ${selectedTile.destCol}, ${selectedTile.destRow}. Drag to move it.`;
      } else {
        movingTileId = null;
        movingTileOrigin = { col: outputHit.col, row: outputHit.row };
        state.session.message = `Selected empty output cell ${outputHit.col}, ${outputHit.row}.`;
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

    if (state.session.activeWorkspaceMode === "scene" && !state.session.showSceneGrid) {
      const outputFrame = layout.outputViewport.frame;
      const isOverOutput = point.x >= outputFrame.x
        && point.x <= outputFrame.x + outputFrame.width
        && point.y >= outputFrame.y
        && point.y <= outputFrame.y + outputFrame.height;
      const nextPreviewPointer = isOverOutput
        ? {
          x: Math.max(-1, Math.min(1, ((point.x - outputFrame.x) / Math.max(1, outputFrame.width)) * 2 - 1)),
          y: Math.max(-1, Math.min(1, ((point.y - outputFrame.y) / Math.max(1, outputFrame.height)) * 2 - 1)),
        }
        : null;

      if (
        state.session.scenePreviewPointer?.x !== nextPreviewPointer?.x
        || state.session.scenePreviewPointer?.y !== nextPreviewPointer?.y
      ) {
        state.session.scenePreviewPointer = nextPreviewPointer;
        requestCanvasRender();
      }
    }

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

  function handlePointerLeave(): void {
    if (state.session.scenePreviewPointer) {
      state.session.scenePreviewPointer = null;
      requestCanvasRender();
    }
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
      const selectedCellCount = state.session.selectedOutputCells.length;
      const shouldMove = outputHit && movingTileOrigin
        ? outputHit.col !== movingTileOrigin.col || outputHit.row !== movingTileOrigin.row
        : false;

      if (shouldMove) {
        recordHistory();
      }

      const movedTile = outputHit
        ? selectedCellCount > 1 && movingTileOrigin
          ? moveSelectedOutputTileBy(state, outputHit.col - movingTileOrigin.col, outputHit.row - movingTileOrigin.row)
          : moveTileToCell(state, movingTileId, outputHit.col, outputHit.row)
        : null;
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
          ? selectedCellCount > 1
            ? `Moved ${selectedCellCount} selected tiles.`
            : `Moved tile ${movedTile.id} to ${movedTile.destCol}, ${movedTile.destRow}.`
          : `Selected tile ${movedTile.id} at ${movedTile.destCol}, ${movedTile.destRow}.`
        : "Tile move cancelled.";
      if (moved) {
        bumpRenderRevision();
      }
      renderAll();
      return;
    }

    if (dragMode === "move-tile" && state.session.activeWorkspaceMode === "scene" && movingTileOrigin) {
      const point = getCanvasPoint(shell.canvas, event);
      const layout = getWorkspaceLayout(shell.canvas.width, shell.canvas.height, state);
      const outputHit = getOutputGridCellAtPoint(layout, point.x, point.y);
      const shouldMove = outputHit
        ? outputHit.col !== movingTileOrigin.col || outputHit.row !== movingTileOrigin.row
        : false;

      if (shouldMove) {
        recordHistory();
      }

      const movedCell = outputHit ? moveSelectedSceneCellsTo(state, outputHit.col, outputHit.row) : null;
      const moved = movedCell
        ? movedCell.col !== movingTileOrigin.col || movedCell.row !== movingTileOrigin.row
        : false;

      activePointerId = null;
      dragMode = null;
      movingTileOrigin = null;
      lastPointerPoint = null;

      if (shell.canvas.hasPointerCapture(event.pointerId)) {
        shell.canvas.releasePointerCapture(event.pointerId);
      }

      if (!moved && shouldMove) {
        undoStack.pop();
      }

      if (moved) {
        bumpRenderRevision();
      }

      state.session.message = movedCell
        ? moved
          ? `Moved ${getSelectedSceneCells(state).length} selected scene cell${getSelectedSceneCells(state).length === 1 ? "" : "s"} to ${movedCell.col}, ${movedCell.row}.`
          : `Selected scene cell ${movedCell.col}, ${movedCell.row}.`
        : "Scene move cancelled.";
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

      if (selection) {
        if (state.session.activeWorkspaceMode === "scene") {
          const clipboard = copySourceSelectionToSceneClipboard(state);

          if (clipboard) {
            state.session.sceneClipboard = clipboard;
          }
        } else {
          const clipboard = copySourceSelectionToOutputClipboard(state, selection);

          if (clipboard) {
            state.session.outputTileClipboard = clipboard;
          }
        }
    }

    state.session.message = selection
      ? state.session.activeWorkspaceMode === "scene"
        ? `Selected ${selection.columns} x ${selection.rows} source tile${selection.columns * selection.rows === 1 ? "" : "s"} and copied them to the scene paste buffer.`
        : `Selected ${selection.columns} x ${selection.rows} source tile${selection.columns * selection.rows === 1 ? "" : "s"} and copied them to the tilesheet paste buffer.`
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

    const now = performance.now();
    const normalizedDelta = normalizeWheelDelta(event);

    if (Math.abs(normalizedDelta) < 0.01) {
      return;
    }

    if (now - wheelGestureLastAt > 160) {
      wheelGestureDirection = normalizedDelta < 0 ? -1 : 1;
    } else if (wheelGestureDirection && Math.sign(normalizedDelta) !== wheelGestureDirection && Math.abs(normalizedDelta) < 18) {
      event.preventDefault();
      wheelGestureLastAt = now;
      return;
    } else {
      wheelGestureDirection = normalizedDelta < 0 ? -1 : 1;
    }

    wheelGestureLastAt = now;

    const zoom = zoomWorkspacePanel(state, panel, layout, point.x, point.y, normalizedDelta);

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

    if ((event.metaKey || event.ctrlKey) && !event.altKey) {
      if (event.code === "KeyZ" && !event.shiftKey) {
        event.preventDefault();
        applyUndo();
        return;
      }

      if ((event.code === "KeyZ" && event.shiftKey) || (event.code === "KeyY" && !event.shiftKey)) {
        event.preventDefault();
        applyRedo();
        return;
      }
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
      if (event.altKey && state.session.hoveredPanel) {
        event.preventDefault();
        const layout = getWorkspaceLayout(shell.canvas.width, shell.canvas.height, state);
        const viewport = state.session.hoveredPanel === "source" ? layout.sourceViewport : layout.outputViewport;

        if (!viewport) {
          return;
        }

        const stepX = state.session.hoveredPanel === "source"
          ? state.project.sourceTileWidth * viewport.scaleX
          : state.project.tileWidth * viewport.scaleX;
        const stepY = state.session.hoveredPanel === "source"
          ? state.project.sourceTileHeight * viewport.scaleY
          : state.project.tileHeight * viewport.scaleY;

        panWorkspacePanel(
          state,
          state.session.hoveredPanel,
          -movement.col * stepX,
          -movement.row * stepY,
          layout,
        );
        state.session.message = `${state.session.hoveredPanel === "source" ? "Source" : "Output"} view panned.`;
        renderCanvas();
        return;
      }

      if (event.shiftKey) {
        if (state.session.activeWorkspaceMode === "scene") {
          if (!state.session.selectedSceneCell) {
            return;
          }

          recordHistory();
          const movedCell = moveSelectedSceneCellBy(state, movement.col, movement.row);

          if (movedCell) {
            event.preventDefault();
            bumpRenderRevision();
            const selectedCount = getSelectedSceneCells(state).length;
            state.session.message = selectedCount > 1
              ? `Moved ${selectedCount} selected scene cells.`
              : `Moved scene cell to ${movedCell.col}, ${movedCell.row}.`;
            renderAll();
          } else {
            undoStack.pop();
          }

          return;
        }

        const movedTile = moveSelectedOutputTileBy(state, movement.col, movement.row);

        if (movedTile) {
          event.preventDefault();
          const selectedCount = state.session.selectedOutputTileIds.length || (state.session.selectedOutputTileId !== null ? 1 : 0);
          state.session.message = selectedCount > 1
            ? `Moved ${selectedCount} selected tiles.`
            : `Moved tile ${movedTile.id} to ${movedTile.destCol}, ${movedTile.destRow}.`;
          renderAll();
        }

        return;
      }

      if (state.session.hoveredPanel) {
        event.preventDefault();

        if (state.session.hoveredPanel === "source") {
          const selection = moveSourceSelectionBy(state, movement.col, movement.row);

          if (selection) {
            state.session.message = `Source selection moved to ${selection.startCol}, ${selection.startRow}.`;
            renderCanvas();
          }
        } else {
          const tile = moveHoveredOutputTileBy(state, movement.col, movement.row);
          state.session.message = `Output target moved to ${tile.col}, ${tile.row}.`;
          renderCanvas();
        }
      }

      return;
    }

    if (event.code === "Backspace" || event.code === "Delete") {
      if (state.session.activeWorkspaceMode === "scene") {
        if (!state.session.selectedSceneCell) {
          return;
        }

        event.preventDefault();
        recordHistory();
        const deleted = deleteSelectedSceneCells(state);

        if (deleted.count < 1) {
          undoStack.pop();
          return;
        }

        bumpRenderRevision();
        state.session.message = deleted.count > 1
          ? `Cleared ${deleted.count} selected scene cells.`
          : `Cleared scene cell ${deleted.primaryCell?.col ?? 0}, ${deleted.primaryCell?.row ?? 0}.`;
        renderAll();
        return;
      }

      const tile = getSelectedOutputTile(state);
      const selectedCount = getSelectedOutputTiles(state).length;

      if (!tile) {
        return;
      }

      event.preventDefault();
      recordHistory();
      const deletedTile = deleteSelectedOutputTile(state);

      if (!deletedTile) {
        undoStack.pop();
        return;
      }

      bumpRenderRevision();
      state.session.message = selectedCount > 1
        ? `Cleared ${selectedCount} selected tiles.`
        : `Cleared tile ${deletedTile.id} from ${deletedTile.destCol}, ${deletedTile.destRow}.`;
      renderAll();
    }

    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.code === "KeyC") {
      if (state.session.activeWorkspaceMode === "scene") {
        const clipboard = state.session.sourceSelection
          ? copySourceSelectionToSceneClipboard(state)
          : copySelectedSceneCells(state);

        if (!clipboard) {
          return;
        }

        event.preventDefault();
        state.session.sceneClipboard = clipboard;
        state.session.message = `Copied a ${clipboard.width} x ${clipboard.height} scene patch.`;
        renderAll();
        return;
      }

      if (state.session.activeWorkspaceMode === "tilesheet") {
        const clipboard = copySelectedOutputTiles(state);

        if (!clipboard) {
          return;
        }

        event.preventDefault();
        state.session.outputTileClipboard = clipboard;
        state.session.message = clipboard.tiles.length > 1
          ? `Copied ${clipboard.tiles.length} tiles from the working tilesheet.`
          : "Copied 1 tile from the working tilesheet.";
        renderAll();
        return;
      }
    }

    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.code === "KeyV") {
      if (state.session.activeWorkspaceMode === "scene") {
        if (!state.session.sceneClipboard) {
          return;
        }

        const target = state.session.hoveredOutputTile ?? state.session.selectedSceneCell;

        if (!target) {
          return;
        }

        event.preventDefault();
        recordHistory();
        const pasted = pasteSceneClipboard(state, state.session.sceneClipboard, target.col, target.row);

        if (pasted < 1) {
          undoStack.pop();
          state.session.message = "Scene paste did not fit inside the scene grid.";
          renderAll();
          return;
        }

        bumpRenderRevision();
        state.session.message = `Pasted ${pasted} scene cell${pasted === 1 ? "" : "s"} at ${target.col}, ${target.row}.`;
        renderAll();
        return;
      }

      if (state.session.activeWorkspaceMode === "tilesheet" && state.session.outputTileClipboard) {
        const target = state.session.hoveredOutputTile
          ?? (() => {
            const tile = getSelectedOutputTile(state);
            return tile ? { col: tile.destCol, row: tile.destRow } : null;
          })();

        if (!target) {
          return;
        }

        event.preventDefault();
        recordHistory();
        const pastedTiles = pasteOutputTileClipboard(state, state.session.outputTileClipboard, target.col, target.row);

        if (!pastedTiles || pastedTiles.length < 1) {
          undoStack.pop();
          state.session.message = "Clipboard paste did not fit inside the output grid.";
          renderAll();
          return;
        }

        bumpRenderRevision();
        state.session.message = pastedTiles.length > 1
          ? `Pasted ${pastedTiles.length} tiles at ${target.col}, ${target.row}.`
          : `Pasted tile at ${target.col}, ${target.row}.`;
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
      shell.canvas.addEventListener("pointerleave", handlePointerLeave);
      shell.canvas.addEventListener("pointerup", handlePointerUp);
      shell.canvas.addEventListener("pointercancel", handlePointerCancel);
      shell.canvas.addEventListener("wheel", handleWheel, { passive: false });
      shell.canvas.addEventListener("contextmenu", (event) => {
        event.preventDefault();
      });

      try {
        state.session.projectFileName = "latest.tilejam.json";
        state.session.projectFileHandle = null;
        state.session.projectDirectoryHandle = null;
        state.session.projectBaseUrl = "/projects/";
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
        state.project.workingImage = null;
        state.session.message = "Loaded fallback sample image with default source/output grid settings.";
        bumpRenderRevision();
        undoStack.length = 0;
        redoStack.length = 0;
      }

      renderAll();
    },
  };
}

function normalizeWheelDelta(event: WheelEvent): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return event.deltaY * 16;
  }

  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * 100;
  }

  return event.deltaY;
}

function createHistoryEntry(state: ProjectState): HistoryEntry {
  return {
    project: JSON.parse(JSON.stringify(state.project)) as ProjectState["project"],
    selectedOutputTileId: state.session.selectedOutputTileId,
    selectedOutputTileIds: [...state.session.selectedOutputTileIds],
    selectedOutputCells: state.session.selectedOutputCells.map((cell) => ({ ...cell })),
    selectedSceneCell: state.session.selectedSceneCell ? { ...state.session.selectedSceneCell } : null,
    selectedSceneCells: state.session.selectedSceneCells.map((cell) => ({ ...cell })),
    activeSceneLayerId: state.session.activeSceneLayerId,
  };
}

function restoreHistoryEntry(state: ProjectState, entry: HistoryEntry): void {
  state.project = JSON.parse(JSON.stringify(entry.project)) as ProjectState["project"];
  state.session.selectedOutputTileId = entry.selectedOutputTileId;
  state.session.selectedOutputTileIds = [...entry.selectedOutputTileIds];
  state.session.selectedOutputCells = entry.selectedOutputCells.map((cell) => ({ ...cell }));
  state.session.selectedSceneCell = entry.selectedSceneCell ? { ...entry.selectedSceneCell } : null;
  state.session.selectedSceneCells = entry.selectedSceneCells.map((cell) => ({ ...cell }));
  state.session.activeSceneLayerId = entry.activeSceneLayerId;
  normalizeProjectTilesToGrid(state);
}

function getExportFilename(state: ProjectState, extension: "png" | "tsj"): string {
  const projectName = state.session.projectFileName ?? "latest.tilejam.json";
  const baseName = projectName.replace(/(?:\.tilejam)?\.json$/i, "");
  return `${baseName || "tileset"}.${extension}`;
}

function getRenderedSeamRepairTileCanvas(
  state: ProjectState,
  tile: TilePlacement,
): HTMLCanvasElement | null {
  const image = getSourceImageForRef(state, tile.sourceImageRef) ?? state.sourceImageAsset.image;

  if (!image) {
    return null;
  }

  return renderTileCanvas(image, tile, state.project.tileWidth, state.project.tileHeight);
}
function rgbToHex(color: { r: number; g: number; b: number }): string {
  const toHex = (channel: number) => channel.toString(16).padStart(2, "0");
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

function getDisplayFileName(path: string | null): string | null {
  if (!path) {
    return null;
  }

  const normalized = path.replace(/\\/g, "/");
  const segments = normalized.split("/");
  return segments[segments.length - 1] || path;
}

function isRelativeAssetReference(reference: string | null): boolean {
  if (!reference) {
    return false;
  }

  if (reference.startsWith("/") || reference.startsWith("data:")) {
    return false;
  }

  return !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(reference);
}

function resolveProjectAssetReference(state: ProjectState, reference: string): string {
  if (!isRelativeAssetReference(reference) || !state.session.projectBaseUrl) {
    return reference;
  }

  return new URL(reference, state.session.projectBaseUrl).toString();
}

function getWorkingImageFilename(state: ProjectState): string {
  const existingName = state.session.workingImageFileName ?? state.project.workingImage;

  if (existingName) {
    return existingName.replace(/\.[^.]+$/i, ".png");
  }

  return getExportFilename(state, "png");
}

function getDefaultSceneTilesetSource(state: ProjectState): string {
  const explicitWorkingName = state.session.workingImageFileName ?? state.project.workingImage;

  if (explicitWorkingName) {
    return explicitWorkingName.replace(/\.[^.]+$/i, ".tsj");
  }

  if (state.session.projectFileName) {
    return getExportFilename(state, "tsj");
  }

  return "tileset.tsj";
}

function syncSceneTilesetSourceToDefault(state: ProjectState): void {
  if (!state.project.scene) {
    return;
  }

  const currentValue = state.project.scene.tilesetSource.trim();

  if (currentValue.length === 0 || currentValue === "tileset.tsj" || currentValue === getDefaultSceneTilesetSource(state)) {
    state.project.scene.tilesetSource = getDefaultSceneTilesetSource(state);
  }
}


async function loadProjectIntoState(
  state: ProjectState,
  project: ProjectState["project"],
  messagePrefix: string,
): Promise<UnresolvedProjectAssets> {
  state.project = project;
  clearSelectionState(state);
  clearSelectedOutputTile(state);
  state.session.activeWorkspaceMode = "tilesheet";
  state.session.workingImageFileName = getDisplayFileName(project.workingImage);
  state.session.workingImageFileHandle = null;
  state.session.sceneFileName = getDisplayFileName(project.sceneFile);
  state.session.sceneFileHandle = null;
  state.session.activeSceneLayerId = project.scene?.layers[0]?.id ?? null;
  state.session.selectedSceneCell = null;
  state.session.selectedSceneCells = [];
  syncSceneTilesetSourceToDefault(state);

  const resolutionMessages: string[] = [];
  const unresolved: UnresolvedProjectAssets = {
    sourceImageRef: null,
    workingImageRef: null,
    sceneFileRef: null,
  };

  if (!project.sourceImage) {
    clearSourceImageAsset(state);
    resolutionMessages.push("No source image reference was included.");
  } else {
    const resolvedSourceImage = resolveProjectAssetReference(state, project.sourceImage);

    try {
      await loadSourceImageFromUrl(state, resolvedSourceImage, project.sourceImage);
      ensureActiveSourceImageFromProject(state);
      resolutionMessages.push(`Source image resolved from ${project.sourceImage}.`);
    } catch {
      clearSourceImageAsset(state);
      unresolved.sourceImageRef = isRelativeAssetReference(project.sourceImage) ? project.sourceImage : null;
      resolutionMessages.push(`Source image "${project.sourceImage}" could not be resolved automatically. Use "Open source" to relink it.`);
    }
  }

  if (project.workingImage && project.workingImage !== project.sourceImage) {
    const resolvedWorkingImage = resolveProjectAssetReference(state, project.workingImage);

    try {
      const workingImageRef = await loadImageAssetFromUrl(
        state,
        resolvedWorkingImage,
        getDisplayFileName(project.workingImage) ?? project.workingImage,
      );
      const asset = state.session.sourceImageAssetCache[workingImageRef];

      if (!asset) {
        throw new Error("Working PNG could not be cached.");
      }

      rebuildTilesFromWorkingSheet(state, workingImageRef, asset.width, asset.height);
      state.project.workingImage = project.workingImage;
      state.session.workingImageFileName = getDisplayFileName(project.workingImage);
      resolutionMessages.push(`Working PNG resolved from ${project.workingImage}.`);
    } catch {
      unresolved.workingImageRef = isRelativeAssetReference(project.workingImage) ? project.workingImage : null;
      state.project.tiles = [];
      resolutionMessages.push(`Working PNG "${project.workingImage}" could not be resolved automatically. Use "Open tilesheet" to relink it.`);
    }
  } else {
    state.project.tiles = [];
    resolutionMessages.push("No working PNG reference was included. Open tilesheet to rebuild editable tiles.");
  }

  if (project.sceneFile) {
    const resolvedSceneFile = resolveProjectAssetReference(state, project.sceneFile);

    try {
      const scene = await loadSceneFromUrl(resolvedSceneFile);
      state.project.scene = scene;
      state.project.sceneFile = project.sceneFile;
      state.session.sceneFileName = getDisplayFileName(project.sceneFile);
      state.session.activeSceneLayerId = scene.layers[0]?.id ?? null;
      state.session.selectedSceneCells = [];
      await resolveSceneImageLayersFromResolvedUrl(state, scene, resolvedSceneFile);
      resolutionMessages.push(`Scene resolved from ${project.sceneFile}.`);
    } catch {
      state.project.scene = null;
      unresolved.sceneFileRef = isRelativeAssetReference(project.sceneFile) ? project.sceneFile : null;
      resolutionMessages.push(`Scene "${project.sceneFile}" could not be resolved automatically. Use "Open scene" to relink it.`);
    }
  } else {
    state.project.scene = null;
    state.session.sceneFileName = null;
    state.session.activeSceneLayerId = null;
    state.session.selectedSceneCells = [];
  }

  state.session.message = `${messagePrefix} ${resolutionMessages.join(" ")}`.trim();
  return unresolved;
}

async function tryResolveProjectAssetsFromDirectory(
  state: ProjectState,
  unresolved: UnresolvedProjectAssets,
): Promise<void> {
  const refs = [unresolved.sourceImageRef, unresolved.workingImageRef, unresolved.sceneFileRef].filter((value): value is string => Boolean(value));

  const showDirectoryPicker = (window as Window & {
    showDirectoryPicker?: (options?: {
      id?: string;
      mode?: "read" | "readwrite";
    }) => Promise<FileSystemDirectoryHandle>;
  }).showDirectoryPicker;

  if (refs.length === 0 || !showDirectoryPicker) {
    return;
  }

  try {
    const directoryHandle = await showDirectoryPicker({
      id: "tilejam-project-folder",
      mode: "read",
    });

    state.session.projectDirectoryHandle = directoryHandle;
    const resolutionMessages: string[] = [];

    if (unresolved.sourceImageRef) {
      try {
        const sourceFile = await getRelativeFileFromDirectory(directoryHandle, unresolved.sourceImageRef);

        if (sourceFile) {
          await loadSourceImageFromFileWithRef(state, sourceFile, unresolved.sourceImageRef);
          state.project.sourceImage = unresolved.sourceImageRef;
          ensureActiveSourceImageFromProject(state);
          resolutionMessages.push(`Source image linked from project folder (${unresolved.sourceImageRef}).`);
        } else {
          resolutionMessages.push(`Source image "${unresolved.sourceImageRef}" was not found in the selected project folder.`);
        }
      } catch {
        resolutionMessages.push(`Source image "${unresolved.sourceImageRef}" was not found in the selected project folder.`);
      }
    }

    if (unresolved.workingImageRef) {
      try {
        const workingFile = await getRelativeFileFromDirectory(directoryHandle, unresolved.workingImageRef);

        if (workingFile) {
          await loadWorkingImageIntoState(state, workingFile, null);
          state.project.workingImage = unresolved.workingImageRef;
          state.session.workingImageFileName = getDisplayFileName(unresolved.workingImageRef);
          resolutionMessages.push(`Working PNG linked from project folder (${unresolved.workingImageRef}).`);
        } else {
          resolutionMessages.push(`Working PNG "${unresolved.workingImageRef}" was not found in the selected project folder.`);
        }
      } catch {
        resolutionMessages.push(`Working PNG "${unresolved.workingImageRef}" was not found in the selected project folder.`);
      }
    }

    if (unresolved.sceneFileRef) {
      try {
        const sceneFile = await getRelativeFileFromDirectory(directoryHandle, unresolved.sceneFileRef);

        if (sceneFile) {
          const scene = await loadSceneFile(sceneFile);
          state.project.scene = scene;
          state.project.sceneFile = unresolved.sceneFileRef;
          state.session.sceneFileName = getDisplayFileName(unresolved.sceneFileRef);
          state.session.sceneFileHandle = null;
          state.session.activeSceneLayerId = scene.layers[0]?.id ?? null;
          state.session.selectedSceneCells = [];
          await resolveSceneImageLayersFromDirectory(state, scene, directoryHandle, unresolved.sceneFileRef);
          resolutionMessages.push(`Scene linked from project folder (${unresolved.sceneFileRef}).`);
        } else {
          resolutionMessages.push(`Scene "${unresolved.sceneFileRef}" was not found in the selected project folder.`);
        }
      } catch {
        resolutionMessages.push(`Scene "${unresolved.sceneFileRef}" was not found in the selected project folder.`);
      }
    }

    if (resolutionMessages.length > 0) {
      state.session.message = `${state.session.message ?? ""} ${resolutionMessages.join(" ")}`.trim();
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }
  }
}

async function loadWorkingImageIntoState(
  state: ProjectState,
  file: File,
  handle: FileSystemFileHandle | null,
): Promise<void> {
  const workingImageRef = await loadImageAssetFromFile(state, file, file.name);
  const asset = state.session.sourceImageAssetCache[workingImageRef];

  if (!asset) {
    throw new Error("Working PNG could not be cached.");
  }

  clearSelectionState(state);
  clearSelectedOutputTile(state);
  state.project.workingImage = handle
    ? await deriveProjectRelativePathFromHandle(state, handle) ?? workingImageRef
    : workingImageRef;
  state.session.workingImageFileName = file.name;
  state.session.workingImageFileHandle = handle;
  const tileCount = rebuildTilesFromWorkingSheet(state, workingImageRef, asset.width, asset.height);
  state.session.renderRevision += 1;
  state.session.message = `Loaded working PNG ${file.name} and reconstructed ${tileCount} editable output tile${tileCount === 1 ? "" : "s"}.`;
}

async function resolveSceneTilesheetIfPossible(state: ProjectState): Promise<string | null> {
  const scene = state.project.scene;

  if (!scene) {
    return null;
  }

  const expectedWorkingImage = scene.tilesetSource.replace(/\.tsj$/i, ".png");
  const currentWorkingImage = state.session.workingImageFileName ?? state.project.workingImage;

  if (currentWorkingImage === expectedWorkingImage && state.project.tiles.length > 0) {
    return `Using current tilesheet ${currentWorkingImage}.`;
  }

  try {
    const workingImageRef = await loadImageAssetFromUrl(state, expectedWorkingImage, expectedWorkingImage);
    const asset = state.session.sourceImageAssetCache[workingImageRef];

    if (!asset) {
      return `Scene references ${scene.tilesetSource}. Open ${expectedWorkingImage} manually to render it here.`;
    }

    state.project.workingImage = workingImageRef;
    state.session.workingImageFileName = workingImageRef;
    state.session.workingImageFileHandle = null;
    rebuildTilesFromWorkingSheet(state, workingImageRef, asset.width, asset.height);
    return `Resolved tilesheet from ${expectedWorkingImage}.`;
  } catch {
    return `Scene references ${scene.tilesetSource}. Open ${expectedWorkingImage} manually to render it here.`;
  }
}

async function resolveSceneImageLayersFromSceneFile(
  state: ProjectState,
  scene: NonNullable<ProjectState["project"]["scene"]>,
): Promise<void> {
  await Promise.all(
    scene.layers.map(async (layer) => {
      if (layer.type !== "imagelayer" || !layer.image) {
        return;
      }

      try {
        await loadImageAssetFromUrl(state, layer.image, layer.image);
      } catch {
        // Local scene files do not provide a usable base path in the browser.
        // Image layers can still be relinked from the scene editor panel.
      }
    }),
  );
}

async function resolveSceneImageLayerPath(
  state: ProjectState,
  imagePath: string,
): Promise<boolean> {
  const trimmedPath = imagePath.trim();

  if (!trimmedPath) {
    return false;
  }

  const sceneFileRef = state.project.sceneFile;

  if (state.session.projectDirectoryHandle && sceneFileRef) {
    const sceneDirectory = getParentRelativePath(sceneFileRef);
    const relativeImagePath = joinRelativePath(sceneDirectory, trimmedPath);
    const imageFile = await getRelativeFileFromDirectory(state.session.projectDirectoryHandle, relativeImagePath);

    if (imageFile) {
      await loadImageAssetFromFile(state, imageFile, trimmedPath);
      return true;
    }
  }

  if (sceneFileRef && state.session.projectBaseUrl) {
    try {
      const resolvedSceneUrl = resolveProjectAssetReference(state, sceneFileRef);
      const resolvedImageUrl = new URL(trimmedPath, resolvedSceneUrl).toString();
      await loadImageAssetFromUrl(state, resolvedImageUrl, trimmedPath);
      return true;
    } catch {
      // Fall through to the raw URL attempt below.
    }
  }

  try {
    await loadImageAssetFromUrl(state, trimmedPath, trimmedPath);
    return true;
  } catch {
    return false;
  }
}

async function deriveSceneRelativeImagePath(
  state: ProjectState,
  file: File,
): Promise<string | null> {
  const directoryHandle = state.session.projectDirectoryHandle;
  const sceneFileRef = state.project.sceneFile;

  if (!directoryHandle || !sceneFileRef) {
    return null;
  }

  const matches = await findRelativePathsByFileName(directoryHandle, file.name);

  if (matches.length === 1) {
    return makePathRelativeToSceneFile(sceneFileRef, matches[0] ?? file.name);
  }

  const matchedPath = await findRelativePathByFileMetadata(directoryHandle, file, matches);
  return matchedPath ? makePathRelativeToSceneFile(sceneFileRef, matchedPath) : null;
}

async function resolveSceneImageLayersFromResolvedUrl(
  state: ProjectState,
  scene: NonNullable<ProjectState["project"]["scene"]>,
  resolvedSceneUrl: string,
): Promise<void> {
  await Promise.all(
    scene.layers.map(async (layer) => {
      if (layer.type !== "imagelayer" || !layer.image) {
        return;
      }

      try {
        const resolvedImageUrl = new URL(layer.image, resolvedSceneUrl).toString();
        await loadImageAssetFromUrl(state, resolvedImageUrl, layer.image);
      } catch {
        // Leave unresolved image layers visible in the editor fields.
      }
    }),
  );
}

async function resolveSceneImageLayersFromDirectory(
  state: ProjectState,
  scene: NonNullable<ProjectState["project"]["scene"]>,
  directoryHandle: FileSystemDirectoryHandle,
  sceneFileRef: string,
): Promise<void> {
  const sceneDirectory = getParentRelativePath(sceneFileRef);

  await Promise.all(
    scene.layers.map(async (layer) => {
      if (layer.type !== "imagelayer" || !layer.image) {
        return;
      }

      const relativeImagePath = joinRelativePath(sceneDirectory, layer.image);
      const imageFile = await getRelativeFileFromDirectory(directoryHandle, relativeImagePath);

      if (!imageFile) {
        return;
      }

      await loadImageAssetFromFile(state, imageFile, layer.image);
    }),
  );
}

function getParentRelativePath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index) : "";
}

function makePathRelativeToSceneFile(sceneFileRef: string, assetPath: string): string {
  const sceneDirectory = getParentRelativePath(sceneFileRef);
  const fromSegments = sceneDirectory.split("/").filter((segment) => segment.length > 0);
  const toSegments = assetPath.replace(/\\/g, "/").split("/").filter((segment) => segment.length > 0);

  let sharedIndex = 0;
  while (
    sharedIndex < fromSegments.length
    && sharedIndex < toSegments.length
    && fromSegments[sharedIndex] === toSegments[sharedIndex]
  ) {
    sharedIndex += 1;
  }

  const upSegments = new Array(fromSegments.length - sharedIndex).fill("..");
  const downSegments = toSegments.slice(sharedIndex);
  const relativeSegments = [...upSegments, ...downSegments];
  return relativeSegments.join("/") || assetPath;
}

function joinRelativePath(basePath: string, childPath: string): string {
  const normalizedChild = childPath.replace(/\\/g, "/");

  if (normalizedChild.startsWith("/") || normalizedChild.includes("..")) {
    return normalizedChild.replace(/^\//, "");
  }

  if (!basePath) {
    return normalizedChild;
  }

  return `${basePath.replace(/\/+$/g, "")}/${normalizedChild.replace(/^\.?\//, "")}`;
}

async function deriveProjectRelativePathFromHandle(
  state: ProjectState,
  handle: FileSystemFileHandle,
): Promise<string | null> {
  const directoryHandle = state.session.projectDirectoryHandle;

  if (!directoryHandle || typeof directoryHandle.resolve !== "function") {
    return null;
  }

  try {
    const segments = await directoryHandle.resolve(handle);
    return segments?.join("/") ?? null;
  } catch {
    return null;
  }
}

async function findRelativePathsByFileName(
  directoryHandle: FileSystemDirectoryHandle,
  fileName: string,
  basePath = "",
): Promise<string[]> {
  const matches: string[] = [];

  for await (const entryHandle of (directoryHandle as unknown as AsyncIterable<FileSystemHandle>)) {
    const entryName = entryHandle.name;
    const nextPath = basePath ? `${basePath}/${entryName}` : entryName;

    if (entryHandle.kind === "file") {
      if (entryName === fileName) {
        matches.push(nextPath);
      }
      continue;
    }

    matches.push(...await findRelativePathsByFileName(entryHandle as FileSystemDirectoryHandle, fileName, nextPath));
  }

  return matches;
}

async function findRelativePathByFileMetadata(
  directoryHandle: FileSystemDirectoryHandle,
  targetFile: File,
  candidatePaths: string[],
): Promise<string | null> {
  for (const candidatePath of candidatePaths) {
    const candidateFile = await getRelativeFileFromDirectory(directoryHandle, candidatePath);

    if (!candidateFile) {
      continue;
    }

    if (
      candidateFile.name === targetFile.name
      && candidateFile.size === targetFile.size
      && candidateFile.lastModified === targetFile.lastModified
      && candidateFile.type === targetFile.type
    ) {
      return candidatePath;
    }
  }

  return null;
}

async function getRelativeFileFromDirectory(
  directoryHandle: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<File | null> {
  const normalized = relativePath
    .replace(/\\/g, "/")
    .replace(/^\.\//, "");

  if (normalized.length === 0 || normalized.includes("..")) {
    return null;
  }

  const segments = normalized.split("/").filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return null;
  }

  let currentDirectory = directoryHandle;

  for (const segment of segments.slice(0, -1)) {
    currentDirectory = await currentDirectory.getDirectoryHandle(segment);
  }

  const fileHandle = await currentDirectory.getFileHandle(segments[segments.length - 1]);
  return fileHandle.getFile();
}
