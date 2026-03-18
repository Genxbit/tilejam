import type { ProjectState, SourceSelection, TilePlacement } from "../types/project";
import { getOutputGridMetrics, getTileIndex } from "./tileGridSystem";

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

function createTilePlacement(
  state: ProjectState,
  selection: SourceSelection,
  colOffset: number,
  rowOffset: number,
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
    sourceRect: {
      x: selection.sourceRect.x + colOffset * state.project.sourceTileWidth,
      y: selection.sourceRect.y + rowOffset * state.project.sourceTileHeight,
      w: state.project.sourceTileWidth,
      h: state.project.sourceTileHeight,
    },
    offsetX,
    offsetY,
    scaleX: 1,
    scaleY: 1,
    flipX: false,
    flipY: false,
    name: `tile_${id}`,
    tags: [],
    collision: "none",
  };
}
