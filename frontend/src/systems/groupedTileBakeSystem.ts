import type { ColorReplaceTargetMode, ProjectState, SelectionBounds, TilePlacement } from "../types/project";
import { getSourceImageForRef, loadImageAssetFromUrl } from "./sourceImageSystem";
import { getOutputGridMetrics, normalizeProjectTilesToGrid } from "./tileGridSystem";
import { renderTileCanvas } from "./tileRenderSystem";

export type RgbaColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export async function bakeSelectedTilesGroupShift(
  state: ProjectState,
  selectedTiles: TilePlacement[],
  deltaX: number,
  deltaY: number,
): Promise<number> {
  const prepared = renderSelectedTileGroup(state, selectedTiles);

  if (!prepared) {
    return 0;
  }

  const tileWidth = state.project.tileWidth;
  const tileHeight = state.project.tileHeight;
  const outputGrid = getOutputGridMetrics(state.project);
  const { bounds, canvas: groupCanvas } = prepared;
  const groupColumns = bounds.maxCol - bounds.minCol + 1;
  const groupRows = bounds.maxRow - bounds.minRow + 1;
  const expanded = drawGroupCanvasToExpandedGrid(
    groupCanvas,
    tileWidth,
    tileHeight,
    deltaX,
    deltaY,
    groupCanvas.width,
    groupCanvas.height,
  );

  if (!expanded) {
    return 0;
  }

  const affectedStartCol = bounds.minCol + expanded.cellStartOffsetCol;
  const affectedStartRow = bounds.minRow + expanded.cellStartOffsetRow;
  const affectedEndCol = bounds.maxCol + (expanded.cellEndOffsetCol - (groupColumns - 1));
  const affectedEndRow = bounds.maxRow + (expanded.cellEndOffsetRow - (groupRows - 1));
  const nextTiles = await bakeExpandedCanvasToTiles(
    state,
    expanded.canvas,
    tileWidth,
    tileHeight,
    affectedStartCol,
    affectedStartRow,
    outputGrid.columns,
    outputGrid.rows,
    "group-shift",
  );

  state.project.tiles = [
    ...state.project.tiles.filter((tile) =>
      tile.destCol < affectedStartCol
      || tile.destCol > affectedEndCol
      || tile.destRow < affectedStartRow
      || tile.destRow > affectedEndRow,
    ),
    ...nextTiles,
  ];
  normalizeProjectTilesToGrid(state);
  state.session.selectedOutputCells = nextTiles.map((tile) => ({ col: tile.destCol, row: tile.destRow }));
  state.session.selectedOutputTileIds = nextTiles.map((tile) => tile.id);
  state.session.selectedOutputTileId = state.session.selectedOutputTileIds[0] ?? null;
  return nextTiles.length;
}

export async function bakeSelectedTilesGroupFlip(
  state: ProjectState,
  selectedTiles: TilePlacement[],
  flipX: boolean,
  flipY: boolean,
): Promise<number> {
  if (!flipX && !flipY) {
    return 0;
  }

  const prepared = renderSelectedTileGroup(state, selectedTiles);

  if (!prepared) {
    return 0;
  }

  const { bounds, canvas: groupCanvas } = prepared;
  const flippedCanvas = document.createElement("canvas");
  flippedCanvas.width = groupCanvas.width;
  flippedCanvas.height = groupCanvas.height;
  const flippedContext = flippedCanvas.getContext("2d");

  if (!flippedContext) {
    return 0;
  }

  flippedContext.save();
  flippedContext.translate(flipX ? flippedCanvas.width : 0, flipY ? flippedCanvas.height : 0);
  flippedContext.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  flippedContext.drawImage(groupCanvas, 0, 0);
  flippedContext.restore();

  let flippedCount = 0;

  for (const tile of selectedTiles) {
    const tileCanvas = sliceTileCanvas(
      flippedCanvas,
      (tile.destCol - bounds.minCol) * state.project.tileWidth,
      (tile.destRow - bounds.minRow) * state.project.tileHeight,
      state.project.tileWidth,
      state.project.tileHeight,
    );

    if (!tileCanvas) {
      continue;
    }

    const ref = createRuntimeTileRef("group-flip", tile.id);
    await loadImageAssetFromUrl(state, tileCanvas.toDataURL("image/png"), ref);
    resetTileToBakedImage(tile, ref, state.project.tileWidth, state.project.tileHeight);
    flippedCount += 1;
  }

  return flippedCount;
}

export async function bakeSelectedTilesGroupScale(
  state: ProjectState,
  selectedTiles: TilePlacement[],
  scaleX: number,
  scaleY: number,
): Promise<number> {
  const prepared = renderSelectedTileGroup(state, selectedTiles);

  if (!prepared) {
    return 0;
  }

  const tileWidth = state.project.tileWidth;
  const tileHeight = state.project.tileHeight;
  const outputGrid = getOutputGridMetrics(state.project);
  const { bounds, canvas: groupCanvas } = prepared;
  const groupColumns = bounds.maxCol - bounds.minCol + 1;
  const groupRows = bounds.maxRow - bounds.minRow + 1;
  const safeScaleX = Math.max(0.1, scaleX);
  const safeScaleY = Math.max(0.1, scaleY);
  const scaledWidth = groupCanvas.width * safeScaleX;
  const scaledHeight = groupCanvas.height * safeScaleY;
  const drawX = (groupCanvas.width - scaledWidth) / 2;
  const drawY = (groupCanvas.height - scaledHeight) / 2;
  const expanded = drawGroupCanvasToExpandedGrid(
    groupCanvas,
    tileWidth,
    tileHeight,
    drawX,
    drawY,
    scaledWidth,
    scaledHeight,
  );

  if (!expanded) {
    return 0;
  }

  const affectedStartCol = bounds.minCol + expanded.cellStartOffsetCol;
  const affectedStartRow = bounds.minRow + expanded.cellStartOffsetRow;
  const affectedEndCol = bounds.maxCol + (expanded.cellEndOffsetCol - (groupColumns - 1));
  const affectedEndRow = bounds.maxRow + (expanded.cellEndOffsetRow - (groupRows - 1));
  const nextTiles = await bakeExpandedCanvasToTiles(
    state,
    expanded.canvas,
    tileWidth,
    tileHeight,
    affectedStartCol,
    affectedStartRow,
    outputGrid.columns,
    outputGrid.rows,
    "group-scale",
  );

  state.project.tiles = [
    ...state.project.tiles.filter((tile) =>
      tile.destCol < affectedStartCol
      || tile.destCol > affectedEndCol
      || tile.destRow < affectedStartRow
      || tile.destRow > affectedEndRow,
    ),
    ...nextTiles,
  ];
  normalizeProjectTilesToGrid(state);
  state.session.selectedOutputCells = nextTiles.map((tile) => ({ col: tile.destCol, row: tile.destRow }));
  state.session.selectedOutputTileIds = nextTiles.map((tile) => tile.id);
  state.session.selectedOutputTileId = state.session.selectedOutputTileIds[0] ?? null;
  return nextTiles.length;
}

export async function bakeSelectedTilesGroupStretch(
  state: ProjectState,
  selectedTiles: TilePlacement[],
  stretchLeft: number,
  stretchRight: number,
  stretchTop: number,
  stretchBottom: number,
): Promise<number> {
  const prepared = renderSelectedTileGroup(state, selectedTiles);

  if (!prepared) {
    return 0;
  }

  const tileWidth = state.project.tileWidth;
  const tileHeight = state.project.tileHeight;
  const outputGrid = getOutputGridMetrics(state.project);
  const { bounds, canvas: groupCanvas } = prepared;
  const groupColumns = bounds.maxCol - bounds.minCol + 1;
  const groupRows = bounds.maxRow - bounds.minRow + 1;
  const drawX = -stretchLeft;
  const drawY = -stretchTop;
  const drawWidth = groupCanvas.width + stretchLeft + stretchRight;
  const drawHeight = groupCanvas.height + stretchTop + stretchBottom;

  if (drawWidth <= 0 || drawHeight <= 0) {
    return 0;
  }

  const expanded = drawGroupCanvasToExpandedGrid(
    groupCanvas,
    tileWidth,
    tileHeight,
    drawX,
    drawY,
    drawWidth,
    drawHeight,
  );

  if (!expanded) {
    return 0;
  }

  const affectedStartCol = bounds.minCol + expanded.cellStartOffsetCol;
  const affectedStartRow = bounds.minRow + expanded.cellStartOffsetRow;
  const affectedEndCol = bounds.maxCol + (expanded.cellEndOffsetCol - (groupColumns - 1));
  const affectedEndRow = bounds.maxRow + (expanded.cellEndOffsetRow - (groupRows - 1));
  const nextTiles = await bakeExpandedCanvasToTiles(
    state,
    expanded.canvas,
    tileWidth,
    tileHeight,
    affectedStartCol,
    affectedStartRow,
    outputGrid.columns,
    outputGrid.rows,
    "group-stretch",
  );

  state.project.tiles = [
    ...state.project.tiles.filter((tile) =>
      tile.destCol < affectedStartCol
      || tile.destCol > affectedEndCol
      || tile.destRow < affectedStartRow
      || tile.destRow > affectedEndRow,
    ),
    ...nextTiles,
  ];
  normalizeProjectTilesToGrid(state);
  state.session.selectedOutputCells = nextTiles.map((tile) => ({ col: tile.destCol, row: tile.destRow }));
  state.session.selectedOutputTileIds = nextTiles.map((tile) => tile.id);
  state.session.selectedOutputTileId = state.session.selectedOutputTileIds[0] ?? null;
  return nextTiles.length;
}

export async function bakeSelectedTilesEdgeExtend(
  state: ProjectState,
  selectedTiles: TilePlacement[],
): Promise<number> {
  let bakedCount = 0;

  for (const tile of selectedTiles) {
    const image = getSourceImageForRef(state, tile.sourceImageRef) ?? state.sourceImageAsset.image;

    if (!image) {
      continue;
    }

    const bakedCanvas = renderTileCanvas(
      image,
      tile,
      state.project.tileWidth,
      state.project.tileHeight,
      { applyEdgeExtend: true },
    );

    if (!bakedCanvas) {
      continue;
    }

    const ref = createRuntimeTileRef("edge-extend", tile.id);
    await loadImageAssetFromUrl(state, bakedCanvas.toDataURL("image/png"), ref);
    resetTileToBakedImage(tile, ref, state.project.tileWidth, state.project.tileHeight);
    bakedCount += 1;
  }

  return bakedCount;
}

export async function bakeSelectedTilesColorReplace(
  state: ProjectState,
  selectedTiles: TilePlacement[],
  sourceColor: RgbaColor,
  targetMode: ColorReplaceTargetMode,
  targetColor: RgbaColor | null,
  tolerance: number,
): Promise<number> {
  let appliedCount = 0;

  for (const tile of selectedTiles) {
    const image = getSourceImageForRef(state, tile.sourceImageRef) ?? state.sourceImageAsset.image;

    if (!image) {
      continue;
    }

    const tileCanvas = renderTileCanvas(image, tile, state.project.tileWidth, state.project.tileHeight);

    if (!tileCanvas) {
      continue;
    }

    const canvas = document.createElement("canvas");
    canvas.width = tileCanvas.width;
    canvas.height = tileCanvas.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      continue;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(tileCanvas, 0, 0);

    const changed = applyColorReplaceToCanvas(context, canvas.width, canvas.height, sourceColor, targetMode, targetColor, tolerance);

    if (!changed) {
      continue;
    }

    const ref = createRuntimeTileRef("color-replace", tile.id);
    await loadImageAssetFromUrl(state, canvas.toDataURL("image/png"), ref);
    resetTileToBakedImage(tile, ref, state.project.tileWidth, state.project.tileHeight);
    appliedCount += 1;
  }

  return appliedCount;
}

export async function fillSelectedOutputCells(
  state: ProjectState,
  selectedCells: ProjectState["session"]["selectedOutputCells"],
  fillColor: string,
): Promise<number> {
  if (selectedCells.length < 1) {
    return 0;
  }

  const tileWidth = state.project.tileWidth;
  const tileHeight = state.project.tileHeight;
  const fillCanvas = document.createElement("canvas");
  fillCanvas.width = tileWidth;
  fillCanvas.height = tileHeight;
  const fillContext = fillCanvas.getContext("2d");

  if (!fillContext) {
    return 0;
  }

  fillContext.clearRect(0, 0, tileWidth, tileHeight);
  fillContext.fillStyle = fillColor;
  fillContext.fillRect(0, 0, tileWidth, tileHeight);

  const ref = createRuntimeTileRef("fill-tile");
  await loadImageAssetFromUrl(state, fillCanvas.toDataURL("image/png"), ref);

  const selectedKeys = new Set(selectedCells.map((cell) => `${cell.col}:${cell.row}`));
  const remainingTiles = state.project.tiles.filter((tile) => !selectedKeys.has(`${tile.destCol}:${tile.destRow}`));
  const nextTiles = selectedCells.map((cell) => {
    const tile = createBakedOutputTile(cell.col, cell.row, tileWidth, tileHeight);
    resetTileToBakedImage(tile, ref, tileWidth, tileHeight);
    return tile;
  });

  state.project.tiles = [...remainingTiles, ...nextTiles];
  normalizeProjectTilesToGrid(state);
  state.session.selectedOutputCells = selectedCells.map((cell) => ({ ...cell }));
  state.session.selectedOutputTileIds = state.project.tiles
    .filter((tile) => selectedKeys.has(`${tile.destCol}:${tile.destRow}`))
    .map((tile) => tile.id);
  state.session.selectedOutputTileId = state.project.tiles.find((tile) =>
    selectedKeys.has(`${tile.destCol}:${tile.destRow}`),
  )?.id ?? null;
  return nextTiles.length;
}

export function parseHexColor(value: string): RgbaColor | null {
  const normalized = value.trim().replace(/^#/, "");

  if (![3, 4, 6, 8].includes(normalized.length) || !/^[\da-fA-F]+$/.test(normalized)) {
    return null;
  }

  const expanded = normalized.length <= 4
    ? normalized.split("").map((character) => `${character}${character}`).join("")
    : normalized;
  const r = Number.parseInt(expanded.slice(0, 2), 16);
  const g = Number.parseInt(expanded.slice(2, 4), 16);
  const b = Number.parseInt(expanded.slice(4, 6), 16);
  const a = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) : 255;

  return { r, g, b, a };
}

export function normalizeHexColor(value: string, fallback: string): string {
  const parsed = parseHexColor(value);

  if (!parsed) {
    return fallback;
  }

  const toHex = (channel: number) => channel.toString(16).padStart(2, "0");
  return `#${toHex(parsed.r)}${toHex(parsed.g)}${toHex(parsed.b)}`;
}

export function renderSelectedTileGroup(
  state: ProjectState,
  selectedTiles: TilePlacement[],
): { bounds: SelectionBounds; canvas: HTMLCanvasElement } | null {
  if (selectedTiles.length < 1) {
    return null;
  }

  const bounds = getSelectedOutputCellBounds(state) ?? {
    minCol: Math.min(...selectedTiles.map((tile) => tile.destCol)),
    maxCol: Math.max(...selectedTiles.map((tile) => tile.destCol)),
    minRow: Math.min(...selectedTiles.map((tile) => tile.destRow)),
    maxRow: Math.max(...selectedTiles.map((tile) => tile.destRow)),
  };
  const columns = bounds.maxCol - bounds.minCol + 1;
  const rows = bounds.maxRow - bounds.minRow + 1;
  const groupCanvas = document.createElement("canvas");
  groupCanvas.width = columns * state.project.tileWidth;
  groupCanvas.height = rows * state.project.tileHeight;
  const groupContext = groupCanvas.getContext("2d");

  if (!groupContext) {
    return null;
  }

  groupContext.clearRect(0, 0, groupCanvas.width, groupCanvas.height);
  groupContext.imageSmoothingEnabled = false;

  for (const tile of selectedTiles) {
    const image = getSourceImageForRef(state, tile.sourceImageRef) ?? state.sourceImageAsset.image;

    if (!image) {
      continue;
    }

    const renderedTile = renderTileCanvas(image, tile, state.project.tileWidth, state.project.tileHeight);

    if (!renderedTile) {
      continue;
    }

    groupContext.drawImage(
      renderedTile,
      (tile.destCol - bounds.minCol) * state.project.tileWidth,
      (tile.destRow - bounds.minRow) * state.project.tileHeight,
    );
  }

  return { bounds, canvas: groupCanvas };
}

function sliceTileCanvas(
  sourceCanvas: HTMLCanvasElement,
  sourceX: number,
  sourceY: number,
  tileWidth: number,
  tileHeight: number,
): HTMLCanvasElement | null {
  const tileCanvas = document.createElement("canvas");
  tileCanvas.width = tileWidth;
  tileCanvas.height = tileHeight;
  const tileContext = tileCanvas.getContext("2d");

  if (!tileContext) {
    return null;
  }

  tileContext.clearRect(0, 0, tileWidth, tileHeight);
  tileContext.drawImage(sourceCanvas, sourceX, sourceY, tileWidth, tileHeight, 0, 0, tileWidth, tileHeight);
  return tileCanvas;
}

function drawGroupCanvasToExpandedGrid(
  groupCanvas: HTMLCanvasElement,
  tileWidth: number,
  tileHeight: number,
  drawX: number,
  drawY: number,
  drawWidth: number,
  drawHeight: number,
  flipX = false,
  flipY = false,
): {
  canvas: HTMLCanvasElement;
  cellStartOffsetCol: number;
  cellStartOffsetRow: number;
  cellEndOffsetCol: number;
  cellEndOffsetRow: number;
} | null {
  const localMinX = Math.floor(Math.min(0, drawX));
  const localMinY = Math.floor(Math.min(0, drawY));
  const localMaxX = Math.ceil(Math.max(groupCanvas.width, drawX + drawWidth));
  const localMaxY = Math.ceil(Math.max(groupCanvas.height, drawY + drawHeight));
  const cellStartOffsetCol = Math.floor(localMinX / tileWidth);
  const cellStartOffsetRow = Math.floor(localMinY / tileHeight);
  const cellEndOffsetCol = Math.ceil(localMaxX / tileWidth) - 1;
  const cellEndOffsetRow = Math.ceil(localMaxY / tileHeight) - 1;
  const expandedColumns = cellEndOffsetCol - cellStartOffsetCol + 1;
  const expandedRows = cellEndOffsetRow - cellStartOffsetRow + 1;
  const expandedCanvas = document.createElement("canvas");
  expandedCanvas.width = expandedColumns * tileWidth;
  expandedCanvas.height = expandedRows * tileHeight;
  const expandedContext = expandedCanvas.getContext("2d");

  if (!expandedContext) {
    return null;
  }

  expandedContext.clearRect(0, 0, expandedCanvas.width, expandedCanvas.height);
  expandedContext.imageSmoothingEnabled = false;
  expandedContext.save();
  expandedContext.translate(
    -cellStartOffsetCol * tileWidth + drawX + drawWidth / 2,
    -cellStartOffsetRow * tileHeight + drawY + drawHeight / 2,
  );
  expandedContext.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  expandedContext.drawImage(
    groupCanvas,
    -drawWidth / 2,
    -drawHeight / 2,
    drawWidth,
    drawHeight,
  );
  expandedContext.restore();

  return {
    canvas: expandedCanvas,
    cellStartOffsetCol,
    cellStartOffsetRow,
    cellEndOffsetCol,
    cellEndOffsetRow,
  };
}

async function bakeExpandedCanvasToTiles(
  state: ProjectState,
  expandedCanvas: HTMLCanvasElement,
  tileWidth: number,
  tileHeight: number,
  startCol: number,
  startRow: number,
  maxColumns: number,
  maxRows: number,
  refPrefix: string,
): Promise<TilePlacement[]> {
  const nextTiles: TilePlacement[] = [];
  const expandedColumns = Math.floor(expandedCanvas.width / tileWidth);
  const expandedRows = Math.floor(expandedCanvas.height / tileHeight);

  for (let rowOffset = 0; rowOffset < expandedRows; rowOffset += 1) {
    for (let colOffset = 0; colOffset < expandedColumns; colOffset += 1) {
      const destCol = startCol + colOffset;
      const destRow = startRow + rowOffset;

      if (destCol < 0 || destCol >= maxColumns || destRow < 0 || destRow >= maxRows) {
        continue;
      }

      const tileCanvas = document.createElement("canvas");
      tileCanvas.width = tileWidth;
      tileCanvas.height = tileHeight;
      const tileContext = tileCanvas.getContext("2d", { willReadFrequently: true });

      if (!tileContext) {
        continue;
      }

      tileContext.clearRect(0, 0, tileWidth, tileHeight);
      tileContext.imageSmoothingEnabled = false;
      tileContext.drawImage(
        expandedCanvas,
        colOffset * tileWidth,
        rowOffset * tileHeight,
        tileWidth,
        tileHeight,
        0,
        0,
        tileWidth,
        tileHeight,
      );

      if (!canvasHasVisiblePixels(tileContext, tileWidth, tileHeight)) {
        continue;
      }

      const tile = createBakedOutputTile(destCol, destRow, tileWidth, tileHeight);
      const ref = createRuntimeTileRef(refPrefix, `${destCol}:${destRow}`);
      await loadImageAssetFromUrl(state, tileCanvas.toDataURL("image/png"), ref);
      resetTileToBakedImage(tile, ref, tileWidth, tileHeight);
      nextTiles.push(tile);
    }
  }

  return nextTiles;
}

export async function bakeGroupCanvasTransform(
  state: ProjectState,
  bounds: SelectionBounds,
  groupCanvas: HTMLCanvasElement,
  offsetX: number,
  offsetY: number,
  scaleX: number,
  scaleY: number,
  flipX: boolean,
  flipY: boolean,
  refPrefix: string,
): Promise<TilePlacement[]> {
  const tileWidth = state.project.tileWidth;
  const tileHeight = state.project.tileHeight;
  const outputGrid = getOutputGridMetrics(state.project);
  const groupColumns = bounds.maxCol - bounds.minCol + 1;
  const groupRows = bounds.maxRow - bounds.minRow + 1;
  const safeScaleX = Math.max(0.1, scaleX);
  const safeScaleY = Math.max(0.1, scaleY);
  const scaledWidth = groupCanvas.width * safeScaleX;
  const scaledHeight = groupCanvas.height * safeScaleY;
  const drawX = offsetX + (groupCanvas.width - scaledWidth) / 2;
  const drawY = offsetY + (groupCanvas.height - scaledHeight) / 2;
  const selectionStartCol = bounds.minCol + Math.floor(drawX / tileWidth);
  const selectionStartRow = bounds.minRow + Math.floor(drawY / tileHeight);
  const selectionEndCol = bounds.minCol + Math.ceil((drawX + scaledWidth) / tileWidth) - 1;
  const selectionEndRow = bounds.minRow + Math.ceil((drawY + scaledHeight) / tileHeight) - 1;
  const expanded = drawGroupCanvasToExpandedGrid(
    groupCanvas,
    tileWidth,
    tileHeight,
    drawX,
    drawY,
    scaledWidth,
    scaledHeight,
    flipX,
    flipY,
  );

  if (!expanded) {
    return [];
  }

  const affectedStartCol = bounds.minCol + expanded.cellStartOffsetCol;
  const affectedStartRow = bounds.minRow + expanded.cellStartOffsetRow;
  const affectedEndCol = bounds.maxCol + (expanded.cellEndOffsetCol - (groupColumns - 1));
  const affectedEndRow = bounds.maxRow + (expanded.cellEndOffsetRow - (groupRows - 1));
  const compositedCanvas = document.createElement("canvas");
  compositedCanvas.width = expanded.canvas.width;
  compositedCanvas.height = expanded.canvas.height;
  const compositedContext = compositedCanvas.getContext("2d");

  if (!compositedContext) {
    return [];
  }

  compositedContext.clearRect(0, 0, compositedCanvas.width, compositedCanvas.height);
  compositedContext.imageSmoothingEnabled = false;

  const selectedIds = new Set(state.session.selectedOutputTileIds);

  for (const tile of state.project.tiles) {
    if (selectedIds.has(tile.id)) {
      continue;
    }

    if (
      tile.destCol < affectedStartCol
      || tile.destCol > affectedEndCol
      || tile.destRow < affectedStartRow
      || tile.destRow > affectedEndRow
    ) {
      continue;
    }

    const image = getSourceImageForRef(state, tile.sourceImageRef) ?? state.sourceImageAsset.image;

    if (!image) {
      continue;
    }

    const renderedTile = renderTileCanvas(image, tile, tileWidth, tileHeight);

    if (!renderedTile) {
      continue;
    }

    compositedContext.drawImage(
      renderedTile,
      (tile.destCol - affectedStartCol) * tileWidth,
      (tile.destRow - affectedStartRow) * tileHeight,
    );
  }

  compositedContext.drawImage(expanded.canvas, 0, 0);
  const nextTiles = await bakeExpandedCanvasToTiles(
    state,
    compositedCanvas,
    tileWidth,
    tileHeight,
    affectedStartCol,
    affectedStartRow,
    outputGrid.columns,
    outputGrid.rows,
    refPrefix,
  );

  state.project.tiles = [
    ...state.project.tiles.filter((tile) =>
      tile.destCol < affectedStartCol
      || tile.destCol > affectedEndCol
      || tile.destRow < affectedStartRow
      || tile.destRow > affectedEndRow,
    ),
    ...nextTiles,
  ];
  normalizeProjectTilesToGrid(state);
  state.session.selectedOutputCells = createRectangularSelectionFromBounds(
    clampSelectionBounds(selectionStartCol, selectionEndCol, selectionStartRow, selectionEndRow, outputGrid.columns, outputGrid.rows),
  );
  const selectedCellKeys = new Set(state.session.selectedOutputCells.map((cell) => `${cell.col}:${cell.row}`));
  state.session.selectedOutputTileIds = state.project.tiles
    .filter((tile) => selectedCellKeys.has(`${tile.destCol}:${tile.destRow}`))
    .map((tile) => tile.id);
  state.session.selectedOutputTileId = state.session.selectedOutputTileIds[0] ?? null;
  return nextTiles;
}

export function resetTileToBakedImage(tile: TilePlacement, ref: string, tileWidth: number, tileHeight: number): void {
  tile.sourceImageRef = ref;
  tile.sourceRect = {
    x: 0,
    y: 0,
    w: tileWidth,
    h: tileHeight,
  };
  tile.offsetX = 0;
  tile.offsetY = 0;
  tile.scaleX = 1;
  tile.scaleY = 1;
  tile.fitMode = "manual";
  tile.anchorX = "center";
  tile.anchorY = "center";
  tile.cropLeft = 0;
  tile.cropRight = 0;
  tile.cropTop = 0;
  tile.cropBottom = 0;
  tile.clampToTile = true;
  tile.edgeStretchLeft = 0;
  tile.edgeStretchRight = 0;
  tile.edgeStretchTop = 0;
  tile.edgeStretchBottom = 0;
  tile.edgeExtend = false;
  tile.fillExposedColor = null;
  tile.flipX = false;
  tile.flipY = false;
  tile.rotationQuarterTurns = 0;
  tile.brightness = 0;
  tile.contrast = 1;
  tile.saturation = 1;
  tile.tintColor = null;
  tile.filterMode = "nearest";
  tile.pixelSnap = true;
}

function createBakedOutputTile(destCol: number, destRow: number, tileWidth: number, tileHeight: number): TilePlacement {
  return {
    id: 0,
    destCol,
    destRow,
    sourceImageRef: null,
    sourceRect: {
      x: 0,
      y: 0,
      w: tileWidth,
      h: tileHeight,
    },
    offsetX: 0,
    offsetY: 0,
    scaleX: 1,
    scaleY: 1,
    fitMode: "manual",
    anchorX: "center",
    anchorY: "center",
    cropLeft: 0,
    cropRight: 0,
    cropTop: 0,
    cropBottom: 0,
    clampToTile: true,
    edgeStretchLeft: 0,
    edgeStretchRight: 0,
    edgeStretchTop: 0,
    edgeStretchBottom: 0,
    edgeExtend: false,
    fillExposedColor: null,
    flipX: false,
    flipY: false,
    rotationQuarterTurns: 0,
    brightness: 0,
    contrast: 1,
    saturation: 1,
    tintColor: null,
    filterMode: "nearest",
    pixelSnap: true,
    name: `tile_${destCol}_${destRow}`,
    tags: [],
    collision: "none",
  };
}

export function getSelectedOutputCellBounds(state: ProjectState): SelectionBounds | null {
  const cells = state.session.selectedOutputCells;

  if (cells.length < 1) {
    return null;
  }

  return {
    minCol: Math.min(...cells.map((cell) => cell.col)),
    maxCol: Math.max(...cells.map((cell) => cell.col)),
    minRow: Math.min(...cells.map((cell) => cell.row)),
    maxRow: Math.max(...cells.map((cell) => cell.row)),
  };
}

function createRectangularSelectionFromBounds(bounds: SelectionBounds | null): ProjectState["session"]["selectedOutputCells"] {
  if (!bounds) {
    return [];
  }
  const cells = [];

  for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
    for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) {
      cells.push({ col, row });
    }
  }

  return cells;
}

function clampSelectionBounds(
  minCol: number,
  maxCol: number,
  minRow: number,
  maxRow: number,
  gridColumns: number,
  gridRows: number,
): SelectionBounds | null {
  const clampedMinCol = Math.max(0, minCol);
  const clampedMaxCol = Math.min(gridColumns - 1, maxCol);
  const clampedMinRow = Math.max(0, minRow);
  const clampedMaxRow = Math.min(gridRows - 1, maxRow);

  if (clampedMinCol > clampedMaxCol || clampedMinRow > clampedMaxRow) {
    return null;
  }

  return {
    minCol: clampedMinCol,
    maxCol: clampedMaxCol,
    minRow: clampedMinRow,
    maxRow: clampedMaxRow,
  };
}

function canvasHasVisiblePixels(context: CanvasRenderingContext2D, width: number, height: number): boolean {
  const imageData = context.getImageData(0, 0, width, height).data;

  for (let index = 3; index < imageData.length; index += 4) {
    if (imageData[index] > 0) {
      return true;
    }
  }

  return false;
}

function applyColorReplaceToCanvas(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  sourceColor: RgbaColor,
  targetMode: ColorReplaceTargetMode,
  targetColor: RgbaColor | null,
  tolerance: number,
): boolean {
  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;
  let changed = false;

  for (let index = 0; index < data.length; index += 4) {
    const current = {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
      a: data[index + 3],
    };

    if (getColorDistance(current, sourceColor) > tolerance) {
      continue;
    }

    if (targetMode === "transparent") {
      data[index + 3] = 0;
    } else if (targetColor) {
      data[index] = targetColor.r;
      data[index + 1] = targetColor.g;
      data[index + 2] = targetColor.b;
      data[index + 3] = targetColor.a;
    }

    changed = true;
  }

  if (changed) {
    context.putImageData(imageData, 0, 0);
  }

  return changed;
}

function getColorDistance(left: RgbaColor, right: RgbaColor): number {
  const deltaR = left.r - right.r;
  const deltaG = left.g - right.g;
  const deltaB = left.b - right.b;
  const deltaA = left.a - right.a;
  return Math.sqrt((deltaR ** 2) + (deltaG ** 2) + (deltaB ** 2) + (deltaA ** 2));
}

function createRuntimeTileRef(prefix: string, suffix?: string | number): string {
  const tail = suffix === undefined ? "" : `:${suffix}`;
  return `runtime:${prefix}:${Date.now()}${tail}:${Math.random().toString(36).slice(2, 8)}`;
}
