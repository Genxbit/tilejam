import type { ProjectState, TilePlacement } from "../types/project";
import { getSourceImageForRef } from "../systems/sourceImageSystem";
import { getOutputGridMetrics } from "../systems/tileGridSystem";

export async function exportTilesetPng(state: ProjectState, filename = "tileset.png"): Promise<{ missingTileCount: number }> {
  const { blob, missingTileCount } = await renderTilesetPngBlob(state);
  downloadBlob(blob, filename);

  return { missingTileCount };
}

export async function renderTilesetPngBlob(state: ProjectState): Promise<{ blob: Blob; missingTileCount: number }> {
  const canvas = document.createElement("canvas");
  canvas.width = state.project.outputWidth;
  canvas.height = state.project.outputHeight;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Failed to create export canvas.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);

  let missingTileCount = 0;

  for (const tile of state.project.tiles) {
    const image = getSourceImageForRef(state, tile.sourceImageRef) ?? state.sourceImageAsset.image;

    if (!image) {
      missingTileCount += 1;
      continue;
    }

    drawExportTile(context, tile, image, state.project.tileWidth, state.project.tileHeight);
  }

  const blob = await canvasToBlob(canvas, "image/png");

  return { blob, missingTileCount };
}

export async function saveTilesetPngToHandle(
  handle: FileSystemFileHandle,
  state: ProjectState,
): Promise<{ missingTileCount: number }> {
  const { blob, missingTileCount } = await renderTilesetPngBlob(state);
  const writable = await handle.createWritable();

  try {
    await writable.write(blob);
  } finally {
    await writable.close();
  }

  return { missingTileCount };
}

export async function saveTilesetPngWithPicker(
  state: ProjectState,
  suggestedName = "tileset.png",
): Promise<{ handle: FileSystemFileHandle | null; missingTileCount: number }> {
  if (!window.showSaveFilePicker) {
    const { missingTileCount } = await exportTilesetPng(state, suggestedName);
    return { handle: null, missingTileCount };
  }

  const handle = await window.showSaveFilePicker({
    excludeAcceptAllOption: false,
    suggestedName,
    types: [
      {
        description: "PNG image",
        accept: {
          "image/png": [".png"],
        },
      },
    ],
  });

  const { missingTileCount } = await saveTilesetPngToHandle(handle, state);
  return { handle, missingTileCount };
}

export function exportTilesetTsj(state: ProjectState, filename = "tileset.tsj"): void {
  const blob = createTsjBlob(state, filename);
  downloadBlob(blob, filename);
}

export async function saveTilesetTsjToHandle(
  handle: FileSystemFileHandle,
  state: ProjectState,
  filename = "tileset.tsj",
): Promise<void> {
  const blob = createTsjBlob(state, filename);
  const writable = await handle.createWritable();

  try {
    await writable.write(blob);
  } finally {
    await writable.close();
  }
}

export async function saveTilesetTsjWithPicker(
  state: ProjectState,
  suggestedName = "tileset.tsj",
): Promise<FileSystemFileHandle | null> {
  if (!window.showSaveFilePicker) {
    exportTilesetTsj(state, suggestedName);
    return null;
  }

  const handle = await window.showSaveFilePicker({
    excludeAcceptAllOption: false,
    suggestedName,
    types: [
      {
        description: "TSJ tileset",
        accept: {
          "application/json": [".tsj"],
        },
      },
    ],
  });

  await saveTilesetTsjToHandle(handle, state, suggestedName);
  return handle;
}

function createTsjBlob(state: ProjectState, filename: string): Blob {
  const outputGrid = getOutputGridMetrics(state.project);
  const tsj = {
    name: filename.replace(/\.tsj$/i, ""),
    tilewidth: state.project.tileWidth,
    tileheight: state.project.tileHeight,
    tilecount: outputGrid.columns * outputGrid.rows,
    columns: outputGrid.columns,
    image: "tileset.png",
    imagewidth: state.project.outputWidth,
    imageheight: state.project.outputHeight,
    margin: 0,
    spacing: 0,
    tiles: state.project.tiles.map((tile) => ({
      id: tile.id,
      properties: [
        { name: "name", type: "string", value: tile.name },
        { name: "tags", type: "string", value: tile.tags.join(",") },
        { name: "collision", type: "string", value: tile.collision },
      ],
    })),
  };

  return new Blob([JSON.stringify(tsj, null, 2)], { type: "application/json" });
}

function drawExportTile(
  context: CanvasRenderingContext2D,
  tile: TilePlacement,
  image: HTMLImageElement,
  tileWidth: number,
  tileHeight: number,
): void {
  const cellX = tile.destCol * tileWidth;
  const cellY = tile.destRow * tileHeight;
  const drawX = tile.pixelSnap ? Math.round(cellX + tile.offsetX) : cellX + tile.offsetX;
  const drawY = tile.pixelSnap ? Math.round(cellY + tile.offsetY) : cellY + tile.offsetY;
  const drawWidth = tile.pixelSnap ? Math.round(tile.sourceRect.w * tile.scaleX) : tile.sourceRect.w * tile.scaleX;
  const drawHeight = tile.pixelSnap ? Math.round(tile.sourceRect.h * tile.scaleY) : tile.sourceRect.h * tile.scaleY;

  context.save();
  context.beginPath();
  context.rect(cellX, cellY, tileWidth, tileHeight);
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
    context.fillRect(cellX, cellY, tileWidth, tileHeight);
    context.globalCompositeOperation = "source-over";
  }

  context.restore();
}

function buildTileFilter(tile: TilePlacement): string {
  const brightness = Math.max(0, 1 + tile.brightness);
  return `brightness(${brightness}) contrast(${tile.contrast}) saturate(${tile.saturation})`;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to generate export blob."));
        return;
      }

      resolve(blob);
    }, type);
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}
