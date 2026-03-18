import type { ProjectState, TileSize, TilejamProject } from "../types/project";

export const TILE_SIZE_OPTIONS: TileSize[] = [8, 16, 32, 64];

export type SourceGridMetrics = {
  columns: number;
  rows: number;
  tileWidth: TileSize;
  tileHeight: TileSize;
};

export function setUniformTileSize(state: ProjectState, tileSize: TileSize): void {
  state.project.tileWidth = tileSize;
  state.project.tileHeight = tileSize;
}

export function getTileIndex(col: number, row: number, columns: number): number {
  return col + row * columns;
}

export function getProjectTileCount(project: TilejamProject): number {
  return project.columns * project.rows;
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
