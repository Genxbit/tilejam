import type { GridCoordinate, ProjectState, SourceSelection, TilejamProject } from "../types/project";

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
