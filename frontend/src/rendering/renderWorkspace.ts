import type { ProjectState } from "../types/project";
import { getSourceGridMetrics } from "../systems/tileGridSystem";

const BACKGROUND = "#12202f";
const BORDER = "#3e6d89";
const LABEL = "#c6d7e5";
const EMPTY_PANEL = "#1a3042";
const GRID = "rgba(237, 244, 250, 0.22)";
const GRID_STRONG = "rgba(125, 173, 199, 0.55)";

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

  if (!image) {
    drawEmptyState(context, width, height);
    return;
  }

  const padding = 24;
  const drawWidth = width - padding * 2;
  const drawHeight = height - padding * 2;
  const scale = Math.min(drawWidth / image.width, drawHeight / image.height);
  const imageWidth = Math.max(1, Math.floor(image.width * scale));
  const imageHeight = Math.max(1, Math.floor(image.height * scale));
  const x = Math.floor((width - imageWidth) / 2);
  const y = Math.floor((height - imageHeight) / 2);

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
  context.fillText(`${label} · ${image.width} x ${image.height}`, x, y - 14);
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
    state.project.tileWidth,
    state.project.tileHeight,
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

function drawEmptyState(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.fillStyle = EMPTY_PANEL;
  context.fillRect(24, 24, width - 48, height - 48);
  context.strokeStyle = BORDER;
  context.lineWidth = 2;
  context.strokeRect(24, 24, width - 48, height - 48);
  context.fillStyle = LABEL;
  context.font = "16px monospace";
  context.fillText("Load a source image to begin.", 40, 56);
}
