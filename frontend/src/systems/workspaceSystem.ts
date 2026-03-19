import type { CameraState, GridCoordinate, ProjectState, WorkspacePanel } from "../types/project";
import { getOutputGridMetrics, getProjectPixelSize } from "./tileGridSystem";
import { getResolvedSourceImageAsset } from "./sourceImageSystem";

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PanelViewport = {
  panel: WorkspacePanel;
  frame: Rect;
  contentX: number;
  contentY: number;
  contentWidth: number;
  contentHeight: number;
  scaleX: number;
  scaleY: number;
};

export type SourceViewport = PanelViewport & {
  panel: "source";
};

export type OutputViewport = PanelViewport & {
  panel: "output";
  cellWidth: number;
  cellHeight: number;
  columns: number;
  rows: number;
};

export type WorkspaceLayout = {
  sourcePanel: Rect;
  outputPanel: Rect;
  sourceViewport: SourceViewport | null;
  outputViewport: OutputViewport;
};

const PADDING = 24;
const GUTTER = 24;
const SOURCE_FRAME_INSET = 16;
const OUTPUT_FRAME_X_INSET = 16;
const OUTPUT_FRAME_BOTTOM_INSET = 16;
const OUTPUT_FRAME_TOP_OFFSET = 32;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;

export function getWorkspaceLayout(
  canvasWidth: number,
  canvasHeight: number,
  state: ProjectState,
): WorkspaceLayout {
  const panelWidth = Math.floor((canvasWidth - PADDING * 2 - GUTTER) / 2);
  const panelHeight = canvasHeight - PADDING * 2;
  const sourcePanel = { x: PADDING, y: PADDING, width: panelWidth, height: panelHeight };
  const outputPanel = { x: PADDING + panelWidth + GUTTER, y: PADDING, width: panelWidth, height: panelHeight };

  return {
    sourcePanel,
    outputPanel,
    sourceViewport: getSourceViewport(sourcePanel, state),
    outputViewport: getOutputViewport(outputPanel, state),
  };
}

export function getCanvasPoint(canvas: HTMLCanvasElement, event: PointerEvent | WheelEvent): { x: number; y: number } {
  const bounds = canvas.getBoundingClientRect();
  const scaleX = canvas.width / Math.max(1, bounds.width);
  const scaleY = canvas.height / Math.max(1, bounds.height);

  return {
    x: (event.clientX - bounds.left) * scaleX,
    y: (event.clientY - bounds.top) * scaleY,
  };
}

export function getPanelAtPoint(layout: WorkspaceLayout, x: number, y: number): WorkspacePanel | null {
  if (isInsideRect(layout.sourcePanel, x, y)) {
    return "source";
  }

  if (isInsideRect(layout.outputPanel, x, y)) {
    return "output";
  }

  return null;
}

export function getSourceGridCellAtPoint(
  layout: WorkspaceLayout,
  state: ProjectState,
  x: number,
  y: number,
  clampToGrid = false,
): GridCoordinate | null {
  const viewport = layout.sourceViewport;
  const sourceMetrics = getSourcePanelMetrics(state);

  if (!viewport || !sourceMetrics) {
    return null;
  }

  if (!clampToGrid && !isInsideRect(viewport.frame, x, y)) {
    return null;
  }

  const worldX = getWorldX(viewport, x, clampToGrid);
  const worldY = getWorldY(viewport, y, clampToGrid);
  const maxCol = Math.max(0, sourceMetrics.columns - 1);
  const maxRow = Math.max(0, sourceMetrics.rows - 1);

  return {
    col: clamp(Math.floor(worldX / sourceMetrics.tileWidth), 0, maxCol),
    row: clamp(Math.floor(worldY / sourceMetrics.tileHeight), 0, maxRow),
  };
}

export function getOutputGridCellAtPoint(
  layout: WorkspaceLayout,
  x: number,
  y: number,
): GridCoordinate | null {
  const viewport = layout.outputViewport;

  if (!isInsideRect(viewport.frame, x, y)) {
    return null;
  }

  const worldX = getWorldX(viewport, x, false);
  const worldY = getWorldY(viewport, y, false);

  return {
    col: clamp(Math.floor(worldX / (viewport.cellWidth / viewport.scaleX)), 0, viewport.columns - 1),
    row: clamp(Math.floor(worldY / (viewport.cellHeight / viewport.scaleY)), 0, viewport.rows - 1),
  };
}

export function zoomWorkspacePanel(
  state: ProjectState,
  panel: WorkspacePanel,
  layout: WorkspaceLayout,
  pointX: number,
  pointY: number,
  deltaY: number,
): number | null {
  const viewport = panel === "source" ? layout.sourceViewport : layout.outputViewport;

  if (!viewport || !isInsideRect(viewport.frame, pointX, pointY)) {
    return null;
  }

  const camera = panel === "source" ? state.session.sourceCamera : state.session.outputCamera;
  const worldX = getWorldX(viewport, pointX, false);
  const worldY = getWorldY(viewport, pointY, false);
  const factor = deltaY < 0 ? 1.1 : 1 / 1.1;
  const nextZoom = clamp(camera.zoom * factor, MIN_ZOOM, MAX_ZOOM);

  if (nextZoom === camera.zoom) {
    return nextZoom;
  }

  camera.zoom = nextZoom;

  const nextLayout = getWorkspaceLayoutFromStateAndSize(layout, state);
  const nextViewport = panel === "source" ? nextLayout.sourceViewport : nextLayout.outputViewport;

  if (!nextViewport) {
    return camera.zoom;
  }

  const anchorScreenX = nextViewport.contentX + worldX * nextViewport.scaleX;
  const anchorScreenY = nextViewport.contentY + worldY * nextViewport.scaleY;
  camera.panX += pointX - anchorScreenX;
  camera.panY += pointY - anchorScreenY;
  clampCameraToViewport(state, panel, getWorkspaceLayoutFromStateAndSize(layout, state));

  return camera.zoom;
}

export function panWorkspacePanel(
  state: ProjectState,
  panel: WorkspacePanel,
  deltaX: number,
  deltaY: number,
  layout: WorkspaceLayout,
): void {
  const camera = panel === "source" ? state.session.sourceCamera : state.session.outputCamera;
  camera.panX += deltaX;
  camera.panY += deltaY;
  clampCameraToViewport(state, panel, layout);
}

export function resetWorkspaceView(state: ProjectState, panel: WorkspacePanel): void {
  const camera = panel === "source" ? state.session.sourceCamera : state.session.outputCamera;
  camera.zoom = 1;
  camera.panX = 0;
  camera.panY = 0;
}

function getWorkspaceLayoutFromStateAndSize(layout: WorkspaceLayout, state: ProjectState): WorkspaceLayout {
  return getWorkspaceLayout(
    layout.outputPanel.x + layout.outputPanel.width + PADDING,
    layout.sourcePanel.y + layout.sourcePanel.height + PADDING,
    state,
  );
}

function getSourceViewport(panel: Rect, state: ProjectState): SourceViewport | null {
  const metrics = getSourcePanelMetrics(state);

  if (!metrics) {
    return null;
  }

  const frame = {
    x: panel.x + SOURCE_FRAME_INSET,
    y: panel.y + SOURCE_FRAME_INSET,
    width: panel.width - SOURCE_FRAME_INSET * 2,
    height: panel.height - SOURCE_FRAME_INSET * 2,
  };

  const baseScale = Math.min(frame.width / metrics.pixelWidth, frame.height / metrics.pixelHeight);
  return createViewport("source", frame, metrics.pixelWidth, metrics.pixelHeight, baseScale, state.session.sourceCamera);
}

function getOutputViewport(panel: Rect, state: ProjectState): OutputViewport {
  const outputMetrics = getOutputPanelMetrics(state);
  const frame = {
    x: panel.x + OUTPUT_FRAME_X_INSET,
    y: panel.y + OUTPUT_FRAME_TOP_OFFSET,
    width: panel.width - OUTPUT_FRAME_X_INSET * 2,
    height: panel.height - OUTPUT_FRAME_TOP_OFFSET - OUTPUT_FRAME_BOTTOM_INSET,
  };
  const baseScale = Math.min(frame.width / outputMetrics.pixelWidth, frame.height / outputMetrics.pixelHeight);
  const viewport = createViewport("output", frame, outputMetrics.pixelWidth, outputMetrics.pixelHeight, baseScale, state.session.outputCamera);

  return {
    ...viewport,
    cellWidth: outputMetrics.tileWidth * viewport.scaleX,
    cellHeight: outputMetrics.tileHeight * viewport.scaleY,
    columns: outputMetrics.columns,
    rows: outputMetrics.rows,
  };
}

export function getSourcePanelMetrics(state: ProjectState): {
  pixelWidth: number;
  pixelHeight: number;
  columns: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
} | null {
  if (state.session.activeWorkspaceMode === "scene") {
    const outputGrid = getOutputGridMetrics(state.project);
    return {
      pixelWidth: state.project.outputWidth,
      pixelHeight: state.project.outputHeight,
      columns: outputGrid.columns,
      rows: outputGrid.rows,
      tileWidth: state.project.tileWidth,
      tileHeight: state.project.tileHeight,
    };
  }

  const sourceAsset = getResolvedSourceImageAsset(state);
  const image = sourceAsset.image;

  if (!image) {
    return null;
  }

  return {
    pixelWidth: image.width,
    pixelHeight: image.height,
    columns: Math.max(1, Math.floor(image.width / state.project.sourceTileWidth)),
    rows: Math.max(1, Math.floor(image.height / state.project.sourceTileHeight)),
    tileWidth: state.project.sourceTileWidth,
    tileHeight: state.project.sourceTileHeight,
  };
}

export function getOutputPanelMetrics(state: ProjectState): {
  pixelWidth: number;
  pixelHeight: number;
  columns: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
} {
  if (state.session.activeWorkspaceMode === "scene" && state.project.scene) {
    return {
      pixelWidth: state.project.scene.width * state.project.scene.tileWidth,
      pixelHeight: state.project.scene.height * state.project.scene.tileHeight,
      columns: state.project.scene.width,
      rows: state.project.scene.height,
      tileWidth: state.project.scene.tileWidth,
      tileHeight: state.project.scene.tileHeight,
    };
  }

  const projectPixels = getProjectPixelSize(state.project);
  const outputGrid = getOutputGridMetrics(state.project);
  return {
    pixelWidth: projectPixels.width,
    pixelHeight: projectPixels.height,
    columns: outputGrid.columns,
    rows: outputGrid.rows,
    tileWidth: state.project.tileWidth,
    tileHeight: state.project.tileHeight,
  };
}

function createViewport<TPanel extends WorkspacePanel>(
  panel: TPanel,
  frame: Rect,
  worldWidth: number,
  worldHeight: number,
  baseScale: number,
  camera: CameraState,
): PanelViewport & { panel: TPanel } {
  const scale = baseScale * camera.zoom;
  const contentWidth = Math.max(1, Math.floor(worldWidth * scale));
  const contentHeight = Math.max(1, Math.floor(worldHeight * scale));
  const baseX = frame.x + Math.floor((frame.width - contentWidth) / 2);
  const baseY = frame.y + Math.floor((frame.height - contentHeight) / 2);

  return {
    panel,
    frame,
    contentX: baseX + camera.panX,
    contentY: baseY + camera.panY,
    contentWidth,
    contentHeight,
    scaleX: scale,
    scaleY: scale,
  };
}

function clampCameraToViewport(
  state: ProjectState,
  panel: WorkspacePanel,
  layout: WorkspaceLayout,
): void {
  const camera = panel === "source" ? state.session.sourceCamera : state.session.outputCamera;
  const viewport = panel === "source" ? layout.sourceViewport : layout.outputViewport;

  if (!viewport) {
    return;
  }

  const baseX = viewport.contentX - camera.panX;
  const baseY = viewport.contentY - camera.panY;
  const xRange = getPanRange(baseX, viewport.contentWidth, viewport.frame.x, viewport.frame.width);
  const yRange = getPanRange(baseY, viewport.contentHeight, viewport.frame.y, viewport.frame.height);

  camera.panX = clamp(camera.panX, xRange.min, xRange.max);
  camera.panY = clamp(camera.panY, yRange.min, yRange.max);
}

function getPanRange(
  basePosition: number,
  contentSize: number,
  framePosition: number,
  frameSize: number,
): { min: number; max: number } {
  if (contentSize <= frameSize) {
    const centered = framePosition + Math.floor((frameSize - contentSize) / 2);
    return {
      min: centered - basePosition,
      max: centered - basePosition,
    };
  }

  return {
    min: framePosition + frameSize - (basePosition + contentSize),
    max: framePosition - basePosition,
  };
}

function getWorldX(viewport: PanelViewport, x: number, clampToFrame: boolean): number {
  const clampedX = clampToFrame ? clamp(x, viewport.frame.x, viewport.frame.x + viewport.frame.width - 1) : x;
  return clamp((clampedX - viewport.contentX) / viewport.scaleX, 0, Number.MAX_SAFE_INTEGER);
}

function getWorldY(viewport: PanelViewport, y: number, clampToFrame: boolean): number {
  const clampedY = clampToFrame ? clamp(y, viewport.frame.y, viewport.frame.y + viewport.frame.height - 1) : y;
  return clamp((clampedY - viewport.contentY) / viewport.scaleY, 0, Number.MAX_SAFE_INTEGER);
}

function isInsideRect(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
