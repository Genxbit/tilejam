import type { ProjectState, SourceSelection, TilePlacement } from "../types/project";
import { getOutputGridMetrics, getSourceGridMetrics, getTileIndex } from "./tileGridSystem";

export function assignSelectionToOutputTile(
  state: ProjectState,
  selection: SourceSelection,
  destStartCol: number,
  destStartRow: number,
): number {
  const outputGrid = getOutputGridMetrics(state.project);
  const nextTiles = state.project.tiles.filter((tile) => {
    if (
      tile.destCol >= destStartCol &&
      tile.destCol < destStartCol + selection.columns &&
      tile.destRow >= destStartRow &&
      tile.destRow < destStartRow + selection.rows
    ) {
      return false;
    }

    return true;
  });

  let placementsAdded = 0;

  for (let rowOffset = 0; rowOffset < selection.rows; rowOffset += 1) {
    for (let colOffset = 0; colOffset < selection.columns; colOffset += 1) {
      const destCol = destStartCol + colOffset;
      const destRow = destStartRow + rowOffset;

      if (destCol < 0 || destCol >= outputGrid.columns || destRow < 0 || destRow >= outputGrid.rows) {
        continue;
      }

      nextTiles.push(
        createTilePlacement(
          state,
          selection,
          colOffset,
          rowOffset,
          destCol,
          destRow,
          outputGrid.columns,
        ),
      );
      placementsAdded += 1;
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
  const sourceGrid = getSourceGridMetrics(
    image.width,
    image.height,
    state.project.sourceTileWidth,
    state.project.sourceTileHeight,
  );
  const capacity = outputGrid.columns * outputGrid.rows;
  const nextTiles: TilePlacement[] = [];
  let placed = 0;

  for (let row = 0; row < sourceGrid.rows; row += 1) {
    for (let col = 0; col < sourceGrid.columns; col += 1) {
      if (placed >= capacity) {
        state.project.tiles = nextTiles;
        return placed;
      }

      const destCol = placed % outputGrid.columns;
      const destRow = Math.floor(placed / outputGrid.columns);
      nextTiles.push(
        createTilePlacementFromSourceRect(
          state,
          {
            x: col * state.project.sourceTileWidth,
            y: row * state.project.sourceTileHeight,
            w: state.project.sourceTileWidth,
            h: state.project.sourceTileHeight,
          },
          destCol,
          destRow,
          outputGrid.columns,
        ),
      );
      placed += 1;
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
  destCol: number,
  destRow: number,
  columns: number,
): TilePlacement {
  return createTilePlacementFromSourceRect(
    state,
    {
      x: selection.sourceRect.x + colOffset * state.project.sourceTileWidth,
      y: selection.sourceRect.y + rowOffset * state.project.sourceTileHeight,
      w: state.project.sourceTileWidth,
      h: state.project.sourceTileHeight,
    },
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
  const offsetX = Math.floor((state.project.tileWidth - state.project.sourceTileWidth) / 2);
  const offsetY = Math.floor((state.project.tileHeight - state.project.sourceTileHeight) / 2);

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
