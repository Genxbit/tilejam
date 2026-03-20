import type { GridCoordinate, ProjectState, SceneClipboard, SceneLayerState, SceneMapState, SourceSelection } from "../types/project";
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
  state.session.selectedSceneCells = [];
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
  state.session.selectedSceneCells = [];
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

export function copySourceSelectionToSceneClipboard(state: ProjectState): SceneClipboard | null {
  const selection = state.session.sourceSelection;

  if (!selection) {
    return null;
  }

  const tilesheetColumns = Math.max(1, Math.floor(state.project.outputWidth / state.project.tileWidth));
  const cells: SceneClipboard["cells"] = [];

  for (let rowOffset = 0; rowOffset < selection.rows; rowOffset += 1) {
    for (let colOffset = 0; colOffset < selection.columns; colOffset += 1) {
      const sourceCol = selection.startCol + colOffset;
      const sourceRow = selection.startRow + rowOffset;
      const tileId = getTileIndex(sourceCol, sourceRow, tilesheetColumns);
      cells.push({ colOffset, rowOffset, gid: tileId + FIRST_GID });
    }
  }

  return {
    width: selection.columns,
    height: selection.rows,
    cells,
  };
}

export function copySelectedSceneCells(state: ProjectState): SceneClipboard | null {
  const scene = ensureScene(state);
  const layer = getActiveSceneLayer(state);
  const selectedCells = getSelectedSceneCells(state);

  if (!layer || selectedCells.length < 1) {
    return null;
  }

  const minCol = Math.min(...selectedCells.map((cell) => cell.col));
  const maxCol = Math.max(...selectedCells.map((cell) => cell.col));
  const minRow = Math.min(...selectedCells.map((cell) => cell.row));
  const maxRow = Math.max(...selectedCells.map((cell) => cell.row));
  const cells = selectedCells.map((cell) => ({
    colOffset: cell.col - minCol,
    rowOffset: cell.row - minRow,
    gid: layer.data[cell.col + cell.row * scene.width],
  }));

  return {
    width: maxCol - minCol + 1,
    height: maxRow - minRow + 1,
    cells,
  };
}

export function pasteSceneClipboard(
  state: ProjectState,
  clipboard: SceneClipboard,
  destStartCol: number,
  destStartRow: number,
): number {
  const scene = ensureScene(state);
  const layer = getActiveSceneLayer(state);

  if (!layer) {
    return 0;
  }

  let pasted = 0;

  for (const cell of clipboard.cells) {
    const destCol = destStartCol + cell.colOffset;
    const destRow = destStartRow + cell.rowOffset;

    if (destCol < 0 || destCol >= scene.width || destRow < 0 || destRow >= scene.height) {
      continue;
    }

    layer.data[destCol + destRow * scene.width] = cell.gid;
    pasted += 1;
  }

  state.session.selectedSceneCell = { col: destStartCol, row: destStartRow };
  state.session.selectedSceneCells = clipboard.cells
    .map((cell) => ({ col: destStartCol + cell.colOffset, row: destStartRow + cell.rowOffset }))
    .filter((cell) => cell.col >= 0 && cell.col < scene.width && cell.row >= 0 && cell.row < scene.height);

  return pasted;
}

export function selectSceneCell(state: ProjectState, col: number, row: number): GridCoordinate | null {
  const scene = ensureScene(state);

  if (col < 0 || col >= scene.width || row < 0 || row >= scene.height) {
    state.session.selectedSceneCell = null;
    state.session.selectedSceneCells = [];
    return null;
  }

  state.session.selectedSceneCell = { col, row };
  state.session.selectedSceneCells = [{ col, row }];
  return state.session.selectedSceneCell;
}

export function selectSceneCellRectangle(
  state: ProjectState,
  anchorCol: number,
  anchorRow: number,
  currentCol: number,
  currentRow: number,
): GridCoordinate[] {
  const scene = ensureScene(state);
  const startCol = clamp(Math.min(anchorCol, currentCol), 0, scene.width - 1);
  const endCol = clamp(Math.max(anchorCol, currentCol), 0, scene.width - 1);
  const startRow = clamp(Math.min(anchorRow, currentRow), 0, scene.height - 1);
  const endRow = clamp(Math.max(anchorRow, currentRow), 0, scene.height - 1);
  const cells: GridCoordinate[] = [];

  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      cells.push({ col, row });
    }
  }

  state.session.selectedSceneCells = cells;
  state.session.selectedSceneCell = cells[0] ?? null;
  return cells;
}

export function moveSelectedSceneCellBy(state: ProjectState, deltaCol: number, deltaRow: number): GridCoordinate | null {
  const cell = state.session.selectedSceneCell;

  if (!cell) {
    return null;
  }

  return moveSelectedSceneCellsTo(state, cell.col + deltaCol, cell.row + deltaRow);
}

export function moveSelectedSceneCellsTo(state: ProjectState, destCol: number, destRow: number): GridCoordinate | null {
  const scene = ensureScene(state);
  const layer = getActiveSceneLayer(state);
  const selectedCell = state.session.selectedSceneCell;
  const selectedCells = getSelectedSceneCells(state);

  if (!layer || !selectedCell || selectedCells.length < 1) {
    return null;
  }

  const minCol = Math.min(...selectedCells.map((cell) => cell.col));
  const maxCol = Math.max(...selectedCells.map((cell) => cell.col));
  const minRow = Math.min(...selectedCells.map((cell) => cell.row));
  const maxRow = Math.max(...selectedCells.map((cell) => cell.row));
  const anchorOffsetCol = selectedCell.col - minCol;
  const anchorOffsetRow = selectedCell.row - minRow;
  const targetMinCol = clamp(destCol - anchorOffsetCol, 0, scene.width - (maxCol - minCol + 1));
  const targetMinRow = clamp(destRow - anchorOffsetRow, 0, scene.height - (maxRow - minRow + 1));
  const deltaCol = targetMinCol - minCol;
  const deltaRow = targetMinRow - minRow;
  const nextCol = selectedCell.col + deltaCol;
  const nextRow = selectedCell.row + deltaRow;

  if (nextCol === selectedCell.col && nextRow === selectedCell.row) {
    return selectedCell;
  }

  const selectedKeys = new Set(selectedCells.map((cell) => `${cell.col}:${cell.row}`));
  const values = selectedCells.map((cell) => ({
    cell,
    gid: layer.data[cell.col + cell.row * scene.width],
  }));
  const nextData = layer.data.slice();

  for (const { cell } of values) {
    nextData[cell.col + cell.row * scene.width] = 0;
  }

  for (const { cell, gid } of values) {
    const destCell = { col: cell.col + deltaCol, row: cell.row + deltaRow };
    const destKey = `${destCell.col}:${destCell.row}`;

    if (!selectedKeys.has(destKey)) {
      nextData[destCell.col + destCell.row * scene.width] = 0;
    }

    nextData[destCell.col + destCell.row * scene.width] = gid;
  }

  layer.data = nextData;
  state.session.selectedSceneCells = selectedCells.map((cell) => ({ col: cell.col + deltaCol, row: cell.row + deltaRow }));
  state.session.selectedSceneCell = { col: nextCol, row: nextRow };
  return state.session.selectedSceneCell;
}

export function deleteSelectedSceneCell(state: ProjectState): GridCoordinate | null {
  const deleted = deleteSelectedSceneCells(state);
  return deleted.count > 0 ? deleted.primaryCell : null;
}

export function deleteSelectedSceneCells(state: ProjectState): { count: number; primaryCell: GridCoordinate | null } {
  const scene = ensureScene(state);
  const layer = getActiveSceneLayer(state);
  const selectedCell = state.session.selectedSceneCell;
  const selectedCells = getSelectedSceneCells(state);

  if (!layer || !selectedCell || selectedCells.length < 1) {
    return { count: 0, primaryCell: null };
  }

  let count = 0;

  for (const cell of selectedCells) {
    const index = cell.col + cell.row * scene.width;

    if (layer.data[index] !== 0) {
      layer.data[index] = 0;
      count += 1;
    }
  }

  return { count, primaryCell: selectedCell };
}

export function getSelectedSceneCells(state: ProjectState): GridCoordinate[] {
  if (state.session.selectedSceneCells.length > 0) {
    return state.session.selectedSceneCells;
  }

  return state.session.selectedSceneCell ? [state.session.selectedSceneCell] : [];
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
