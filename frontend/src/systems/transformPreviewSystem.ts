import type { ProjectState } from "../types/project";
import { renderSelectedTileGroup } from "./groupedTileBakeSystem";
import { getSelectedOutputTile, getSelectedOutputTiles } from "./tileEditorSystem";

export function syncTransformPreviewState(state: ProjectState): void {
  syncTileLayoutPreviewState(state);
  const preview = state.session.groupTransformPreview;

  if (!preview) {
    return;
  }

  const selectedTiles = getSelectedOutputTiles(state);
  const selectionSignature = getSelectedTileGroupSignature(state);
  const canPreview = state.session.tileMultiEditMode === "group" && selectedTiles.length > 0;

  if (!canPreview || selectionSignature !== preview.selectionSignature || preview.renderRevision !== state.session.renderRevision) {
    clearGroupTransformPreview(state);
  }
}

export function ensureGroupTransformPreview(state: ProjectState): ProjectState["session"]["groupTransformPreview"] {
  syncTransformPreviewState(state);

  if (state.session.groupTransformPreview) {
    return state.session.groupTransformPreview;
  }

  const selectedTiles = getSelectedOutputTiles(state);

  if (state.session.tileMultiEditMode !== "group" || selectedTiles.length < 1) {
    return null;
  }

  const prepared = renderSelectedTileGroup(state, selectedTiles);

  if (!prepared) {
    return null;
  }

  state.session.groupTransformPreview = {
    selectionSignature: getSelectedTileGroupSignature(state),
    renderRevision: state.session.renderRevision,
    bounds: prepared.bounds,
    canvas: prepared.canvas,
    offsetX: state.session.groupOffsetX,
    offsetY: state.session.groupOffsetY,
    scaleX: state.session.groupScaleX,
    scaleY: state.session.groupScaleY,
    flipX: false,
    flipY: false,
  };

  return state.session.groupTransformPreview;
}

export function clearGroupTransformPreview(state: ProjectState): void {
  state.session.groupTransformPreview = null;
  state.session.groupOffsetX = 0;
  state.session.groupOffsetY = 0;
  state.session.groupScaleX = 1;
  state.session.groupScaleY = 1;
}

export function ensureTileLayoutPreview(state: ProjectState): ProjectState["session"]["tileLayoutPreview"] {
  syncTileLayoutPreviewState(state);

  if (state.session.tileLayoutPreview) {
    return state.session.tileLayoutPreview;
  }

  const selectedTile = getSelectedOutputTile(state);
  const selectedTiles = getSelectedOutputTiles(state);

  if (!selectedTile || selectedTiles.length < 1 || (selectedTiles.length > 0 && state.session.tileMultiEditMode === "group")) {
    return null;
  }

  state.session.tileLayoutPreview = {
    selectionSignature: getSelectedTileGroupSignature(state),
    renderRevision: state.session.renderRevision,
    primaryTileId: selectedTile.id,
    patch: {},
  };

  return state.session.tileLayoutPreview;
}

export function clearTileLayoutPreview(state: ProjectState): void {
  state.session.tileLayoutPreview = null;
}

export function ensureDragMovePreview(state: ProjectState): ProjectState["session"]["dragMovePreview"] {
  if (state.session.dragMovePreview) {
    return state.session.dragMovePreview;
  }

  const selectedTiles = getSelectedOutputTiles(state);
  const prepared = selectedTiles.length > 0 ? renderSelectedTileGroup(state, selectedTiles) : null;

  if (!prepared) {
    return null;
  }

  state.session.dragMovePreview = {
    selectionSignature: getSelectedTileGroupSignature(state),
    renderRevision: state.session.renderRevision,
    bounds: prepared.bounds,
    canvas: prepared.canvas,
    offsetX: 0,
    offsetY: 0,
    scaleX: 1,
    scaleY: 1,
    flipX: false,
    flipY: false,
  };

  return state.session.dragMovePreview;
}

export function clearDragMovePreview(state: ProjectState): void {
  state.session.dragMovePreview = null;
}

export function getSelectedTileGroupSignature(state: ProjectState): string {
  const selectedTiles = getSelectedOutputTiles(state)
    .map((tile) => tile.id)
    .sort((left, right) => left - right)
    .join(",");
  const selectedCells = state.session.selectedOutputCells
    .map((cell) => `${cell.col}:${cell.row}`)
    .sort()
    .join("|");

  return `${selectedTiles}::${selectedCells}`;
}

export function getSelectedOutputBounds(state: ProjectState): { minCol: number; minRow: number; maxCol: number; maxRow: number } | null {
  const selectedTiles = getSelectedOutputTiles(state);

  if (selectedTiles.length > 0) {
    return {
      minCol: Math.min(...selectedTiles.map((tile) => tile.destCol)),
      minRow: Math.min(...selectedTiles.map((tile) => tile.destRow)),
      maxCol: Math.max(...selectedTiles.map((tile) => tile.destCol)),
      maxRow: Math.max(...selectedTiles.map((tile) => tile.destRow)),
    };
  }

  const selectedCells = state.session.selectedOutputCells;

  if (selectedCells.length < 1) {
    return null;
  }

  return {
    minCol: Math.min(...selectedCells.map((cell) => cell.col)),
    minRow: Math.min(...selectedCells.map((cell) => cell.row)),
    maxCol: Math.max(...selectedCells.map((cell) => cell.col)),
    maxRow: Math.max(...selectedCells.map((cell) => cell.row)),
  };
}

function syncTileLayoutPreviewState(state: ProjectState): void {
  const preview = state.session.tileLayoutPreview;

  if (!preview) {
    return;
  }

  const selectionSignature = getSelectedTileGroupSignature(state);
  const selectedTile = getSelectedOutputTile(state);

  if (
    selectionSignature !== preview.selectionSignature
    || preview.renderRevision !== state.session.renderRevision
    || preview.primaryTileId !== (selectedTile?.id ?? null)
  ) {
    clearTileLayoutPreview(state);
  }
}
