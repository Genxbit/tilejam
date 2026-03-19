import type {
  TileAnchorX,
  TileAnchorY,
  TileFitMode,
  TilePlacement,
} from "../types/project";

export type TileSampleRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type TileDrawRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const renderedTileCanvasCache = new Map<string, HTMLCanvasElement>();

export function getTileSampleRect(tile: TilePlacement): TileSampleRect | null {
  const x = tile.sourceRect.x + tile.cropLeft;
  const y = tile.sourceRect.y + tile.cropTop;
  const w = Math.max(0, tile.sourceRect.w - tile.cropLeft - tile.cropRight);
  const h = Math.max(0, tile.sourceRect.h - tile.cropTop - tile.cropBottom);

  if (w < 1 || h < 1) {
    return null;
  }

  return { x, y, w, h };
}

export function getTileDrawRect(tile: TilePlacement, tileWidth: number, tileHeight: number): TileDrawRect | null {
  const sampleRect = getTileSampleRect(tile);

  if (!sampleRect) {
    return null;
  }

  const fullSourceWidth = tile.sourceRect.w * tile.scaleX;
  const fullSourceHeight = tile.sourceRect.h * tile.scaleY;
  const fitRect = getFitRect(tile.fitMode, tile.anchorX, tile.anchorY, fullSourceWidth, fullSourceHeight, tileWidth, tileHeight);
  const sampleScaleX = fitRect.width / Math.max(1, fullSourceWidth);
  const sampleScaleY = fitRect.height / Math.max(1, fullSourceHeight);
  const croppedWidth = sampleRect.w * tile.scaleX * sampleScaleX;
  const croppedHeight = sampleRect.h * tile.scaleY * sampleScaleY;
  const cropShiftX = tile.cropLeft * tile.scaleX * sampleScaleX;
  const cropShiftY = tile.cropTop * tile.scaleY * sampleScaleY;
  const baseX = fitRect.x + cropShiftX + tile.offsetX - tile.edgeStretchLeft;
  const baseY = fitRect.y + cropShiftY + tile.offsetY - tile.edgeStretchTop;
  const baseWidth = croppedWidth + tile.edgeStretchLeft + tile.edgeStretchRight;
  const baseHeight = croppedHeight + tile.edgeStretchTop + tile.edgeStretchBottom;

  return {
    x: baseX,
    y: baseY,
    width: baseWidth,
    height: baseHeight,
  };
}

export function buildTileFilter(tile: TilePlacement): string {
  const brightness = Math.max(0, 1 + tile.brightness);
  return `brightness(${brightness}) contrast(${tile.contrast}) saturate(${tile.saturation})`;
}

export function drawTileIntoRect(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  tile: TilePlacement,
  cellX: number,
  cellY: number,
  tileWidth: number,
  tileHeight: number,
  scaleX = 1,
  scaleY = 1,
): boolean {
  const sampleRect = getTileSampleRect(tile);
  const tileCanvas = renderTileCanvas(image, tile, tileWidth, tileHeight);

  if (!sampleRect || !tileCanvas) {
    return false;
  }

  const rawDrawX = cellX;
  const rawDrawY = cellY;
  const rawDrawWidth = tileWidth * scaleX;
  const rawDrawHeight = tileHeight * scaleY;
  const drawX = tile.pixelSnap ? Math.round(rawDrawX) : rawDrawX;
  const drawY = tile.pixelSnap ? Math.round(rawDrawY) : rawDrawY;
  const drawWidth = tile.pixelSnap ? Math.round(rawDrawWidth) : rawDrawWidth;
  const drawHeight = tile.pixelSnap ? Math.round(rawDrawHeight) : rawDrawHeight;

  context.save();
  context.imageSmoothingEnabled = tile.filterMode === "linear" && !tile.pixelSnap;
  if (tile.clampToTile) {
    context.beginPath();
    context.rect(cellX, cellY, tileWidth * scaleX, tileHeight * scaleY);
    context.clip();
  }
  context.drawImage(tileCanvas, 0, 0, tileWidth, tileHeight, drawX, drawY, drawWidth, drawHeight);
  context.restore();
  return true;
}

export function renderTileCanvas(
  image: HTMLImageElement,
  tile: TilePlacement,
  tileWidth: number,
  tileHeight: number,
  options?: { applyEdgeExtend?: boolean },
): HTMLCanvasElement | null {
  return getRenderedTileCanvas(image, tile, tileWidth, tileHeight, options?.applyEdgeExtend ?? false);
}

function getRenderedTileCanvas(
  image: HTMLImageElement,
  tile: TilePlacement,
  tileWidth: number,
  tileHeight: number,
  applyEdgeExtend = false,
): HTMLCanvasElement | null {
  const sampleRect = getTileSampleRect(tile);
  const drawRect = getTileDrawRect(tile, tileWidth, tileHeight);

  if (!sampleRect || !drawRect || drawRect.width <= 0 || drawRect.height <= 0) {
    return null;
  }

  const cacheKey = [
    image.currentSrc || image.src || "image",
    tileWidth,
    tileHeight,
    tile.sourceRect.x,
    tile.sourceRect.y,
    tile.sourceRect.w,
    tile.sourceRect.h,
    tile.offsetX,
    tile.offsetY,
    tile.scaleX,
    tile.scaleY,
    tile.fitMode,
    tile.anchorX,
    tile.anchorY,
    tile.cropLeft,
    tile.cropRight,
    tile.cropTop,
    tile.cropBottom,
    tile.clampToTile,
    tile.edgeStretchLeft,
    tile.edgeStretchRight,
    tile.edgeStretchTop,
    tile.edgeStretchBottom,
    applyEdgeExtend,
    tile.fillExposedColor ?? "",
    tile.flipX,
    tile.flipY,
    tile.rotationQuarterTurns,
    tile.brightness,
    tile.contrast,
    tile.saturation,
    tile.tintColor ?? "",
    tile.filterMode,
    tile.pixelSnap,
  ].join("|");

  const cachedCanvas = renderedTileCanvasCache.get(cacheKey);

  if (cachedCanvas) {
    return cachedCanvas;
  }

  const tileCanvas = document.createElement("canvas");
  tileCanvas.width = Math.max(1, Math.round(tileWidth));
  tileCanvas.height = Math.max(1, Math.round(tileHeight));
  const tileContext = tileCanvas.getContext("2d", { willReadFrequently: applyEdgeExtend });

  if (!tileContext) {
    return null;
  }

  tileContext.clearRect(0, 0, tileCanvas.width, tileCanvas.height);

  if (tile.fillExposedColor) {
    tileContext.fillStyle = tile.fillExposedColor;
    tileContext.fillRect(0, 0, tileCanvas.width, tileCanvas.height);
  }

  tileContext.save();
  if (tile.clampToTile) {
    tileContext.beginPath();
    tileContext.rect(0, 0, tileWidth, tileHeight);
    tileContext.clip();
  }

  tileContext.filter = buildTileFilter(tile);
  tileContext.imageSmoothingEnabled = tile.filterMode === "linear" && !tile.pixelSnap;
  tileContext.translate(drawRect.x + drawRect.width / 2, drawRect.y + drawRect.height / 2);
  tileContext.rotate((Math.PI / 2) * tile.rotationQuarterTurns);
  tileContext.scale(tile.flipX ? -1 : 1, tile.flipY ? -1 : 1);
  tileContext.drawImage(
    image,
    sampleRect.x,
    sampleRect.y,
    sampleRect.w,
    sampleRect.h,
    -drawRect.width / 2,
    -drawRect.height / 2,
    drawRect.width,
    drawRect.height,
  );

  if (tile.tintColor) {
    tileContext.filter = "none";
    tileContext.globalCompositeOperation = "source-atop";
    tileContext.fillStyle = tile.tintColor;
    tileContext.fillRect(-drawRect.width / 2, -drawRect.height / 2, drawRect.width, drawRect.height);
    tileContext.globalCompositeOperation = "source-over";
  }

  tileContext.restore();

  if (applyEdgeExtend) {
    extendTileEdges(tileContext, tileCanvas.width, tileCanvas.height);
  }

  renderedTileCanvasCache.set(cacheKey, tileCanvas);

  if (renderedTileCanvasCache.size > 2000) {
    const oldestKey = renderedTileCanvasCache.keys().next().value;

    if (oldestKey) {
      renderedTileCanvasCache.delete(oldestKey);
    }
  }

  return tileCanvas;
}

export function applyFitMode(tile: TilePlacement, fitMode: TileFitMode): void {
  tile.fitMode = fitMode;
  tile.anchorX = "center";
  tile.anchorY = "center";
  tile.offsetX = 0;
  tile.offsetY = 0;
}

export function applyAnchor(tile: TilePlacement, anchorX: TileAnchorX, anchorY: TileAnchorY): void {
  tile.anchorX = anchorX;
  tile.anchorY = anchorY;
  tile.offsetX = 0;
  tile.offsetY = 0;
}

function getFitRect(
  fitMode: TileFitMode,
  anchorX: TileAnchorX,
  anchorY: TileAnchorY,
  sourceWidth: number,
  sourceHeight: number,
  tileWidth: number,
  tileHeight: number,
): TileDrawRect {
  if (fitMode === "stretch") {
    return {
      x: 0,
      y: 0,
      width: tileWidth,
      height: tileHeight,
    };
  }

  if (fitMode === "contain") {
    const ratio = Math.min(tileWidth / sourceWidth, tileHeight / sourceHeight);
    const width = sourceWidth * ratio;
    const height = sourceHeight * ratio;

    return {
      x: getAnchorOffset(anchorX, tileWidth, width),
      y: getAnchorOffset(anchorY, tileHeight, height),
      width,
      height,
    };
  }

  return {
    x: getAnchorOffset(anchorX, tileWidth, sourceWidth),
    y: getAnchorOffset(anchorY, tileHeight, sourceHeight),
    width: sourceWidth,
    height: sourceHeight,
  };
}

function getAnchorOffset(anchor: TileAnchorX | TileAnchorY, tileSize: number, contentSize: number): number {
  if (anchor === "left" || anchor === "top") {
    return 0;
  }

  if (anchor === "right" || anchor === "bottom") {
    return tileSize - contentSize;
  }

  return (tileSize - contentSize) / 2;
}

function extendTileEdges(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const imageData = context.getImageData(0, 0, width, height);
  const bounds = getOpaqueBounds(imageData.data, width, height);

  if (!bounds) {
    return;
  }

  const { left, right, top, bottom } = bounds;
  const nextData = new Uint8ClampedArray(imageData.data);

  for (let y = 0; y < top; y += 1) {
    copyHorizontalSpan(nextData, imageData.data, width, left, right, top, y);
  }

  for (let y = bottom + 1; y < height; y += 1) {
    copyHorizontalSpan(nextData, imageData.data, width, left, right, bottom, y);
  }

  for (let y = top; y <= bottom; y += 1) {
    for (let x = 0; x < left; x += 1) {
      copyPixel(nextData, imageData.data, width, left, y, x, y);
    }

    for (let x = right + 1; x < width; x += 1) {
      copyPixel(nextData, imageData.data, width, right, y, x, y);
    }
  }

  for (let y = 0; y < top; y += 1) {
    for (let x = 0; x < left; x += 1) {
      copyPixel(nextData, imageData.data, width, left, top, x, y);
    }

    for (let x = right + 1; x < width; x += 1) {
      copyPixel(nextData, imageData.data, width, right, top, x, y);
    }
  }

  for (let y = bottom + 1; y < height; y += 1) {
    for (let x = 0; x < left; x += 1) {
      copyPixel(nextData, imageData.data, width, left, bottom, x, y);
    }

    for (let x = right + 1; x < width; x += 1) {
      copyPixel(nextData, imageData.data, width, right, bottom, x, y);
    }
  }

  context.putImageData(new ImageData(nextData, width, height), 0, 0);
}

function getOpaqueBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { left: number; right: number; top: number; bottom: number } | null {
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];

      if (alpha > 0) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }

  if (right < left || bottom < top) {
    return null;
  }

  return { left, right, top, bottom };
}

function copyHorizontalSpan(
  target: Uint8ClampedArray,
  source: Uint8ClampedArray,
  width: number,
  startX: number,
  endX: number,
  sourceY: number,
  targetY: number,
): void {
  for (let x = startX; x <= endX; x += 1) {
    copyPixel(target, source, width, x, sourceY, x, targetY);
  }
}

function copyPixel(
  target: Uint8ClampedArray,
  source: Uint8ClampedArray,
  width: number,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): void {
  const sourceIndex = (sourceY * width + sourceX) * 4;
  const targetIndex = (targetY * width + targetX) * 4;

  target[targetIndex] = source[sourceIndex];
  target[targetIndex + 1] = source[sourceIndex + 1];
  target[targetIndex + 2] = source[sourceIndex + 2];
  target[targetIndex + 3] = source[sourceIndex + 3];
}
