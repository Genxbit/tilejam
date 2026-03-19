import type { GridCoordinate, ProjectState, SourceSelection, TilejamProject } from "../types/project";
import { getOutputGridMetrics, getSourceGridMetrics } from "./tileGridSystem";

export function createSourceSelection(
  project: TilejamProject,
  anchor: GridCoordinate,
  current: GridCoordinate,
): SourceSelection {
  const startCol = Math.min(anchor.col, current.col);
  const endCol = Math.max(anchor.col, current.col);
  const startRow = Math.min(anchor.row, current.row);
  const endRow = Math.max(anchor.row, current.row);
  const columns = endCol - startCol + 1;
  const rows = endRow - startRow + 1;

  return {
    startCol,
    startRow,
    endCol,
    endRow,
    columns,
    rows,
    sourceRect: {
      x: startCol * project.sourceTileWidth,
      y: startRow * project.sourceTileHeight,
      w: columns * project.sourceTileWidth,
      h: rows * project.sourceTileHeight,
    },
  };
}

export function updateDraftSourceSelection(
  state: ProjectState,
  anchor: GridCoordinate,
  current: GridCoordinate,
): SourceSelection {
  const selection = createSourceSelection(state.project, anchor, current);
  state.session.draftSourceSelection = selection;
  return selection;
}

export function commitDraftSourceSelection(state: ProjectState): SourceSelection | null {
  state.session.sourceSelection = state.session.draftSourceSelection;
  state.session.draftSourceSelection = null;
  return state.session.sourceSelection;
}

export function clearSelectionState(state: ProjectState): void {
  state.session.sourceSelection = null;
  state.session.draftSourceSelection = null;
  state.session.hoveredOutputTile = null;
  state.session.hoveredPanel = null;
}

export function setHoveredOutputTile(state: ProjectState, tile: GridCoordinate | null): void {
  state.session.hoveredOutputTile = tile;
}

export function getVisibleSelection(state: ProjectState): SourceSelection | null {
  return state.session.draftSourceSelection ?? state.session.sourceSelection;
}

export function moveSourceSelectionBy(state: ProjectState, deltaCol: number, deltaRow: number): SourceSelection | null {
  const image = state.sourceImageAsset.image;

  if (!image) {
    return null;
  }

  const currentSelection = getVisibleSelection(state) ?? createSourceSelection(
    state.project,
    { col: 0, row: 0 },
    { col: 0, row: 0 },
  );
  const sourceGrid = getSourceGridMetrics(
    image.width,
    image.height,
    state.project.sourceTileWidth,
    state.project.sourceTileHeight,
  );
  const maxStartCol = Math.max(0, sourceGrid.columns - currentSelection.columns);
  const maxStartRow = Math.max(0, sourceGrid.rows - currentSelection.rows);
  const nextStartCol = clamp(currentSelection.startCol + deltaCol, 0, maxStartCol);
  const nextStartRow = clamp(currentSelection.startRow + deltaRow, 0, maxStartRow);
  const nextEndCol = nextStartCol + currentSelection.columns - 1;
  const nextEndRow = nextStartRow + currentSelection.rows - 1;
  const nextSelection = createSourceSelection(
    state.project,
    { col: nextStartCol, row: nextStartRow },
    { col: nextEndCol, row: nextEndRow },
  );

  state.session.sourceSelection = nextSelection;
  state.session.draftSourceSelection = null;
  return nextSelection;
}

export function moveHoveredOutputTileBy(state: ProjectState, deltaCol: number, deltaRow: number): GridCoordinate {
  const outputGrid = getOutputGridMetrics(state.project);
  const hoveredTile = state.session.hoveredOutputTile;
  const selectedTile = state.session.selectedOutputTileId !== null
    ? state.project.tiles.find((tile) => tile.id === state.session.selectedOutputTileId) ?? null
    : null;
  const currentCol = hoveredTile?.col ?? selectedTile?.destCol ?? 0;
  const currentRow = hoveredTile?.row ?? selectedTile?.destRow ?? 0;
  const nextTile = {
    col: clamp(currentCol + deltaCol, 0, outputGrid.columns - 1),
    row: clamp(currentRow + deltaRow, 0, outputGrid.rows - 1),
  };

  state.session.hoveredOutputTile = nextTile;
  return nextTile;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
