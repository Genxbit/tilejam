import type { ProjectState } from "../types/project";
import { getSeamRepairPairs, getSeamRepairSettings, repairSeamPair } from "../systems/seamRepairSystem";
import { getSelectedOutputCells, getSelectedOutputTile, getSelectedOutputTiles } from "../systems/tileEditorSystem";
import { getActiveSceneLayer, getSceneCellGid, getSelectedSceneCells } from "../systems/sceneSystem";
import { drawTileIntoRect, renderTileCanvas } from "../systems/tileRenderSystem";
import { getVisibleSelection } from "../systems/selectionSystem";
import { getResolvedSourceImageAsset, getSourceImageForRef } from "../systems/sourceImageSystem";
import { getOutputGridMetrics, getProjectPixelSize, getSourceGridMetrics } from "../systems/tileGridSystem";
import { getOutputPanelMetrics, getSourcePanelMetrics, getWorkspaceLayout, type OutputViewport, type SourceViewport } from "../systems/workspaceSystem";

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
const SELECTED_TILE_STROKE = "#77f1b2";
const SELECTED_TILE_FILL = "rgba(119, 241, 178, 0.12)";
const SELECTED_SCENE_STROKE = "#ff9d57";
const SELECTED_SCENE_FILL = "rgba(255, 157, 87, 0.14)";
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

  const layout = getWorkspaceLayout(width, height, state);
  const { sourcePanel, outputPanel } = layout;
  const cache = getRenderCache(canvas);
  const hasScenePalette = !(state.session.activeWorkspaceMode === "scene" && state.project.tiles.length < 1);

  drawPanel(context, sourcePanel);
  drawPanel(context, outputPanel);
  drawOutputGrid(context, state, layout.outputViewport, cache);

  if (!layout.sourceViewport || !hasScenePalette) {
    drawEmptyState(context, state, sourcePanel);
    return;
  }

  const viewport = layout.sourceViewport;
  drawSourcePanel(context, state, viewport, cache);
  context.strokeStyle = BORDER;
  context.lineWidth = 2;
  context.strokeRect(viewport.frame.x - 8, viewport.frame.y - 8, viewport.frame.width + 16, viewport.frame.height + 16);

  context.fillStyle = LABEL;
  context.font = "12px monospace";
  context.fillText(getSourcePanelLabel(state), sourcePanel.x + 12, sourcePanel.y + 18);
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
  cache: RenderCache,
): void {
  const sourceKey = [
    state.session.renderRevision,
    state.session.activeWorkspaceMode,
    state.project.sourceImage,
    state.project.workingImage,
    state.project.sourceTileWidth,
    state.project.sourceTileHeight,
    state.project.tileWidth,
    state.project.tileHeight,
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
      if (state.session.activeWorkspaceMode === "scene") {
        drawTilesheetPalette(baseContext, state, viewport);
      } else {
        const sourceAsset = getResolvedSourceImageAsset(state);

        if (sourceAsset.image) {
          baseContext.drawImage(sourceAsset.image, viewport.contentX, viewport.contentY, viewport.contentWidth, viewport.contentHeight);
        }
      }
      drawGridOverlay(baseContext, state, viewport);
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
): void {
  const sourceMetrics = getSourcePanelMetrics(state);

  if (!sourceMetrics || sourceMetrics.columns < 1 || sourceMetrics.rows < 1) {
    return;
  }

  const cellWidth = viewport.contentWidth / sourceMetrics.columns;
  const cellHeight = viewport.contentHeight / sourceMetrics.rows;

  context.save();
  context.beginPath();
  context.rect(viewport.frame.x, viewport.frame.y, viewport.frame.width, viewport.frame.height);
  context.clip();
  context.strokeStyle = GRID;
  context.lineWidth = 1;

  for (let column = 1; column < sourceMetrics.columns; column += 1) {
    const lineX = Math.round(viewport.contentX + column * cellWidth) + 0.5;
    context.beginPath();
    context.moveTo(lineX, viewport.contentY);
    context.lineTo(lineX, viewport.contentY + viewport.contentHeight);
    context.stroke();
  }

  for (let row = 1; row < sourceMetrics.rows; row += 1) {
    const lineY = Math.round(viewport.contentY + row * cellHeight) + 0.5;
    context.beginPath();
    context.moveTo(viewport.contentX, lineY);
    context.lineTo(viewport.contentX + viewport.contentWidth, lineY);
    context.stroke();
  }

  context.strokeStyle = GRID_STRONG;
  context.lineWidth = 1.5;
  context.strokeRect(
    Math.round(viewport.contentX) + 0.5,
    Math.round(viewport.contentY) + 0.5,
    Math.max(1, Math.round(viewport.contentWidth) - 1),
    Math.max(1, Math.round(viewport.contentHeight) - 1),
  );
  context.restore();
}

function drawEmptyState(
  context: CanvasRenderingContext2D,
  state: ProjectState,
  panel: { x: number; y: number; width: number; height: number },
): void {
  context.fillStyle = LABEL;
  context.font = "16px monospace";

  if (state.session.activeWorkspaceMode === "scene" && state.project.scene) {
    const expectedTilesheet = state.project.scene.tilesetSource.replace(/\.tsj$/i, ".png");
    context.fillText("Tilesheet missing for scene.", panel.x + 16, panel.y + 28);
    context.font = "14px monospace";
    context.fillStyle = VIEW_HINT;
    context.fillText(`Expected: ${expectedTilesheet}`, panel.x + 16, panel.y + 56);
    context.fillText("Use Open tilesheet to continue.", panel.x + 16, panel.y + 80);
    return;
  }

  context.fillText("Load a source or working tilesheet to begin.", panel.x + 16, panel.y + 28);
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
  const outputMetrics = getOutputPanelMetrics(state);

  context.fillStyle = LABEL;
  context.font = "12px monospace";
  context.fillText(
    getOutputPanelLabel(state, outputMetrics.columns, outputMetrics.rows, outputMetrics.pixelWidth, outputMetrics.pixelHeight),
    viewport.frame.x,
    viewport.frame.y - 14,
  );

  drawOutputBase(context, state, viewport, cache);
  context.save();
  context.beginPath();
  context.rect(viewport.frame.x, viewport.frame.y, viewport.frame.width, viewport.frame.height);
  context.clip();
  const isScenePreview = state.session.activeWorkspaceMode === "scene" && !state.session.showSceneGrid;

  if (!isScenePreview) {
    drawSeamRepairPreview(context, state, viewport);
    drawHoveredOutputTile(context, state, viewport);
  }
  if (state.session.activeWorkspaceMode === "scene") {
    if (!isScenePreview) {
      drawSelectedSceneCell(context, state, viewport);
    }
  } else {
    drawSelectedOutputTile(context, state, viewport);
  }
  context.restore();
  context.strokeStyle = GRID_STRONG;
  context.lineWidth = 1.5;
  context.strokeRect(viewport.frame.x + 0.5, viewport.frame.y + 0.5, viewport.frame.width - 1, viewport.frame.height - 1);
  drawTilePreview(context, state, viewport);

  const shouldDrawGrid = state.session.activeWorkspaceMode !== "scene" || state.session.showSceneGrid;

  if (!shouldDrawGrid) {
    context.fillStyle = VIEW_HINT;
    context.fillText(
      `Zoom ${state.session.outputCamera.zoom.toFixed(2)}x · Wheel to zoom · Option-drag to pan`,
      viewport.frame.x,
      viewport.frame.y + viewport.frame.height + 16,
    );
    return;
  }

  const cellWidth = viewport.contentWidth / outputMetrics.columns;
  const cellHeight = viewport.contentHeight / outputMetrics.rows;

  context.save();
  context.beginPath();
  context.rect(viewport.frame.x, viewport.frame.y, viewport.frame.width, viewport.frame.height);
  context.clip();
  context.strokeStyle = OUTPUT_GRID;
  context.lineWidth = 1;

  for (let column = 1; column < outputMetrics.columns; column += 1) {
    const lineX = Math.round(viewport.contentX + column * cellWidth) + 0.5;
    context.beginPath();
    context.moveTo(lineX, viewport.contentY);
    context.lineTo(lineX, viewport.contentY + viewport.contentHeight);
    context.stroke();
  }

  for (let row = 1; row < outputMetrics.rows; row += 1) {
    const lineY = Math.round(viewport.contentY + row * cellHeight) + 0.5;
    context.beginPath();
    context.moveTo(viewport.contentX, lineY);
    context.lineTo(viewport.contentX + viewport.contentWidth, lineY);
    context.stroke();
  }

  context.strokeStyle = GRID_STRONG;
  context.lineWidth = 1.5;
  context.strokeRect(
    Math.round(viewport.contentX) + 0.5,
    Math.round(viewport.contentY) + 0.5,
    Math.max(1, Math.round(viewport.contentWidth) - 1),
    Math.max(1, Math.round(viewport.contentHeight) - 1),
  );
  context.restore();

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
    state.session.activeWorkspaceMode,
    state.session.activeWorkspaceMode === "scene" && !state.session.showSceneGrid
      ? state.session.scenePreviewPointer?.x ?? 0
      : "no-preview-x",
    state.session.activeWorkspaceMode === "scene" && !state.session.showSceneGrid
      ? state.session.scenePreviewPointer?.y ?? 0
      : "no-preview-y",
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
      if (state.session.activeWorkspaceMode === "scene") {
        drawSceneTiles(baseContext, state, viewport);
      } else {
        drawPlacedTiles(baseContext, state, viewport);
      }
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

    const cellRect = getAlignedCellRect(viewport, tile.destCol, tile.destRow);

    drawTileIntoRect(
      context,
      image,
      tile,
      cellRect.x,
      cellRect.y,
      state.project.tileWidth,
      state.project.tileHeight,
      cellRect.width / state.project.tileWidth,
      cellRect.height / state.project.tileHeight,
    );
  }
}

function drawSeamRepairPreview(
  context: CanvasRenderingContext2D,
  state: ProjectState,
  viewport: OutputViewport,
): void {
  if (state.session.activeWorkspaceMode !== "tilesheet" || !state.session.seamRepairPreview) {
    return;
  }

  const seamPairs = getSeamRepairPairs(state);

  if (seamPairs.length < 1) {
    return;
  }

  const previewCanvases = new Map<number, HTMLCanvasElement>();

  for (const seamPair of seamPairs) {
    const primaryCanvas = previewCanvases.get(seamPair.primary.id)
      ?? getRenderedPreviewTileCanvas(state, seamPair.primary);
    const neighborCanvas = previewCanvases.get(seamPair.neighbor.id)
      ?? getRenderedPreviewTileCanvas(state, seamPair.neighbor);

    if (!primaryCanvas || !neighborCanvas) {
      continue;
    }

    const repaired = repairSeamPair(primaryCanvas, neighborCanvas, getSeamRepairSettings(state));

    if (!repaired) {
      continue;
    }

    previewCanvases.set(seamPair.primary.id, repaired.primaryCanvas);
    previewCanvases.set(seamPair.neighbor.id, repaired.neighborCanvas);
  }

  for (const tile of state.project.tiles) {
    const previewCanvas = previewCanvases.get(tile.id);

    if (!previewCanvas) {
      continue;
    }

    drawPreviewTileCanvas(context, viewport, tile.destCol, tile.destRow, previewCanvas);
  }
}

function drawTilesheetPalette(
  context: CanvasRenderingContext2D,
  state: ProjectState,
  viewport: SourceViewport,
): void {
  const paletteViewport: OutputViewport = {
    ...viewport,
    panel: "output",
    cellWidth: state.project.tileWidth * viewport.scaleX,
    cellHeight: state.project.tileHeight * viewport.scaleY,
    columns: Math.max(1, Math.floor(state.project.outputWidth / state.project.tileWidth)),
    rows: Math.max(1, Math.floor(state.project.outputHeight / state.project.tileHeight)),
  };

  drawPlacedTiles(context, state, paletteViewport);
}

function drawPreviewTileCanvas(
  context: CanvasRenderingContext2D,
  viewport: OutputViewport,
  destCol: number,
  destRow: number,
  tileCanvas: HTMLCanvasElement,
): void {
  const cellRect = getAlignedCellRect(viewport, destCol, destRow);

  context.save();
  context.imageSmoothingEnabled = false;
  context.drawImage(tileCanvas, cellRect.x, cellRect.y, cellRect.width, cellRect.height);
  context.restore();
}

function getRenderedPreviewTileCanvas(
  state: ProjectState,
  tile: ProjectState["project"]["tiles"][number],
): HTMLCanvasElement | null {
  const image = getSourceImageForRef(state, tile.sourceImageRef) ?? state.sourceImageAsset.image;

  if (!image) {
    return null;
  }

  return renderTileCanvas(image, tile, state.project.tileWidth, state.project.tileHeight);
}

function drawSceneTiles(
  context: CanvasRenderingContext2D,
  state: ProjectState,
  viewport: OutputViewport,
): void {
  const scene = state.project.scene;

  if (!scene) {
    return;
  }

  for (const layer of scene.layers) {
    if (!layer.visible || layer.opacity <= 0) {
      continue;
    }

    context.save();
    context.globalAlpha = layer.opacity;
    const previewParallax = getScenePreviewParallaxOffset(state, viewport, layer.parallaxX, layer.parallaxY);
    const layerOffsetX = layer.offsetX * viewport.scaleX + previewParallax.x;
    const layerOffsetY = layer.offsetY * viewport.scaleY + previewParallax.y;

    for (let row = 0; row < scene.height; row += 1) {
      for (let col = 0; col < scene.width; col += 1) {
        const gid = getSceneCellGid(state, col, row, layer.id);

        if (gid < 1) {
          continue;
        }

        const tile = state.project.tiles.find((entry) => entry.id === gid - 1);

        if (!tile) {
          continue;
        }

        drawTileInstance(context, state, viewport, col, row, tile, layerOffsetX, layerOffsetY);
      }
    }

    context.restore();
  }
}

function getScenePreviewParallaxOffset(
  state: ProjectState,
  viewport: OutputViewport,
  parallaxX: number,
  parallaxY: number,
): { x: number; y: number } {
  if (state.session.activeWorkspaceMode !== "scene" || state.session.showSceneGrid) {
    return { x: 0, y: 0 };
  }

  const pointer = state.session.scenePreviewPointer;

  if (!pointer) {
    return { x: 0, y: 0 };
  }

  const maxOffsetX = viewport.cellWidth * 0.75;
  const maxOffsetY = viewport.cellHeight * 0.75;

  return {
    x: pointer.x * maxOffsetX * (1 - parallaxX),
    y: pointer.y * maxOffsetY * (1 - parallaxY),
  };
}

function drawTileInstance(
  context: CanvasRenderingContext2D,
  state: ProjectState,
  viewport: OutputViewport,
  col: number,
  row: number,
  tile: ProjectState["project"]["tiles"][number],
  layerOffsetX = 0,
  layerOffsetY = 0,
): void {
  const image = getSourceImageForRef(state, tile.sourceImageRef) ?? state.sourceImageAsset.image;

  if (!image) {
    return;
  }

  const cellRect = getAlignedCellRect(viewport, col, row, layerOffsetX, layerOffsetY);

  drawTileIntoRect(
    context,
    image,
    tile,
    cellRect.x,
    cellRect.y,
    state.project.tileWidth,
    state.project.tileHeight,
    cellRect.width / state.project.tileWidth,
    cellRect.height / state.project.tileHeight,
  );
}

function drawSelectedOutputTile(
  context: CanvasRenderingContext2D,
  state: ProjectState,
  viewport: OutputViewport,
): void {
  const selectedCells = getSelectedOutputCells(state);
  const selectedTiles = getSelectedOutputTiles(state);
  const selectedTile = getSelectedOutputTile(state);

  if (selectedCells.length < 1) {
    return;
  }

  const selectedIds = new Set(selectedTiles.map((tile) => tile.id));

  for (const cell of selectedCells) {
    const tile = state.project.tiles.find((entry) => entry.destCol === cell.col && entry.destRow === cell.row) ?? null;
    const x = viewport.contentX + cell.col * viewport.cellWidth;
    const y = viewport.contentY + cell.row * viewport.cellHeight;
    context.fillStyle = SELECTED_TILE_FILL;
    context.fillRect(x, y, viewport.cellWidth, viewport.cellHeight);
    context.strokeStyle = tile?.id === selectedTile?.id
      ? SELECTED_TILE_STROKE
      : selectedIds.has(tile?.id ?? -1)
        ? "rgba(119, 241, 178, 0.55)"
        : "rgba(119, 241, 178, 0.35)";
    context.lineWidth = tile?.id === selectedTile?.id ? 2 : 1.5;
    context.strokeRect(x + 0.5, y + 0.5, viewport.cellWidth - 1, viewport.cellHeight - 1);
  }
}

function drawSelectedSceneCell(
  context: CanvasRenderingContext2D,
  state: ProjectState,
  viewport: OutputViewport,
): void {
  const selectedCell = state.session.selectedSceneCell;
  const selectedCells = getSelectedSceneCells(state);

  if (selectedCells.length < 1) {
    return;
  }

  for (const cell of selectedCells) {
    const x = viewport.contentX + cell.col * viewport.cellWidth;
    const y = viewport.contentY + cell.row * viewport.cellHeight;
    context.fillStyle = SELECTED_SCENE_FILL;
    context.fillRect(x, y, viewport.cellWidth, viewport.cellHeight);
    context.strokeStyle = selectedCell && cell.col === selectedCell.col && cell.row === selectedCell.row
      ? SELECTED_SCENE_STROKE
      : "rgba(255, 157, 87, 0.55)";
    context.lineWidth = selectedCell && cell.col === selectedCell.col && cell.row === selectedCell.row ? 2 : 1.5;
    context.strokeRect(x + 0.5, y + 0.5, viewport.cellWidth - 1, viewport.cellHeight - 1);
  }
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

function drawTilePreview(
  context: CanvasRenderingContext2D,
  state: ProjectState,
  viewport: OutputViewport,
): void {
  const selectedTile = getSelectedOutputTile(state);
  const previewMode = state.session.tilePreviewMode;

  if (!selectedTile || previewMode === "none" || state.session.activeWorkspaceMode === "scene") {
    return;
  }

  const image = getSourceImageForRef(state, selectedTile.sourceImageRef) ?? state.sourceImageAsset.image;

  if (!image) {
    return;
  }

  const previewSize = 96;
  const cardPadding = 12;
  const gap = 2;
  const cardWidth = previewSize + cardPadding * 2;
  const cardHeight = previewSize + cardPadding * 2 + 22;
  const cardX = viewport.frame.x + viewport.frame.width - cardWidth - 10;
  const cardY = viewport.frame.y + 10;
  const cellSize = Math.floor((previewSize - gap * 2) / 3);

  context.save();
  context.fillStyle = "rgba(7, 16, 22, 0.92)";
  context.strokeStyle = BORDER;
  context.lineWidth = 1;
  roundRect(context, cardX, cardY, cardWidth, cardHeight, 12);
  context.fill();
  context.stroke();

  context.fillStyle = LABEL;
  context.font = "12px monospace";
  context.fillText(previewMode === "repeat" ? "Repeat Preview" : "Neighbor Preview", cardX + 12, cardY + 18);

  const originX = cardX + cardPadding;
  const originY = cardY + 28;

  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const drawX = originX + col * (cellSize + gap);
      const drawY = originY + row * (cellSize + gap);

      context.fillStyle = "rgba(12, 28, 40, 0.95)";
      context.fillRect(drawX, drawY, cellSize, cellSize);

      const tile = previewMode === "repeat"
        ? selectedTile
        : getNeighborPreviewTile(state, selectedTile.destCol + col - 1, selectedTile.destRow + row - 1) ?? selectedTile;

      const tileImage = getSourceImageForRef(state, tile.sourceImageRef) ?? image;
      drawTileIntoRect(
        context,
        tileImage,
        tile,
        drawX,
        drawY,
        state.project.tileWidth,
        state.project.tileHeight,
        cellSize / state.project.tileWidth,
        cellSize / state.project.tileHeight,
      );

      context.strokeStyle = col === 1 && row === 1 ? SELECTED_TILE_STROKE : "rgba(198, 215, 229, 0.15)";
      context.lineWidth = col === 1 && row === 1 ? 1.5 : 1;
      context.strokeRect(drawX + 0.5, drawY + 0.5, cellSize - 1, cellSize - 1);
    }
  }

  context.restore();
}

function getNeighborPreviewTile(
  state: ProjectState,
  col: number,
  row: number,
): ProjectState["project"]["tiles"][number] | null {
  return state.project.tiles.find((tile) => tile.destCol === col && tile.destRow === row) ?? null;
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function getSourcePanelLabel(state: ProjectState): string {
  if (state.session.activeWorkspaceMode === "scene") {
    const outputGrid = getOutputGridMetrics(state.project);
    const name = getWorkingTilesheetLabel(state);
    return `Tilesheet: ${name} · ${outputGrid.columns} x ${outputGrid.rows} tiles · ${state.project.outputWidth} x ${state.project.outputHeight}`;
  }

  const sourceAsset = getResolvedSourceImageAsset(state);
  const image = sourceAsset.image;
  const label = getDisplayFileLabel(sourceAsset.name ?? state.project.sourceImage ?? "image");
  const columns = image ? Math.max(1, Math.floor(image.width / state.project.sourceTileWidth)) : 0;
  const rows = image ? Math.max(1, Math.floor(image.height / state.project.sourceTileHeight)) : 0;
  return `Source: ${label} · ${columns} x ${rows} tiles · ${image?.width ?? 0} x ${image?.height ?? 0}px`;
}

function getOutputPanelLabel(
  state: ProjectState,
  columns: number,
  rows: number,
  pixelWidth: number,
  pixelHeight: number,
): string {
  if (state.session.activeWorkspaceMode === "scene") {
    const layer = getActiveSceneLayer(state);
    return `Scene: ${columns} x ${rows} tiles · ${pixelWidth} x ${pixelHeight}px${layer ? ` · Layer ${layer.name}` : ""}`;
  }

  return `Tilesheet: ${getWorkingTilesheetLabel(state)} · ${columns} x ${rows} tiles · ${pixelWidth} x ${pixelHeight}px`;
}

function getWorkingTilesheetLabel(state: ProjectState): string {
  if (state.session.activeWorkspaceMode === "scene" && state.project.scene && !state.project.workingImage && !state.session.workingImageFileName) {
    return getDisplayFileLabel(state.project.scene.tilesetSource.replace(/\.tsj$/i, ".png"));
  }

  return getDisplayFileLabel(
    state.session.workingImageFileName
    ?? state.project.workingImage
    ?? "unsaved",
  );
}

function getDisplayFileLabel(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  const segments = normalized.split("/");
  return segments[segments.length - 1] || value;
}

function getAlignedCellRect(
  viewport: OutputViewport,
  col: number,
  row: number,
  offsetX = 0,
  offsetY = 0,
): { x: number; y: number; width: number; height: number } {
  const startX = Math.round(viewport.contentX + col * viewport.cellWidth + offsetX);
  const endX = Math.round(viewport.contentX + (col + 1) * viewport.cellWidth + offsetX);
  const startY = Math.round(viewport.contentY + row * viewport.cellHeight + offsetY);
  const endY = Math.round(viewport.contentY + (row + 1) * viewport.cellHeight + offsetY);

  return {
    x: startX,
    y: startY,
    width: Math.max(1, endX - startX),
    height: Math.max(1, endY - startY),
  };
}
