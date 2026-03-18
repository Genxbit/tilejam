import type { ProjectState, TilePlacement } from "../types/project";
import { getOutputGridMetrics, getTileIndex } from "./tileGridSystem";

type EditableTileFields = Pick<
  TilePlacement,
  | "destCol"
  | "destRow"
  | "offsetX"
  | "offsetY"
  | "scaleX"
  | "scaleY"
  | "flipX"
  | "flipY"
  | "brightness"
  | "contrast"
  | "saturation"
  | "tintColor"
  | "filterMode"
  | "pixelSnap"
  | "name"
  | "tags"
  | "collision"
>;

export function selectOutputTileAtCell(state: ProjectState, col: number, row: number): TilePlacement | null {
  const tile = state.project.tiles.find((entry) => entry.destCol === col && entry.destRow === row) ?? null;
  state.session.selectedOutputTileId = tile?.id ?? null;
  return tile;
}

export function clearSelectedOutputTile(state: ProjectState): void {
  state.session.selectedOutputTileId = null;
}

export function getSelectedOutputTile(state: ProjectState): TilePlacement | null {
  return state.project.tiles.find((tile) => tile.id === state.session.selectedOutputTileId) ?? null;
}

export function updateSelectedOutputTile(state: ProjectState, patch: Partial<EditableTileFields>): TilePlacement | null {
  const tile = getSelectedOutputTile(state);

  if (!tile) {
    return null;
  }

  const nextDestCol = patch.destCol ?? tile.destCol;
  const nextDestRow = patch.destRow ?? tile.destRow;

  if (nextDestCol !== tile.destCol || nextDestRow !== tile.destRow) {
    moveTileToCell(state, tile.id, nextDestCol, nextDestRow);
  }

  const nextTile = getSelectedOutputTile(state);

  if (!nextTile) {
    return null;
  }

  Object.assign(nextTile, patch);
  reindexTiles(state);
  return getSelectedOutputTile(state);
}

export function moveSelectedOutputTileBy(state: ProjectState, deltaCol: number, deltaRow: number): TilePlacement | null {
  const tile = getSelectedOutputTile(state);

  if (!tile) {
    return null;
  }

  return moveTileToCell(state, tile.id, tile.destCol + deltaCol, tile.destRow + deltaRow);
}

export function moveTileToCell(state: ProjectState, tileId: number, destCol: number, destRow: number): TilePlacement | null {
  const outputGrid = getOutputGridMetrics(state.project);
  const clampedCol = clamp(destCol, 0, outputGrid.columns - 1);
  const clampedRow = clamp(destRow, 0, outputGrid.rows - 1);
  const tile = state.project.tiles.find((entry) => entry.id === tileId);

  if (!tile) {
    return null;
  }

  if (tile.destCol === clampedCol && tile.destRow === clampedRow) {
    return tile;
  }

  const occupant = state.project.tiles.find(
    (entry) => entry.id !== tileId && entry.destCol === clampedCol && entry.destRow === clampedRow,
  );

  if (occupant) {
    occupant.destCol = tile.destCol;
    occupant.destRow = tile.destRow;
  }

  tile.destCol = clampedCol;
  tile.destRow = clampedRow;
  reindexTiles(state);
  state.session.selectedOutputTileId = tile.id;

  return tile;
}

function reindexTiles(state: ProjectState): void {
  const outputGrid = getOutputGridMetrics(state.project);
  const selectedTile = getSelectedOutputTile(state);

  for (const tile of state.project.tiles) {
    tile.id = getTileIndex(tile.destCol, tile.destRow, outputGrid.columns);
  }

  state.project.tiles.sort((left, right) => left.id - right.id);
  state.session.selectedOutputTileId = selectedTile
    ? getTileIndex(selectedTile.destCol, selectedTile.destRow, outputGrid.columns)
    : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
