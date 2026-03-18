import type { ProjectState, SourceSelection, TilePlacement } from "../types/project";
import { getOutputGridMetrics, getSourceGridMetrics, getTileIndex } from "./tileGridSystem";

export function assignSelectionToOutputTile(
  state: ProjectState,
  selection: SourceSelection,
  destStartCol: number,
  destStartRow: number,
): number {
  const outputGrid = getOutputGridMetrics(state.project);
  const placementGrid = getPlacementGrid(state);
  const nextTiles = state.project.tiles.filter((tile) => {
    if (
      tile.destCol >= destStartCol &&
      tile.destCol < destStartCol + selection.columns * placementGrid.columnsPerSourceTile &&
      tile.destRow >= destStartRow &&
      tile.destRow < destStartRow + selection.rows * placementGrid.rowsPerSourceTile
    ) {
      return false;
    }

    return true;
  });

  let placementsAdded = 0;

  for (let rowOffset = 0; rowOffset < selection.rows; rowOffset += 1) {
    for (let colOffset = 0; colOffset < selection.columns; colOffset += 1) {
      for (let subRow = 0; subRow < placementGrid.rowsPerSourceTile; subRow += 1) {
        for (let subCol = 0; subCol < placementGrid.columnsPerSourceTile; subCol += 1) {
          const destCol = destStartCol + colOffset * placementGrid.columnsPerSourceTile + subCol;
          const destRow = destStartRow + rowOffset * placementGrid.rowsPerSourceTile + subRow;

          if (destCol < 0 || destCol >= outputGrid.columns || destRow < 0 || destRow >= outputGrid.rows) {
            continue;
          }

          nextTiles.push(
            createTilePlacement(
              state,
              selection,
              colOffset,
              rowOffset,
              subCol,
              subRow,
              destCol,
              destRow,
              outputGrid.columns,
            ),
          );
          placementsAdded += 1;
        }
      }
    }
  }

  nextTiles.sort((left, right) => left.id - right.id);
  state.project.tiles = nextTiles;

  return placementsAdded;
}

export function getAssignedTileCount(state: ProjectState): number {
  return state.project.tiles.length;
}

export function assignAllSourceTilesToOutputGrid(state: ProjectState): number {
  const image = state.sourceImageAsset.image;

  if (!image) {
    return 0;
  }

  const outputGrid = getOutputGridMetrics(state.project);
  const placementGrid = getPlacementGrid(state);
  const sourceGrid = getSourceGridMetrics(
    image.width,
    image.height,
    state.project.sourceTileWidth,
    state.project.sourceTileHeight,
  );
  const nextTiles: TilePlacement[] = [];
  let placed = 0;

  for (let row = 0; row < sourceGrid.rows; row += 1) {
    for (let col = 0; col < sourceGrid.columns; col += 1) {
      for (let subRow = 0; subRow < placementGrid.rowsPerSourceTile; subRow += 1) {
        for (let subCol = 0; subCol < placementGrid.columnsPerSourceTile; subCol += 1) {
          const destCol = col * placementGrid.columnsPerSourceTile + subCol;
          const destRow = row * placementGrid.rowsPerSourceTile + subRow;

          if (destCol >= outputGrid.columns || destRow >= outputGrid.rows) {
            continue;
          }

          nextTiles.push(
            createTilePlacementFromSourceRect(
              state,
              getSourceRectForPlacement(state, col, row, subCol, subRow),
              destCol,
              destRow,
              outputGrid.columns,
            ),
          );
          placed += 1;
        }
      }
    }
  }

  state.project.tiles = nextTiles;
  return placed;
}

function createTilePlacement(
  state: ProjectState,
  selection: SourceSelection,
  colOffset: number,
  rowOffset: number,
  subCol: number,
  subRow: number,
  destCol: number,
  destRow: number,
  columns: number,
): TilePlacement {
  return createTilePlacementFromSourceRect(
    state,
    getSourceRectForPlacement(
      state,
      Math.floor(selection.sourceRect.x / state.project.sourceTileWidth) + colOffset,
      Math.floor(selection.sourceRect.y / state.project.sourceTileHeight) + rowOffset,
      subCol,
      subRow,
    ),
    destCol,
    destRow,
    columns,
  );
}

function createTilePlacementFromSourceRect(
  state: ProjectState,
  sourceRect: TilePlacement["sourceRect"],
  destCol: number,
  destRow: number,
  columns: number,
): TilePlacement {
  const id = getTileIndex(destCol, destRow, columns);
  const offsetX = Math.floor((state.project.tileWidth - sourceRect.w) / 2);
  const offsetY = Math.floor((state.project.tileHeight - sourceRect.h) / 2);

  return {
    id,
    destCol,
    destRow,
    sourceImageRef: state.project.sourceImage,
    sourceRect,
    offsetX,
    offsetY,
    scaleX: 1,
    scaleY: 1,
    flipX: false,
    flipY: false,
    brightness: 0,
    contrast: 1,
    saturation: 1,
    tintColor: null,
    filterMode: "nearest",
    pixelSnap: true,
    name: `tile_${id}`,
    tags: [],
    collision: "none",
  };
}

function getPlacementGrid(state: ProjectState): {
  columnsPerSourceTile: number;
  rowsPerSourceTile: number;
} {
  const splitColumns = state.project.sourceTileWidth >= state.project.tileWidth
    && state.project.sourceTileWidth % state.project.tileWidth === 0
      ? state.project.sourceTileWidth / state.project.tileWidth
      : 1;
  const splitRows = state.project.sourceTileHeight >= state.project.tileHeight
    && state.project.sourceTileHeight % state.project.tileHeight === 0
      ? state.project.sourceTileHeight / state.project.tileHeight
      : 1;

  return {
    columnsPerSourceTile: splitColumns,
    rowsPerSourceTile: splitRows,
  };
}

function getSourceRectForPlacement(
  state: ProjectState,
  sourceTileCol: number,
  sourceTileRow: number,
  subCol: number,
  subRow: number,
): TilePlacement["sourceRect"] {
  const placementGrid = getPlacementGrid(state);
  const sourceRectWidth = state.project.sourceTileWidth / placementGrid.columnsPerSourceTile;
  const sourceRectHeight = state.project.sourceTileHeight / placementGrid.rowsPerSourceTile;

  return {
    x: sourceTileCol * state.project.sourceTileWidth + subCol * sourceRectWidth,
    y: sourceTileRow * state.project.sourceTileHeight + subRow * sourceRectHeight,
    w: sourceRectWidth,
    h: sourceRectHeight,
  };
}
