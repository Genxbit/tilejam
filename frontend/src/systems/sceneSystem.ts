import type { GridCoordinate, ProjectState, SceneLayerState, SceneMapState, SourceSelection } from "../types/project";
import { getOutputGridMetrics, getTileIndex } from "./tileGridSystem";

const FIRST_GID = 1;

export function ensureScene(state: ProjectState): SceneMapState {
  if (!state.project.scene) {
    state.project.scene = createDefaultScene(state);
  }

  if (!state.project.scene.layers.some((layer) => layer.id === state.session.activeSceneLayerId)) {
    state.session.activeSceneLayerId = state.project.scene.layers[0]?.id ?? null;
  }

  return state.project.scene;
}

export function createDefaultScene(state: ProjectState, width?: number, height?: number): SceneMapState {
  const grid = getOutputGridMetrics(state.project);
  const sceneWidth = Math.max(1, width ?? grid.columns);
  const sceneHeight = Math.max(1, height ?? grid.rows);

  return {
    width: sceneWidth,
    height: sceneHeight,
    tileWidth: state.project.tileWidth,
    tileHeight: state.project.tileHeight,
    tilesetSource: "tileset.tsj",
    layers: [
      createSceneLayer(1, "ground", sceneWidth, sceneHeight),
    ],
  };
}

export function resetScene(state: ProjectState): SceneMapState {
  const existingScene = state.project.scene;
  const scene = createDefaultScene(
    state,
    existingScene?.width,
    existingScene?.height,
  );
  state.project.scene = scene;
  state.session.activeSceneLayerId = scene.layers[0]?.id ?? null;
  state.session.selectedSceneCell = null;
  return scene;
}

export function clearSceneLayers(state: ProjectState): number {
  const scene = ensureScene(state);
  let clearedCount = 0;

  for (const layer of scene.layers) {
    for (let index = 0; index < layer.data.length; index += 1) {
      if (layer.data[index] !== 0) {
        layer.data[index] = 0;
        clearedCount += 1;
      }
    }
  }

  state.session.selectedSceneCell = null;
  return clearedCount;
}

export function resizeScene(state: ProjectState, width: number, height: number): SceneMapState {
  const scene = ensureScene(state);
  scene.width = Math.max(1, width);
  scene.height = Math.max(1, height);
  scene.tileWidth = state.project.tileWidth;
  scene.tileHeight = state.project.tileHeight;

  for (const layer of scene.layers) {
    layer.data = resizeLayerData(layer.data, layer.width, layer.height, scene.width, scene.height);
    layer.width = scene.width;
    layer.height = scene.height;
  }

  return scene;
}

export function setSceneTilesetSource(state: ProjectState, tilesetSource: string): SceneMapState {
  const scene = ensureScene(state);
  scene.tilesetSource = tilesetSource.trim() || "tileset.tsj";
  return scene;
}

export function addSceneLayer(state: ProjectState): SceneLayerState {
  const scene = ensureScene(state);
  const nextId = Math.max(0, ...scene.layers.map((layer) => layer.id)) + 1;
  const layer = createSceneLayer(nextId, `layer_${nextId}`, scene.width, scene.height);
  scene.layers.push(layer);
  state.session.activeSceneLayerId = layer.id;
  return layer;
}

export function selectSceneLayer(state: ProjectState, layerId: number): SceneLayerState | null {
  const scene = ensureScene(state);
  const layer = scene.layers.find((entry) => entry.id === layerId) ?? null;

  if (!layer) {
    return null;
  }

  state.session.activeSceneLayerId = layer.id;
  return layer;
}

export function updateActiveSceneLayer(
  state: ProjectState,
  patch: Partial<Pick<SceneLayerState, "name" | "visible" | "opacity" | "offsetX" | "offsetY" | "parallaxX" | "parallaxY">>,
): SceneLayerState | null {
  const layer = getActiveSceneLayer(state);

  if (!layer) {
    return null;
  }

  Object.assign(layer, patch);
  layer.name = layer.name.trim() || `layer_${layer.id}`;
  layer.opacity = clampOpacity(layer.opacity);
  layer.parallaxX = clampParallax(layer.parallaxX);
  layer.parallaxY = clampParallax(layer.parallaxY);
  return layer;
}

export function moveActiveSceneLayerBy(state: ProjectState, delta: -1 | 1): SceneLayerState | null {
  const scene = ensureScene(state);
  const layerIndex = scene.layers.findIndex((layer) => layer.id === state.session.activeSceneLayerId);

  if (layerIndex < 0) {
    return null;
  }

  const nextIndex = clamp(layerIndex + delta, 0, scene.layers.length - 1);

  if (nextIndex === layerIndex) {
    return scene.layers[layerIndex] ?? null;
  }

  const [layer] = scene.layers.splice(layerIndex, 1);

  if (!layer) {
    return null;
  }

  scene.layers.splice(nextIndex, 0, layer);
  state.session.activeSceneLayerId = layer.id;
  return layer;
}

export function getActiveSceneLayer(state: ProjectState): SceneLayerState | null {
  const scene = state.project.scene;

  if (!scene) {
    return null;
  }

  return scene.layers.find((layer) => layer.id === state.session.activeSceneLayerId) ?? scene.layers[0] ?? null;
}

export function placeSelectionIntoScene(
  state: ProjectState,
  selection: SourceSelection,
  destStartCol: number,
  destStartRow: number,
): number {
  const scene = ensureScene(state);
  const layer = getActiveSceneLayer(state);

  if (!layer) {
    return 0;
  }

  const tilesheetColumns = Math.max(1, Math.floor(state.project.outputWidth / state.project.tileWidth));
  let placed = 0;

  for (let rowOffset = 0; rowOffset < selection.rows; rowOffset += 1) {
    for (let colOffset = 0; colOffset < selection.columns; colOffset += 1) {
      const destCol = destStartCol + colOffset;
      const destRow = destStartRow + rowOffset;

      if (destCol < 0 || destCol >= scene.width || destRow < 0 || destRow >= scene.height) {
        continue;
      }

      const sourceCol = selection.startCol + colOffset;
      const sourceRow = selection.startRow + rowOffset;
      const tileId = getTileIndex(sourceCol, sourceRow, tilesheetColumns);
      const layerIndex = destCol + destRow * scene.width;
      layer.data[layerIndex] = tileId + FIRST_GID;
      placed += 1;
    }
  }

  return placed;
}

export function selectSceneCell(state: ProjectState, col: number, row: number): GridCoordinate | null {
  const scene = ensureScene(state);

  if (col < 0 || col >= scene.width || row < 0 || row >= scene.height) {
    state.session.selectedSceneCell = null;
    return null;
  }

  state.session.selectedSceneCell = { col, row };
  return state.session.selectedSceneCell;
}

export function moveSelectedSceneCellBy(state: ProjectState, deltaCol: number, deltaRow: number): GridCoordinate | null {
  const cell = state.session.selectedSceneCell;

  if (!cell) {
    return null;
  }

  return moveSceneCellTo(state, cell.col + deltaCol, cell.row + deltaRow);
}

export function moveSceneCellTo(state: ProjectState, destCol: number, destRow: number): GridCoordinate | null {
  const scene = ensureScene(state);
  const layer = getActiveSceneLayer(state);
  const selectedCell = state.session.selectedSceneCell;

  if (!layer || !selectedCell) {
    return null;
  }

  const nextCol = clamp(destCol, 0, scene.width - 1);
  const nextRow = clamp(destRow, 0, scene.height - 1);

  if (nextCol === selectedCell.col && nextRow === selectedCell.row) {
    return selectedCell;
  }

  const fromIndex = selectedCell.col + selectedCell.row * scene.width;
  const toIndex = nextCol + nextRow * scene.width;
  layer.data[toIndex] = layer.data[fromIndex];
  layer.data[fromIndex] = 0;
  state.session.selectedSceneCell = { col: nextCol, row: nextRow };
  return state.session.selectedSceneCell;
}

export function deleteSelectedSceneCell(state: ProjectState): GridCoordinate | null {
  const scene = ensureScene(state);
  const layer = getActiveSceneLayer(state);
  const selectedCell = state.session.selectedSceneCell;

  if (!layer || !selectedCell) {
    return null;
  }

  const index = selectedCell.col + selectedCell.row * scene.width;
  layer.data[index] = 0;
  return selectedCell;
}

export function getSceneCellGid(state: ProjectState, col: number, row: number, layerId?: number | null): number {
  const scene = state.project.scene;

  if (!scene || col < 0 || row < 0 || col >= scene.width || row >= scene.height) {
    return 0;
  }

  const layer = layerId === undefined
    ? getActiveSceneLayer(state)
    : scene.layers.find((entry) => entry.id === layerId) ?? null;

  if (!layer) {
    return 0;
  }

  return layer.data[col + row * scene.width] ?? 0;
}

export function createSceneLayer(id: number, name: string, width: number, height: number): SceneLayerState {
  return {
    id,
    name,
    width,
    height,
    visible: true,
    opacity: 1,
    offsetX: 0,
    offsetY: 0,
    parallaxX: 1,
    parallaxY: 1,
    data: new Array(width * height).fill(0),
  };
}

function resizeLayerData(
  existingData: number[],
  existingWidth: number,
  existingHeight: number,
  nextWidth: number,
  nextHeight: number,
): number[] {
  const nextData = new Array(nextWidth * nextHeight).fill(0);
  const copyWidth = Math.min(existingWidth, nextWidth);
  const copyHeight = Math.min(existingHeight, nextHeight);

  for (let row = 0; row < copyHeight; row += 1) {
    for (let col = 0; col < copyWidth; col += 1) {
      nextData[col + row * nextWidth] = existingData[col + row * existingWidth] ?? 0;
    }
  }

  return nextData;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampOpacity(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 1));
}

function clampParallax(value: number): number {
  return Number.isFinite(value) ? value : 1;
}
