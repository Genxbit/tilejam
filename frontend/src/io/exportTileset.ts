import type { ProjectState, TilePlacement } from "../types/project";
import { getSourceImageForRef } from "../systems/sourceImageSystem";
import { drawTileIntoRect } from "../systems/tileRenderSystem";
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
  const imageName = getTsjImageName(state, filename);
  const tiles = state.project.tiles
    .map((tile) => {
      const properties = [];

      if (tile.name.trim() !== `tile_${tile.id}`) {
        properties.push({ name: "name", type: "string", value: tile.name });
      }

      if (tile.tags.length > 0) {
        properties.push({ name: "tags", type: "string", value: tile.tags.join(",") });
      }

      if (tile.collision !== "none") {
        properties.push({ name: "collision", type: "string", value: tile.collision });
      }

      if (properties.length < 1) {
        return null;
      }

      return {
        id: tile.id,
        properties,
      };
    })
    .filter((tile): tile is { id: number; properties: { name: string; type: string; value: string }[] } => tile !== null);
  const tsj = {
    name: filename.replace(/\.tsj$/i, ""),
    tilewidth: state.project.tileWidth,
    tileheight: state.project.tileHeight,
    tilecount: outputGrid.columns * outputGrid.rows,
    columns: outputGrid.columns,
    image: imageName,
    imagewidth: state.project.outputWidth,
    imageheight: state.project.outputHeight,
    margin: 0,
    spacing: 0,
    tiles,
  };

  return new Blob([JSON.stringify(tsj, null, 2)], { type: "application/json" });
}

function getTsjImageName(state: ProjectState, filename: string): string {
  const workingImageRef = state.session.workingImageFileName ?? state.project.workingImage;

  if (workingImageRef && workingImageRef.trim().length > 0) {
    return getBaseName(workingImageRef);
  }

  return filename.replace(/\.tsj$/i, ".png");
}

function getBaseName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function drawExportTile(
  context: CanvasRenderingContext2D,
  tile: TilePlacement,
  image: HTMLImageElement,
  tileWidth: number,
  tileHeight: number,
): void {
  drawTileIntoRect(context, image, tile, tile.destCol * tileWidth, tile.destRow * tileHeight, tileWidth, tileHeight);
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
