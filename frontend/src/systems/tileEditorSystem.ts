import type { ProjectState, TilePlacement } from "../types/project";
import { getOutputGridMetrics, normalizeProjectTilesToGrid } from "./tileGridSystem";
import { applyAnchor, applyFitMode, getTileDrawRect, getTileSampleRect } from "./tileRenderSystem";

type EditableTileFields = Pick<
  TilePlacement,
  | "destCol"
  | "destRow"
  | "offsetX"
  | "offsetY"
  | "scaleX"
  | "scaleY"
  | "fitMode"
  | "anchorX"
  | "anchorY"
  | "cropLeft"
  | "cropRight"
  | "cropTop"
  | "cropBottom"
  | "clampToTile"
  | "edgeStretchLeft"
  | "edgeStretchRight"
  | "edgeStretchTop"
  | "edgeStretchBottom"
  | "edgeExtend"
  | "fillExposedColor"
  | "flipX"
  | "flipY"
  | "rotationQuarterTurns"
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
  state.session.selectedOutputTileIds = tile ? [tile.id] : [];
  return tile;
}

export function toggleOutputTileSelectionAtCell(state: ProjectState, col: number, row: number): TilePlacement | null {
  const tile = state.project.tiles.find((entry) => entry.destCol === col && entry.destRow === row) ?? null;

  if (!tile) {
    return null;
  }

  if (state.session.selectedOutputTileIds.includes(tile.id)) {
    state.session.selectedOutputTileIds = state.session.selectedOutputTileIds.filter((id) => id !== tile.id);
    state.session.selectedOutputTileId = state.session.selectedOutputTileIds[0] ?? null;
    return null;
  }

  state.session.selectedOutputTileIds = [...state.session.selectedOutputTileIds, tile.id];
  state.session.selectedOutputTileId = tile.id;
  return tile;
}

export function clearSelectedOutputTile(state: ProjectState): void {
  state.session.selectedOutputTileId = null;
  state.session.selectedOutputTileIds = [];
}

export function getSelectedOutputTile(state: ProjectState): TilePlacement | null {
  const primaryId = state.session.selectedOutputTileId ?? state.session.selectedOutputTileIds[0] ?? null;
  return primaryId === null ? null : state.project.tiles.find((tile) => tile.id === primaryId) ?? null;
}

export function getSelectedOutputTiles(state: ProjectState): TilePlacement[] {
  const selectedIds = new Set(
    state.session.selectedOutputTileIds.length > 0
      ? state.session.selectedOutputTileIds
      : state.session.selectedOutputTileId !== null
        ? [state.session.selectedOutputTileId]
        : [],
  );

  return state.project.tiles.filter((tile) => selectedIds.has(tile.id));
}

export function updateSelectedOutputTile(state: ProjectState, patch: Partial<EditableTileFields>): TilePlacement | null {
  const tile = getSelectedOutputTile(state);
  const selectedTiles = getSelectedOutputTiles(state);

  if (!tile || selectedTiles.length < 1) {
    return null;
  }

  if (selectedTiles.length === 1) {
    const nextDestCol = patch.destCol ?? tile.destCol;
    const nextDestRow = patch.destRow ?? tile.destRow;

    if (nextDestCol !== tile.destCol || nextDestRow !== tile.destRow) {
      moveTileToCell(state, tile.id, nextDestCol, nextDestRow);
    }

    const nextTile = getSelectedOutputTile(state);

    if (!nextTile) {
      return null;
    }
  }

  const sanitizedPatch = { ...patch };

  if (selectedTiles.length > 1) {
    delete sanitizedPatch.destCol;
    delete sanitizedPatch.destRow;
    delete sanitizedPatch.name;
  }

  for (const selectedTile of getSelectedOutputTiles(state)) {
    Object.assign(selectedTile, sanitizedPatch);
  }

  reindexTiles(state);
  return getSelectedOutputTile(state);
}

export function moveSelectedOutputTileBy(state: ProjectState, deltaCol: number, deltaRow: number): TilePlacement | null {
  const tile = getSelectedOutputTile(state);
  const selectedTiles = getSelectedOutputTiles(state);

  if (!tile || selectedTiles.length < 1) {
    return null;
  }

  if (selectedTiles.length > 1) {
    const outputGrid = getOutputGridMetrics(state.project);
    const destinations = selectedTiles.map((selectedTile) => ({
      tile: selectedTile,
      destCol: selectedTile.destCol + deltaCol,
      destRow: selectedTile.destRow + deltaRow,
    }));

    if (destinations.some(({ destCol, destRow }) =>
      destCol < 0 || destCol >= outputGrid.columns || destRow < 0 || destRow >= outputGrid.rows,
    )) {
      return null;
    }

    const selectedIds = new Set(selectedTiles.map((selectedTile) => selectedTile.id));
    state.project.tiles = state.project.tiles.filter((entry) => {
      if (selectedIds.has(entry.id)) {
        return true;
      }

      return !destinations.some(({ destCol, destRow }) => entry.destCol === destCol && entry.destRow === destRow);
    });

    for (const destination of destinations) {
      destination.tile.destCol = destination.destCol;
      destination.tile.destRow = destination.destRow;
    }

    reindexTiles(state);
    return getSelectedOutputTile(state);
  }

  return moveTileToCell(state, tile.id, tile.destCol + deltaCol, tile.destRow + deltaRow);
}

export function nudgeSelectedOutputTile(state: ProjectState, deltaX: number, deltaY: number): TilePlacement | null {
  const tile = getSelectedOutputTile(state);
  const selectedTiles = getSelectedOutputTiles(state);

  if (!tile || selectedTiles.length < 1) {
    return null;
  }

  for (const selectedTile of selectedTiles) {
    selectedTile.offsetX += deltaX;
    selectedTile.offsetY += deltaY;
  }

  return tile;
}

export function setSelectedOutputTileFitMode(state: ProjectState, fitMode: TilePlacement["fitMode"]): TilePlacement | null {
  const tile = getSelectedOutputTile(state);
  const selectedTiles = getSelectedOutputTiles(state);

  if (!tile || selectedTiles.length < 1) {
    return null;
  }

  for (const selectedTile of selectedTiles) {
    applyFitMode(selectedTile, fitMode);
  }

  return tile;
}

export function alignSelectedOutputTile(
  state: ProjectState,
  anchorX: TilePlacement["anchorX"],
  anchorY: TilePlacement["anchorY"],
): TilePlacement | null {
  const tile = getSelectedOutputTile(state);
  const selectedTiles = getSelectedOutputTiles(state);

  if (!tile || selectedTiles.length < 1) {
    return null;
  }

  for (const selectedTile of selectedTiles) {
    applyAnchor(selectedTile, anchorX, anchorY);
  }

  return tile;
}

export function rotateSelectedOutputTileByQuarterTurns(state: ProjectState, delta: 1 | -1): TilePlacement | null {
  const tile = getSelectedOutputTile(state);
  const selectedTiles = getSelectedOutputTiles(state);

  if (!tile || selectedTiles.length < 1) {
    return null;
  }

  for (const selectedTile of selectedTiles) {
    selectedTile.rotationQuarterTurns = (((selectedTile.rotationQuarterTurns + delta) % 4) + 4) % 4 as 0 | 1 | 2 | 3;
  }

  return tile;
}

export function snapSelectedOutputTileToEdges(state: ProjectState): TilePlacement | null {
  const tile = getSelectedOutputTile(state);
  const selectedTiles = getSelectedOutputTiles(state);

  if (!tile || selectedTiles.length < 1) {
    return null;
  }

  for (const selectedTile of selectedTiles) {
    const drawRect = getTileDrawRect(selectedTile, state.project.tileWidth, state.project.tileHeight);

    if (!drawRect) {
      continue;
    }

    const rightGap = state.project.tileWidth - (drawRect.x + drawRect.width);
    const bottomGap = state.project.tileHeight - (drawRect.y + drawRect.height);
    selectedTile.offsetX += Math.abs(drawRect.x) <= Math.abs(rightGap) ? -drawRect.x : rightGap;
    selectedTile.offsetY += Math.abs(drawRect.y) <= Math.abs(bottomGap) ? -drawRect.y : bottomGap;
  }

  return tile;
}

export function trimSelectedOutputTileTransparentBounds(state: ProjectState, image: HTMLImageElement): TilePlacement | null {
  const tile = getSelectedOutputTile(state);
  const selectedTiles = getSelectedOutputTiles(state);

  if (!tile || selectedTiles.length < 1) {
    return null;
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return tile;
  }

  for (const selectedTile of selectedTiles) {
    const sampleRect = getTileSampleRect(selectedTile);

    if (!sampleRect) {
      continue;
    }

    canvas.width = sampleRect.w;
    canvas.height = sampleRect.h;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      image,
      sampleRect.x,
      sampleRect.y,
      sampleRect.w,
      sampleRect.h,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = data[(x + y * width) * 4 + 3];

        if (alpha > 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      continue;
    }

    selectedTile.cropLeft += minX;
    selectedTile.cropTop += minY;
    selectedTile.cropRight += width - maxX - 1;
    selectedTile.cropBottom += height - maxY - 1;
  }

  return tile;
}

export function deleteSelectedOutputTile(state: ProjectState): TilePlacement | null {
  const tile = getSelectedOutputTile(state);
  const selectedTiles = getSelectedOutputTiles(state);

  if (!tile || selectedTiles.length < 1) {
    return null;
  }

  const selectedIds = new Set(selectedTiles.map((selectedTile) => selectedTile.id));
  state.project.tiles = state.project.tiles.filter((entry) => !selectedIds.has(entry.id));
  state.session.selectedOutputTileId = null;
  state.session.selectedOutputTileIds = [];
  reindexTiles(state);

  return tile;
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
  state.session.selectedOutputTileIds = [nextTile.id];

  return nextTile;
}

function reindexTiles(state: ProjectState): void {
  normalizeProjectTilesToGrid(state);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
