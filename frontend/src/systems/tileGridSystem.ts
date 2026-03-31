import type { ProjectState, TileSize, TilejamProject } from "../types/project";

export const TILE_SIZE_OPTIONS: TileSize[] = [8, 16, 32, 64, 128, 256, 512, 1024];

export type SourceGridMetrics = {
  columns: number;
  rows: number;
  tileWidth: TileSize;
  tileHeight: TileSize;
};

export function setSourceGridTileSize(state: ProjectState, tileSize: TileSize): void {
  state.project.sourceTileWidth = tileSize;
  state.project.sourceTileHeight = tileSize;
}

export function setOutputTileSize(state: ProjectState, tileSize: TileSize): void {
  state.project.tileWidth = tileSize;
  state.project.tileHeight = tileSize;
}

export function setOutputGridSize(state: ProjectState, columns: number, rows: number): void {
  state.project.outputWidth = columns * state.project.tileWidth;
  state.project.outputHeight = rows * state.project.tileHeight;
}

export function setOutputImageSize(state: ProjectState, width: number, height: number): void {
  state.project.outputWidth = width;
  state.project.outputHeight = height;
}

export function normalizeProjectTilesToGrid(state: ProjectState): number {
  const outputGrid = getOutputGridMetrics(state.project);
  const selectedTile = state.project.tiles.find((tile) => tile.id === state.session.selectedOutputTileId) ?? null;
  const selectedTiles = state.project.tiles.filter((tile) => state.session.selectedOutputTileIds.includes(tile.id));
  const dedupedTiles = new Map<string, typeof state.project.tiles[number]>();
  let droppedCount = 0;

  for (const tile of state.project.tiles) {
    if (
      tile.destCol < 0 ||
      tile.destCol >= outputGrid.columns ||
      tile.destRow < 0 ||
      tile.destRow >= outputGrid.rows
    ) {
      droppedCount += 1;
      continue;
    }

    dedupedTiles.set(`${tile.destCol}:${tile.destRow}`, tile);
  }

  state.project.tiles = Array.from(dedupedTiles.values());

  for (const tile of state.project.tiles) {
    tile.id = getTileIndex(tile.destCol, tile.destRow, outputGrid.columns);
  }

  state.project.tiles.sort((left, right) => left.id - right.id);
  state.session.selectedOutputTileId = selectedTile
    && selectedTile.destCol >= 0
    && selectedTile.destCol < outputGrid.columns
    && selectedTile.destRow >= 0
    && selectedTile.destRow < outputGrid.rows
      ? getTileIndex(selectedTile.destCol, selectedTile.destRow, outputGrid.columns)
      : null;
  state.session.selectedOutputTileIds = selectedTiles
    .filter((tile) =>
      tile.destCol >= 0
      && tile.destCol < outputGrid.columns
      && tile.destRow >= 0
      && tile.destRow < outputGrid.rows,
    )
    .map((tile) => getTileIndex(tile.destCol, tile.destRow, outputGrid.columns));

  if (state.session.selectedOutputTileId !== null && !state.session.selectedOutputTileIds.includes(state.session.selectedOutputTileId)) {
    state.session.selectedOutputTileIds.unshift(state.session.selectedOutputTileId);
  }

  return droppedCount;
}

export function getTileIndex(col: number, row: number, columns: number): number {
  return col + row * columns;
}

export function getProjectTileCount(project: TilejamProject): number {
  const metrics = getOutputGridMetrics(project);
  return metrics.columns * metrics.rows;
}

export function getProjectIndexRange(project: TilejamProject): string {
  const lastIndex = Math.max(0, getProjectTileCount(project) - 1);
  return `0-${lastIndex}`;
}

export function getSourceGridMetrics(
  imageWidth: number,
  imageHeight: number,
  tileWidth: TileSize,
  tileHeight: TileSize,
): SourceGridMetrics {
  return {
    columns: Math.floor(imageWidth / tileWidth),
    rows: Math.floor(imageHeight / tileHeight),
    tileWidth,
    tileHeight,
  };
}

export function getProjectPixelSize(project: TilejamProject): { width: number; height: number } {
  return {
    width: project.outputWidth,
    height: project.outputHeight,
  };
}

export function getOutputGridMetrics(project: TilejamProject): {
  columns: number;
  rows: number;
  tileWidth: TileSize;
  tileHeight: TileSize;
} {
  return {
    columns: Math.max(1, Math.floor(project.outputWidth / project.tileWidth)),
    rows: Math.max(1, Math.floor(project.outputHeight / project.tileHeight)),
    tileWidth: project.tileWidth,
    tileHeight: project.tileHeight,
  };
}
