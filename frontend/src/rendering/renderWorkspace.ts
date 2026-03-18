import type { ProjectState } from "../types/project";
import { getOutputGridMetrics, getProjectPixelSize, getSourceGridMetrics } from "../systems/tileGridSystem";

const BACKGROUND = "#12202f";
const BORDER = "#3e6d89";
const LABEL = "#c6d7e5";
const EMPTY_PANEL = "#1a3042";
const GRID = "rgba(237, 244, 250, 0.22)";
const GRID_STRONG = "rgba(125, 173, 199, 0.55)";
const OUTPUT_FILL = "#101c28";
const OUTPUT_GRID = "rgba(242, 193, 78, 0.28)";

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

  const padding = 24;
  const gutter = 24;
  const panelWidth = Math.floor((width - padding * 2 - gutter) / 2);
  const panelHeight = height - padding * 2;
  const sourcePanel = { x: padding, y: padding, width: panelWidth, height: panelHeight };
  const outputPanel = { x: padding + panelWidth + gutter, y: padding, width: panelWidth, height: panelHeight };

  drawPanel(context, sourcePanel);
  drawPanel(context, outputPanel);
  drawOutputGrid(context, state, outputPanel);

  if (!image) {
    drawEmptyState(context, sourcePanel);
    return;
  }

  const drawWidth = sourcePanel.width - 32;
  const drawHeight = sourcePanel.height - 32;
  const scale = Math.min(drawWidth / image.width, drawHeight / image.height);
  const imageWidth = Math.max(1, Math.floor(image.width * scale));
  const imageHeight = Math.max(1, Math.floor(image.height * scale));
  const x = sourcePanel.x + Math.floor((sourcePanel.width - imageWidth) / 2);
  const y = sourcePanel.y + Math.floor((sourcePanel.height - imageHeight) / 2);

  context.fillStyle = EMPTY_PANEL;
  context.fillRect(x - 8, y - 8, imageWidth + 16, imageHeight + 16);
  context.drawImage(image, x, y, imageWidth, imageHeight);
  drawGridOverlay(context, state, x, y, imageWidth, imageHeight, image.width, image.height);
  context.strokeStyle = BORDER;
  context.lineWidth = 2;
  context.strokeRect(x - 8, y - 8, imageWidth + 16, imageHeight + 16);

  context.fillStyle = LABEL;
  context.font = "12px monospace";
  const label = state.sourceImageAsset.name ?? state.project.sourceImage ?? "image";
  context.fillText(`Source: ${label} · ${image.width} x ${image.height}`, sourcePanel.x + 12, sourcePanel.y + 18);
}

function drawGridOverlay(
  context: CanvasRenderingContext2D,
  state: ProjectState,
  x: number,
  y: number,
  imageWidth: number,
  imageHeight: number,
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

  const cellWidth = imageWidth * (metrics.tileWidth / sourceWidth);
  const cellHeight = imageHeight * (metrics.tileHeight / sourceHeight);

  context.save();
  context.beginPath();
  context.rect(x, y, imageWidth, imageHeight);
  context.clip();

  context.strokeStyle = GRID;
  context.lineWidth = 1;

  for (let column = 1; column < metrics.columns; column += 1) {
    const lineX = x + Math.round(column * cellWidth) + 0.5;
    context.beginPath();
    context.moveTo(lineX, y);
    context.lineTo(lineX, y + imageHeight);
    context.stroke();
  }

  for (let row = 1; row < metrics.rows; row += 1) {
    const lineY = y + Math.round(row * cellHeight) + 0.5;
    context.beginPath();
    context.moveTo(x, lineY);
    context.lineTo(x + imageWidth, lineY);
    context.stroke();
  }

  context.strokeStyle = GRID_STRONG;
  context.lineWidth = 1.5;
  context.strokeRect(x + 0.5, y + 0.5, imageWidth - 1, imageHeight - 1);
  context.restore();
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
  panel: { x: number; y: number; width: number; height: number },
): void {
  const projectPixels = getProjectPixelSize(state.project);
  const outputGrid = getOutputGridMetrics(state.project);
  const availableWidth = panel.width - 32;
  const availableHeight = panel.height - 56;
  const scale = Math.min(availableWidth / projectPixels.width, availableHeight / projectPixels.height);
  const gridWidth = Math.max(1, Math.floor(projectPixels.width * scale));
  const gridHeight = Math.max(1, Math.floor(projectPixels.height * scale));
  const x = panel.x + Math.floor((panel.width - gridWidth) / 2);
  const y = panel.y + 32 + Math.floor((panel.height - 32 - gridHeight) / 2);
  const cellWidth = gridWidth / outputGrid.columns;
  const cellHeight = gridHeight / outputGrid.rows;

  context.fillStyle = LABEL;
  context.font = "12px monospace";
  context.fillText(
    `Output: ${outputGrid.columns} x ${outputGrid.rows} tiles · ${projectPixels.width} x ${projectPixels.height}px`,
    panel.x + 12,
    panel.y + 18,
  );

  context.fillStyle = OUTPUT_FILL;
  context.fillRect(x, y, gridWidth, gridHeight);
  context.strokeStyle = GRID_STRONG;
  context.lineWidth = 1.5;
  context.strokeRect(x + 0.5, y + 0.5, gridWidth - 1, gridHeight - 1);

  context.strokeStyle = OUTPUT_GRID;
  context.lineWidth = 1;

  for (let column = 1; column < outputGrid.columns; column += 1) {
    const lineX = x + Math.round(column * cellWidth) + 0.5;
    context.beginPath();
    context.moveTo(lineX, y);
    context.lineTo(lineX, y + gridHeight);
    context.stroke();
  }

  for (let row = 1; row < outputGrid.rows; row += 1) {
    const lineY = y + Math.round(row * cellHeight) + 0.5;
    context.beginPath();
    context.moveTo(x, lineY);
    context.lineTo(x + gridWidth, lineY);
    context.stroke();
  }
}
