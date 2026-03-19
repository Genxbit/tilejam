import type { ProjectState } from "../types/project";
import { saveTilesetPngToHandle, saveTilesetPngWithPicker, saveTilesetTsjWithPicker } from "../io/exportTileset";
import { loadProjectFile, loadProjectFromHandle, loadProjectFromUrl } from "../io/loadProjectFile";
import { loadSceneFile, loadSceneFromHandle, loadSceneFromUrl, saveSceneToHandle, saveSceneWithPicker } from "../io/sceneFile";
import { downloadProjectFile, saveProjectToHandle, saveProjectWithPicker } from "../io/saveProjectFile";
import { renderWorkspace } from "../rendering/renderWorkspace";
import { createProjectState } from "../data/createProjectState";
import {
  alignSelectedOutputTile,
  clearSelectedOutputTile,
  deleteSelectedOutputTile,
  getSelectedOutputTile,
  getSelectedOutputTiles,
  moveSelectedOutputTileBy,
  moveTileToCell,
  nudgeSelectedOutputTile,
  rotateSelectedOutputTileByQuarterTurns,
  selectOutputTileAtCell,
  selectOutputTileRectangle,
  setSelectedOutputTileFitMode,
  snapSelectedOutputTileToEdges,
  trimSelectedOutputTileTransparentBounds,
  updateSelectedOutputTile,
} from "../systems/tileEditorSystem";
import { assignAllSourceTilesToOutputGrid, assignSelectionToOutputTile, rebuildTilesFromWorkingSheet } from "../systems/tilePlacementSystem";
import { addSceneLayer, clearSceneLayers, deleteSelectedSceneCell, ensureScene, moveActiveSceneLayerBy, moveSceneCellTo, moveSelectedSceneCellBy, placeSelectionIntoScene, resetScene, resizeScene, selectSceneCell, selectSceneLayer, setSceneTilesetSource, updateActiveSceneLayer } from "../systems/sceneSystem";
import { clearSelectionState, commitDraftSourceSelection, moveHoveredOutputTileBy, moveSourceSelectionBy, setHoveredOutputTile, updateDraftSourceSelection } from "../systems/selectionSystem";
import {
  clearSourceImageAsset,
  ensureActiveSourceImageFromProject,
  loadImageAssetFromFile,
  loadImageAssetFromUrl,
  loadSourceImageFromFile,
  loadSourceImageFromFileWithRef,
  loadSourceImageFromUrl,
  getSourceImageForRef,
} from "../systems/sourceImageSystem";
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
  selectedSceneCell: ProjectState["session"]["selectedSceneCell"];
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
          state.project.workingImage = fileName;
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
          state.project.workingImage = result.handle.name;
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
        state.session.activeWorkspaceMode = "scene";
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
        state.session.activeWorkspaceMode = "scene";
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
    onWorkspaceModeChanged: (mode) => {
      state.session.activeWorkspaceMode = mode;
      if (mode === "scene" && state.project.scene) {
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
      renderAll();
      state.session.message = layer ? `Selected scene layer ${layer.name}.` : "Scene layer not found.";
      return;
    },
    onSceneLayerAdded: () => {
      recordHistory();
      const layer = addSceneLayer(state);
      bumpRenderRevision();
      state.session.selectedSceneCell = null;
      state.session.message = `Added scene layer ${layer.name}.`;
      renderAll();
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

      let bakedCount = 0;

      for (const tile of selectedTiles) {
        const image = getSourceImageForRef(state, tile.sourceImageRef) ?? state.sourceImageAsset.image;

        if (!image) {
          continue;
        }

        const bakedCanvas = renderTileCanvas(
          image,
          tile,
          state.project.tileWidth,
          state.project.tileHeight,
          { applyEdgeExtend: true },
        );

        if (!bakedCanvas) {
          continue;
        }

        const ref = `runtime:edge-extend:${Date.now()}:${tile.id}:${Math.random().toString(36).slice(2, 8)}`;
        await loadImageAssetFromUrl(state, bakedCanvas.toDataURL("image/png"), ref);

        tile.sourceImageRef = ref;
        tile.sourceRect = {
          x: 0,
          y: 0,
          w: state.project.tileWidth,
          h: state.project.tileHeight,
        };
        tile.offsetX = 0;
        tile.offsetY = 0;
        tile.scaleX = 1;
        tile.scaleY = 1;
        tile.fitMode = "manual";
        tile.anchorX = "center";
        tile.anchorY = "center";
        tile.cropLeft = 0;
        tile.cropRight = 0;
        tile.cropTop = 0;
        tile.cropBottom = 0;
        tile.clampToTile = true;
        tile.edgeStretchLeft = 0;
        tile.edgeStretchRight = 0;
        tile.edgeStretchTop = 0;
        tile.edgeStretchBottom = 0;
        tile.edgeExtend = false;
        tile.fillExposedColor = null;
        tile.flipX = false;
        tile.flipY = false;
        tile.rotationQuarterTurns = 0;
        tile.brightness = 0;
        tile.contrast = 1;
        tile.saturation = 1;
        tile.tintColor = null;
        tile.filterMode = "nearest";
        tile.pixelSnap = true;
        bakedCount += 1;
      }

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
          state.session.message = `Placed ${assignedCount} scene tile${assignedCount === 1 ? "" : "s"} starting at ${outputHit.col}, ${outputHit.row}. Selection is still active for repeated placement.`;
        } else {
          undoStack.pop();
          state.session.message = "Selection did not fit inside the scene grid.";
        }

        renderAll();
        return;
      }

      const sceneCell = selectSceneCell(state, outputHit.col, outputHit.row);

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
        const selectedTiles = selectOutputTileRectangle(
          state,
          anchorTile?.destCol ?? outputHit.col,
          anchorTile?.destRow ?? outputHit.row,
          outputHit.col,
          outputHit.row,
        );
        state.session.message = selectedTiles.length > 0
          ? `Selected ${selectedTiles.length} tile${selectedTiles.length === 1 ? "" : "s"} in a rectangle.`
          : "No placed tiles inside the selected rectangle.";
        renderAll();
        return;
      }

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

      const movedCell = outputHit ? moveSceneCellTo(state, outputHit.col, outputHit.row) : null;
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
          ? `Moved scene cell to ${movedCell.col}, ${movedCell.row}.`
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
            state.session.message = `Moved scene cell to ${movedCell.col}, ${movedCell.row}.`;
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
        const deletedCell = deleteSelectedSceneCell(state);

        if (!deletedCell) {
          undoStack.pop();
          return;
        }

        bumpRenderRevision();
        state.session.message = `Cleared scene cell ${deletedCell.col}, ${deletedCell.row}.`;
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

function createHistoryEntry(state: ProjectState): HistoryEntry {
  return {
    project: JSON.parse(JSON.stringify(state.project)) as ProjectState["project"],
    selectedOutputTileId: state.session.selectedOutputTileId,
    selectedOutputTileIds: [...state.session.selectedOutputTileIds],
    selectedSceneCell: state.session.selectedSceneCell ? { ...state.session.selectedSceneCell } : null,
    activeSceneLayerId: state.session.activeSceneLayerId,
  };
}

function restoreHistoryEntry(state: ProjectState, entry: HistoryEntry): void {
  state.project = JSON.parse(JSON.stringify(entry.project)) as ProjectState["project"];
  state.session.selectedOutputTileId = entry.selectedOutputTileId;
  state.session.selectedOutputTileIds = [...entry.selectedOutputTileIds];
  state.session.selectedSceneCell = entry.selectedSceneCell ? { ...entry.selectedSceneCell } : null;
  state.session.activeSceneLayerId = entry.activeSceneLayerId;
  normalizeProjectTilesToGrid(state);
}

function getExportFilename(state: ProjectState, extension: "png" | "tsj"): string {
  const projectName = state.session.projectFileName ?? "latest.tilejam.json";
  const baseName = projectName.replace(/(?:\.tilejam)?\.json$/i, "");
  return `${baseName || "tileset"}.${extension}`;
}

async function bakeSelectedTilesGroupShift(
  state: ProjectState,
  selectedTiles: ProjectState["project"]["tiles"],
  deltaX: number,
  deltaY: number,
): Promise<number> {
  if (selectedTiles.length < 1) {
    return 0;
  }

  const minCol = Math.min(...selectedTiles.map((tile) => tile.destCol));
  const maxCol = Math.max(...selectedTiles.map((tile) => tile.destCol));
  const minRow = Math.min(...selectedTiles.map((tile) => tile.destRow));
  const maxRow = Math.max(...selectedTiles.map((tile) => tile.destRow));
  const columns = maxCol - minCol + 1;
  const rows = maxRow - minRow + 1;
  const groupCanvas = document.createElement("canvas");
  groupCanvas.width = columns * state.project.tileWidth;
  groupCanvas.height = rows * state.project.tileHeight;
  const groupContext = groupCanvas.getContext("2d");

  if (!groupContext) {
    return 0;
  }

  groupContext.clearRect(0, 0, groupCanvas.width, groupCanvas.height);

  for (const tile of selectedTiles) {
    const image = getSourceImageForRef(state, tile.sourceImageRef) ?? state.sourceImageAsset.image;

    if (!image) {
      continue;
    }

    const renderedTile = renderTileCanvas(image, tile, state.project.tileWidth, state.project.tileHeight);

    if (!renderedTile) {
      continue;
    }

    groupContext.drawImage(
      renderedTile,
      (tile.destCol - minCol) * state.project.tileWidth,
      (tile.destRow - minRow) * state.project.tileHeight,
    );
  }

  const shiftedCanvas = document.createElement("canvas");
  shiftedCanvas.width = groupCanvas.width;
  shiftedCanvas.height = groupCanvas.height;
  const shiftedContext = shiftedCanvas.getContext("2d");

  if (!shiftedContext) {
    return 0;
  }

  shiftedContext.clearRect(0, 0, shiftedCanvas.width, shiftedCanvas.height);
  shiftedContext.drawImage(groupCanvas, deltaX, deltaY);

  let shiftedCount = 0;

  for (const tile of selectedTiles) {
    const tileCanvas = document.createElement("canvas");
    tileCanvas.width = state.project.tileWidth;
    tileCanvas.height = state.project.tileHeight;
    const tileContext = tileCanvas.getContext("2d");

    if (!tileContext) {
      continue;
    }

    const sourceX = (tile.destCol - minCol) * state.project.tileWidth;
    const sourceY = (tile.destRow - minRow) * state.project.tileHeight;
    tileContext.clearRect(0, 0, tileCanvas.width, tileCanvas.height);
    tileContext.drawImage(
      shiftedCanvas,
      sourceX,
      sourceY,
      state.project.tileWidth,
      state.project.tileHeight,
      0,
      0,
      state.project.tileWidth,
      state.project.tileHeight,
    );

    const ref = `runtime:group-shift:${Date.now()}:${tile.id}:${Math.random().toString(36).slice(2, 8)}`;
    await loadImageAssetFromUrl(state, tileCanvas.toDataURL("image/png"), ref);
    tile.sourceImageRef = ref;
    tile.sourceRect = {
      x: 0,
      y: 0,
      w: state.project.tileWidth,
      h: state.project.tileHeight,
    };
    tile.offsetX = 0;
    tile.offsetY = 0;
    tile.scaleX = 1;
    tile.scaleY = 1;
    tile.fitMode = "manual";
    tile.anchorX = "center";
    tile.anchorY = "center";
    tile.cropLeft = 0;
    tile.cropRight = 0;
    tile.cropTop = 0;
    tile.cropBottom = 0;
    tile.clampToTile = true;
    tile.edgeStretchLeft = 0;
    tile.edgeStretchRight = 0;
    tile.edgeStretchTop = 0;
    tile.edgeStretchBottom = 0;
    tile.edgeExtend = false;
    tile.fillExposedColor = null;
    tile.flipX = false;
    tile.flipY = false;
    tile.rotationQuarterTurns = 0;
    tile.brightness = 0;
    tile.contrast = 1;
    tile.saturation = 1;
    tile.tintColor = null;
    tile.filterMode = "nearest";
    tile.pixelSnap = true;
    shiftedCount += 1;
  }

  return shiftedCount;
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
      await loadSourceImageFromUrl(state, resolvedSourceImage, getDisplayFileName(project.sourceImage) ?? project.sourceImage);
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
  state.project.workingImage = workingImageRef;
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
