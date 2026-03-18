import type { ProjectState } from "../types/project";
import { getSelectedOutputTile } from "../systems/tileEditorSystem";
import { getVisibleSelection } from "../systems/selectionSystem";
import { getSourceImageForRef } from "../systems/sourceImageSystem";
import { getOutputGridMetrics, getProjectPixelSize, getSourceGridMetrics } from "../systems/tileGridSystem";
import { getWorkspaceLayout, type OutputViewport, type SourceViewport } from "../systems/workspaceSystem";

const BACKGROUND = "#12202f";
const BORDER = "#3e6d89";
const LABEL = "#c6d7e5";
const EMPTY_PANEL = "#1a3042";
const GRID = "rgba(237, 244, 250, 0.22)";
const GRID_STRONG = "rgba(125, 173, 199, 0.55)";
const OUTPUT_FILL = "#101c28";
const OUTPUT_GRID = "rgba(242, 193, 78, 0.28)";
const SELECTION_FILL = "rgba(88, 201, 255, 0.22)";
const SELECTION_STROKE = "#6be2ff";
const HOVER_FILL = "rgba(242, 193, 78, 0.18)";
const PLACEMENT_STROKE = "rgba(255, 214, 122, 0.45)";
const SELECTED_TILE_STROKE = "#77f1b2";
const SELECTED_TILE_FILL = "rgba(119, 241, 178, 0.12)";
const VIEW_HINT = "rgba(198, 215, 229, 0.72)";

type RenderCache = {
  sourceBaseCanvas: HTMLCanvasElement | null;
  sourceBaseKey: string | null;
  outputBaseCanvas: HTMLCanvasElement | null;
  outputBaseKey: string | null;
};

const renderCacheByCanvas = new WeakMap<HTMLCanvasElement, RenderCache>();

export function renderWorkspace(canvas: HTMLCanvasElement, state: ProjectState): void {
  const parent = canvas.parentElement;

  if (!parent) {
    return;
  }

  const width = Math.max(320, Math.floor(parent.clientWidth));
  const height = Math.max(320, Math.floor(parent.clientHeight));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.clearRect(0, 0, width, height);
  context.fillStyle = BACKGROUND;
  context.fillRect(0, 0, width, height);

  const { image } = state.sourceImageAsset;
  const layout = getWorkspaceLayout(width, height, state);
  const { sourcePanel, outputPanel } = layout;
  const cache = getRenderCache(canvas);

  drawPanel(context, sourcePanel);
  drawPanel(context, outputPanel);
  drawOutputGrid(context, state, layout.outputViewport, cache);

  if (!image) {
    drawEmptyState(context, sourcePanel);
    return;
  }

  const viewport = layout.sourceViewport;

  if (!viewport) {
    drawEmptyState(context, sourcePanel);
    return;
  }

  drawSourcePanel(context, state, viewport, image, cache);
  context.strokeStyle = BORDER;
  context.lineWidth = 2;
  context.strokeRect(viewport.frame.x - 8, viewport.frame.y - 8, viewport.frame.width + 16, viewport.frame.height + 16);

  context.fillStyle = LABEL;
  context.font = "12px monospace";
  const label = state.sourceImageAsset.name ?? state.project.sourceImage ?? "image";
  context.fillText(`Source: ${label} · ${image.width} x ${image.height}`, sourcePanel.x + 12, sourcePanel.y + 18);
  context.fillStyle = VIEW_HINT;
  context.fillText(`Zoom ${state.session.sourceCamera.zoom.toFixed(2)}x · Wheel to zoom · Option-drag to pan`, sourcePanel.x + 12, sourcePanel.y + sourcePanel.height - 12);
}

function getRenderCache(canvas: HTMLCanvasElement): RenderCache {
  let cache = renderCacheByCanvas.get(canvas);

  if (!cache) {
    cache = {
      sourceBaseCanvas: null,
      sourceBaseKey: null,
      outputBaseCanvas: null,
      outputBaseKey: null,
    };
    renderCacheByCanvas.set(canvas, cache);
  }

  return cache;
}

function drawSourcePanel(
  context: CanvasRenderingContext2D,
  state: ProjectState,
  viewport: SourceViewport,
  image: HTMLImageElement,
  cache: RenderCache,
): void {
  const sourceKey = [
    state.session.renderRevision,
    state.project.sourceImage,
    state.project.sourceTileWidth,
    state.project.sourceTileHeight,
    viewport.frame.x,
    viewport.frame.y,
    viewport.frame.width,
    viewport.frame.height,
    viewport.contentX,
    viewport.contentY,
    viewport.contentWidth,
    viewport.contentHeight,
  ].join("|");

  if (cache.sourceBaseKey !== sourceKey || !cache.sourceBaseCanvas) {
    const baseCanvas = document.createElement("canvas");
    baseCanvas.width = context.canvas.width;
    baseCanvas.height = context.canvas.height;
    const baseContext = baseCanvas.getContext("2d");

    if (baseContext) {
      baseContext.fillStyle = EMPTY_PANEL;
      baseContext.fillRect(viewport.frame.x - 8, viewport.frame.y - 8, viewport.frame.width + 16, viewport.frame.height + 16);
      baseContext.save();
      baseContext.beginPath();
      baseContext.rect(viewport.frame.x, viewport.frame.y, viewport.frame.width, viewport.frame.height);
      baseContext.clip();
      baseContext.drawImage(image, viewport.contentX, viewport.contentY, viewport.contentWidth, viewport.contentHeight);
      drawGridOverlay(baseContext, state, viewport, image.width, image.height);
      baseContext.restore();
    }

    cache.sourceBaseCanvas = baseCanvas;
    cache.sourceBaseKey = sourceKey;
  }

  if (cache.sourceBaseCanvas) {
    context.drawImage(cache.sourceBaseCanvas, 0, 0);
  }

  context.save();
  context.beginPath();
  context.rect(viewport.frame.x, viewport.frame.y, viewport.frame.width, viewport.frame.height);
  context.clip();
  drawSourceSelection(context, state, viewport);
  context.restore();
}

function drawGridOverlay(
  context: CanvasRenderingContext2D,
  state: ProjectState,
  viewport: SourceViewport,
  sourceWidth: number,
  sourceHeight: number,
): void {
  const metrics = getSourceGridMetrics(
    sourceWidth,
    sourceHeight,
    state.project.sourceTileWidth,
    state.project.sourceTileHeight,
  );

  if (metrics.columns < 1 || metrics.rows < 1) {
    return;
  }

  const cellWidth = metrics.tileWidth * viewport.scaleX;
  const cellHeight = metrics.tileHeight * viewport.scaleY;

  context.strokeStyle = GRID;
  context.lineWidth = 1;

  for (let column = 1; column < metrics.columns; column += 1) {
    const lineX = viewport.contentX + Math.round(column * cellWidth) + 0.5;
    context.beginPath();
    context.moveTo(lineX, viewport.frame.y);
    context.lineTo(lineX, viewport.frame.y + viewport.frame.height);
    context.stroke();
  }

  for (let row = 1; row < metrics.rows; row += 1) {
    const lineY = viewport.contentY + Math.round(row * cellHeight) + 0.5;
    context.beginPath();
    context.moveTo(viewport.frame.x, lineY);
    context.lineTo(viewport.frame.x + viewport.frame.width, lineY);
    context.stroke();
  }

  context.strokeStyle = GRID_STRONG;
  context.lineWidth = 1.5;
  context.strokeRect(viewport.frame.x + 0.5, viewport.frame.y + 0.5, viewport.frame.width - 1, viewport.frame.height - 1);
}

function drawEmptyState(
  context: CanvasRenderingContext2D,
  panel: { x: number; y: number; width: number; height: number },
): void {
  context.fillStyle = LABEL;
  context.font = "16px monospace";
  context.fillText("Load a source tilesheet to begin.", panel.x + 16, panel.y + 28);
}

function drawPanel(
  context: CanvasRenderingContext2D,
  panel: { x: number; y: number; width: number; height: number },
): void {
  context.fillStyle = EMPTY_PANEL;
  context.fillRect(panel.x, panel.y, panel.width, panel.height);
  context.strokeStyle = BORDER;
  context.lineWidth = 2;
  context.strokeRect(panel.x + 0.5, panel.y + 0.5, panel.width - 1, panel.height - 1);
}

function drawOutputGrid(
  context: CanvasRenderingContext2D,
  state: ProjectState,
  viewport: OutputViewport,
  cache: RenderCache,
): void {
  const projectPixels = getProjectPixelSize(state.project);
  const outputGrid = getOutputGridMetrics(state.project);

  context.fillStyle = LABEL;
  context.font = "12px monospace";
  context.fillText(
    `Output: ${outputGrid.columns} x ${outputGrid.rows} tiles · ${projectPixels.width} x ${projectPixels.height}px`,
    viewport.frame.x,
    viewport.frame.y - 14,
  );

  drawOutputBase(context, state, viewport, cache);
  context.save();
  context.beginPath();
  context.rect(viewport.frame.x, viewport.frame.y, viewport.frame.width, viewport.frame.height);
  context.clip();
  drawHoveredOutputTile(context, state, viewport);
  drawSelectedOutputTile(context, state, viewport);
  context.restore();
  context.strokeStyle = GRID_STRONG;
  context.lineWidth = 1.5;
  context.strokeRect(viewport.frame.x + 0.5, viewport.frame.y + 0.5, viewport.frame.width - 1, viewport.frame.height - 1);

  context.strokeStyle = OUTPUT_GRID;
  context.lineWidth = 1;

  for (let column = 1; column < outputGrid.columns; column += 1) {
    const lineX = viewport.contentX + Math.round(column * viewport.cellWidth) + 0.5;
    context.beginPath();
    context.moveTo(lineX, viewport.frame.y);
    context.lineTo(lineX, viewport.frame.y + viewport.frame.height);
    context.stroke();
  }

  for (let row = 1; row < outputGrid.rows; row += 1) {
    const lineY = viewport.contentY + Math.round(row * viewport.cellHeight) + 0.5;
    context.beginPath();
    context.moveTo(viewport.frame.x, lineY);
    context.lineTo(viewport.frame.x + viewport.frame.width, lineY);
    context.stroke();
  }

  context.fillStyle = VIEW_HINT;
  context.fillText(
    `Zoom ${state.session.outputCamera.zoom.toFixed(2)}x · Wheel to zoom · Option-drag to pan`,
    viewport.frame.x,
    viewport.frame.y + viewport.frame.height + 16,
  );
}

function drawOutputBase(
  context: CanvasRenderingContext2D,
  state: ProjectState,
  viewport: OutputViewport,
  cache: RenderCache,
): void {
  const outputKey = [
    state.session.renderRevision,
    viewport.frame.x,
    viewport.frame.y,
    viewport.frame.width,
    viewport.frame.height,
    viewport.contentX,
    viewport.contentY,
    viewport.contentWidth,
    viewport.contentHeight,
    viewport.cellWidth,
    viewport.cellHeight,
  ].join("|");

  if (cache.outputBaseKey !== outputKey || !cache.outputBaseCanvas) {
    const baseCanvas = document.createElement("canvas");
    baseCanvas.width = context.canvas.width;
    baseCanvas.height = context.canvas.height;
    const baseContext = baseCanvas.getContext("2d");

    if (baseContext) {
      baseContext.fillStyle = OUTPUT_FILL;
      baseContext.fillRect(viewport.frame.x, viewport.frame.y, viewport.frame.width, viewport.frame.height);
      baseContext.save();
      baseContext.beginPath();
      baseContext.rect(viewport.frame.x, viewport.frame.y, viewport.frame.width, viewport.frame.height);
      baseContext.clip();
      drawPlacedTiles(baseContext, state, viewport);
      baseContext.restore();
    }

    cache.outputBaseCanvas = baseCanvas;
    cache.outputBaseKey = outputKey;
  }

  if (cache.outputBaseCanvas) {
    context.drawImage(cache.outputBaseCanvas, 0, 0);
  }
}

function drawSourceSelection(
  context: CanvasRenderingContext2D,
  state: ProjectState,
  viewport: SourceViewport,
): void {
  const selection = getVisibleSelection(state);

  if (!selection) {
    return;
  }

  const x = viewport.contentX + selection.sourceRect.x * viewport.scaleX;
  const y = viewport.contentY + selection.sourceRect.y * viewport.scaleY;
  const width = selection.sourceRect.w * viewport.scaleX;
  const height = selection.sourceRect.h * viewport.scaleY;

  context.fillStyle = SELECTION_FILL;
  context.fillRect(x, y, width, height);
  context.strokeStyle = SELECTION_STROKE;
  context.lineWidth = 2;
  context.strokeRect(x + 0.5, y + 0.5, Math.max(1, width - 1), Math.max(1, height - 1));
}

function drawPlacedTiles(
  context: CanvasRenderingContext2D,
  state: ProjectState,
  viewport: OutputViewport,
): void {
  for (const tile of state.project.tiles) {
    const image = getSourceImageForRef(state, tile.sourceImageRef) ?? state.sourceImageAsset.image;

    if (!image) {
      continue;
    }

    const cellX = viewport.contentX + tile.destCol * viewport.cellWidth;
    const cellY = viewport.contentY + tile.destRow * viewport.cellHeight;
    const rawDrawX = cellX + tile.offsetX * viewport.scaleX;
    const rawDrawY = cellY + tile.offsetY * viewport.scaleY;
    const rawDrawWidth = tile.sourceRect.w * tile.scaleX * viewport.scaleX;
    const rawDrawHeight = tile.sourceRect.h * tile.scaleY * viewport.scaleY;
    const drawX = tile.pixelSnap ? Math.round(rawDrawX) : rawDrawX;
    const drawY = tile.pixelSnap ? Math.round(rawDrawY) : rawDrawY;
    const drawWidth = tile.pixelSnap ? Math.round(rawDrawWidth) : rawDrawWidth;
    const drawHeight = tile.pixelSnap ? Math.round(rawDrawHeight) : rawDrawHeight;

    context.save();
    context.beginPath();
    context.rect(cellX, cellY, viewport.cellWidth, viewport.cellHeight);
    context.clip();
    context.filter = buildTileFilter(tile);
    context.imageSmoothingEnabled = tile.filterMode === "linear" && !tile.pixelSnap;

    if (tile.flipX || tile.flipY) {
      context.translate(drawX + drawWidth / 2, drawY + drawHeight / 2);
      context.scale(tile.flipX ? -1 : 1, tile.flipY ? -1 : 1);
      context.drawImage(
        image,
        tile.sourceRect.x,
        tile.sourceRect.y,
        tile.sourceRect.w,
        tile.sourceRect.h,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight,
      );
    } else {
      context.drawImage(
        image,
        tile.sourceRect.x,
        tile.sourceRect.y,
        tile.sourceRect.w,
        tile.sourceRect.h,
        drawX,
        drawY,
        drawWidth,
        drawHeight,
      );
    }

    if (tile.tintColor) {
      context.filter = "none";
      context.globalCompositeOperation = "source-atop";
      context.fillStyle = tile.tintColor;
      context.fillRect(cellX, cellY, viewport.cellWidth, viewport.cellHeight);
      context.globalCompositeOperation = "source-over";
    }

    context.strokeStyle = PLACEMENT_STROKE;
    context.lineWidth = 1;
    context.strokeRect(cellX + 0.5, cellY + 0.5, viewport.cellWidth - 1, viewport.cellHeight - 1);
    context.restore();
  }
}

function drawSelectedOutputTile(
  context: CanvasRenderingContext2D,
  state: ProjectState,
  viewport: OutputViewport,
): void {
  const selectedTile = getSelectedOutputTile(state);

  if (!selectedTile) {
    return;
  }

  const x = viewport.contentX + selectedTile.destCol * viewport.cellWidth;
  const y = viewport.contentY + selectedTile.destRow * viewport.cellHeight;
  context.fillStyle = SELECTED_TILE_FILL;
  context.fillRect(x, y, viewport.cellWidth, viewport.cellHeight);
  context.strokeStyle = SELECTED_TILE_STROKE;
  context.lineWidth = 2;
  context.strokeRect(x + 0.5, y + 0.5, viewport.cellWidth - 1, viewport.cellHeight - 1);
}

function drawHoveredOutputTile(
  context: CanvasRenderingContext2D,
  state: ProjectState,
  viewport: OutputViewport,
): void {
  const hoveredTile = state.session.hoveredOutputTile;

  if (!hoveredTile) {
    return;
  }

  const x = viewport.contentX + hoveredTile.col * viewport.cellWidth;
  const y = viewport.contentY + hoveredTile.row * viewport.cellHeight;

  context.fillStyle = HOVER_FILL;
  context.fillRect(x, y, viewport.cellWidth, viewport.cellHeight);
  context.strokeStyle = SELECTION_STROKE;
  context.lineWidth = 1.5;
  context.strokeRect(x + 0.5, y + 0.5, viewport.cellWidth - 1, viewport.cellHeight - 1);
}

function buildTileFilter(tile: ProjectState["project"]["tiles"][number]): string {
  const brightness = Math.max(0, 1 + tile.brightness);
  return `brightness(${brightness}) contrast(${tile.contrast}) saturate(${tile.saturation})`;
}
