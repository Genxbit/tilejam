import type { ProjectState, TilePlacement } from "../types/project";
import { getOutputGridMetrics, normalizeProjectTilesToGrid } from "./tileGridSystem";

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
  const tileIndex = state.project.tiles.findIndex((entry) => entry.id === tileId);
  const tile = tileIndex >= 0 ? state.project.tiles[tileIndex] : undefined;

  if (!tile) {
    return null;
  }

  if (tile.destCol === clampedCol && tile.destRow === clampedRow) {
    return tile;
  }

  state.project.tiles = state.project.tiles.filter(
    (entry, index) => index === tileIndex || entry.destCol !== clampedCol || entry.destRow !== clampedRow,
  );

  const nextTile = state.project.tiles.find((entry) => entry.id === tileId);

  if (!nextTile) {
    return null;
  }

  nextTile.destCol = clampedCol;
  nextTile.destRow = clampedRow;
  reindexTiles(state);
  state.session.selectedOutputTileId = nextTile.id;

  return nextTile;
}

function reindexTiles(state: ProjectState): void {
  normalizeProjectTilesToGrid(state);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
