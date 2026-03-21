import type { SceneLayerState, SceneMapState } from "../types/project";
import { createSceneLayer } from "../systems/sceneSystem";

export async function loadSceneFile(file: File): Promise<SceneMapState> {
  return parseTmj(await file.text());
}

export async function loadSceneFromUrl(url: string): Promise<SceneMapState> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load scene from ${url}.`);
  }

  return parseTmj(await response.text());
}

export async function loadSceneFromHandle(handle: FileSystemFileHandle): Promise<{ file: File; scene: SceneMapState }> {
  const file = await handle.getFile();
  const scene = await loadSceneFile(file);
  return { file, scene };
}

export function serializeScene(scene: SceneMapState): string {
  const json = JSON.stringify({
    type: "map",
    version: "1.10",
    tiledversion: "1.10.2",
    orientation: "orthogonal",
    renderorder: "right-down",
    width: scene.width,
    height: scene.height,
    tilewidth: scene.tileWidth,
    tileheight: scene.tileHeight,
    infinite: false,
    layers: scene.layers.map((layer) => (
      layer.type === "imagelayer"
        ? {
          id: layer.id,
          name: layer.name,
          type: "imagelayer",
          visible: layer.visible,
          opacity: layer.opacity,
          offsetx: layer.offsetX,
          offsety: layer.offsetY,
          parallaxx: layer.parallaxX,
          parallaxy: layer.parallaxY,
          repeatx: layer.repeatX,
          repeaty: layer.repeatY,
          image: layer.image,
        }
        : {
          id: layer.id,
          name: layer.name,
          type: "tilelayer",
          width: scene.width,
          height: scene.height,
          visible: layer.visible,
          opacity: layer.opacity,
          offsetx: layer.offsetX,
          offsety: layer.offsetY,
          parallaxx: layer.parallaxX,
          parallaxy: layer.parallaxY,
          data: layer.data,
        }
    )),
    tilesets: [
      {
        firstgid: 1,
        source: scene.tilesetSource,
      },
    ],
  }, null, 2);

  return compactTileLayerDataArrays(json);
}

export async function saveSceneToHandle(handle: FileSystemFileHandle, scene: SceneMapState): Promise<void> {
  const writable = await handle.createWritable();

  try {
    await writable.write(serializeScene(scene));
  } finally {
    await writable.close();
  }
}

export async function saveSceneWithPicker(
  scene: SceneMapState,
  suggestedName = "scene.tmj",
): Promise<FileSystemFileHandle | null> {
  if (!window.showSaveFilePicker) {
    downloadSceneFile(scene, suggestedName);
    return null;
  }

  const handle = await window.showSaveFilePicker({
    excludeAcceptAllOption: false,
    suggestedName,
    types: [
      {
        description: "Tiled JSON map",
        accept: {
          "application/json": [".tmj"],
        },
      },
    ],
  });

  await saveSceneToHandle(handle, scene);
  return handle;
}

export function downloadSceneFile(scene: SceneMapState, filename = "scene.tmj"): void {
  const blob = new Blob([serializeScene(scene)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function parseTmj(text: string): SceneMapState {
  const value = JSON.parse(text) as unknown;

  if (!isRecord(value)) {
    throw new Error("TMJ file must contain a JSON object.");
  }

  if (value.type !== "map") {
    throw new Error("TMJ file must have type \"map\".");
  }

  if (value.orientation !== "orthogonal") {
    throw new Error("Tilejam currently supports only orthogonal TMJ maps.");
  }

  if (value.infinite !== false) {
    throw new Error("Tilejam currently supports only finite TMJ maps.");
  }

  const width = readPositiveInteger(value.width, "width");
  const height = readPositiveInteger(value.height, "height");
  const tileWidth = readPositiveInteger(value.tilewidth, "tilewidth");
  const tileHeight = readPositiveInteger(value.tileheight, "tileheight");
  const tilesets = readTilesets(value.tilesets);
  const layers = readLayers(value.layers, width, height);

  return {
    width,
    height,
    tileWidth,
    tileHeight,
    tilesetSource: tilesets[0]?.source ?? "tileset.tsj",
    layers: layers.length > 0 ? layers : [createSceneLayer(1, "ground", width, height)],
  };
}

function readTilesets(value: unknown): Array<{ firstgid: number; source: string }> {
  if (!Array.isArray(value)) {
    throw new Error("tilesets must be an array.");
  }

  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`tilesets[${index}] must be an object.`);
    }

    return {
      firstgid: readPositiveInteger(entry.firstgid, `tilesets[${index}].firstgid`),
      source: readString(entry.source, `tilesets[${index}].source`),
    };
  });
}

function readLayers(value: unknown, width: number, height: number): SceneLayerState[] {
  if (!Array.isArray(value)) {
    throw new Error("layers must be an array.");
  }

  return value
    .filter((entry): entry is Record<string, unknown> =>
      isRecord(entry) && (entry.type === "tilelayer" || entry.type === "imagelayer"))
    .map((entry, index) => {
      if (entry.type === "imagelayer") {
        return {
          id: readPositiveInteger(entry.id, `layers[${index}].id`),
          name: readString(entry.name, `layers[${index}].name`),
          type: "imagelayer",
          visible: readOptionalBoolean(entry.visible, true, `layers[${index}].visible`),
          opacity: readOptionalNumber(entry.opacity, 1, `layers[${index}].opacity`),
          offsetX: readOptionalNumber(entry.offsetx, 0, `layers[${index}].offsetx`),
          offsetY: readOptionalNumber(entry.offsety, 0, `layers[${index}].offsety`),
          parallaxX: readOptionalNumber(entry.parallaxx, 1, `layers[${index}].parallaxx`),
          parallaxY: readOptionalNumber(entry.parallaxy, 1, `layers[${index}].parallaxy`),
          repeatX: readOptionalBoolean(entry.repeatx, false, `layers[${index}].repeatx`),
          repeatY: readOptionalBoolean(entry.repeaty, false, `layers[${index}].repeaty`),
          image: readString(entry.image, `layers[${index}].image`),
        };
      }

      const layerWidth = readPositiveInteger(entry.width, `layers[${index}].width`);
      const layerHeight = readPositiveInteger(entry.height, `layers[${index}].height`);
      const data = readIntegerArray(entry.data, `layers[${index}].data`);

      if (layerWidth !== width || layerHeight !== height) {
        throw new Error(`layers[${index}] dimensions must match scene width and height.`);
      }

      if (data.length !== width * height) {
        throw new Error(`layers[${index}].data length must equal width * height.`);
      }

      return {
        id: readPositiveInteger(entry.id, `layers[${index}].id`),
        name: readString(entry.name, `layers[${index}].name`),
        type: "tilelayer",
        width,
        height,
        visible: readOptionalBoolean(entry.visible, true, `layers[${index}].visible`),
        opacity: readOptionalNumber(entry.opacity, 1, `layers[${index}].opacity`),
        offsetX: readOptionalNumber(entry.offsetx, 0, `layers[${index}].offsetx`),
        offsetY: readOptionalNumber(entry.offsety, 0, `layers[${index}].offsety`),
        parallaxX: readOptionalNumber(entry.parallaxx, 1, `layers[${index}].parallaxx`),
        parallaxY: readOptionalNumber(entry.parallaxy, 1, `layers[${index}].parallaxy`),
        data,
      };
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new Error(`${path} must be a string.`);
  }

  return value;
}

function readPositiveInteger(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${path} must be a positive integer.`);
  }

  return value;
}

function readIntegerArray(value: unknown, path: string): number[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "number" && Number.isInteger(entry) && entry >= 0)) {
    throw new Error(`${path} must be an array of non-negative integers.`);
  }

  return value;
}

function readOptionalBoolean(value: unknown, fallback: boolean, path: string): boolean {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${path} must be a boolean.`);
  }

  return value;
}

function readOptionalNumber(value: unknown, fallback: number, path: string): number {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${path} must be a number.`);
  }

  return value;
}

function compactTileLayerDataArrays(json: string): string {
  return json.replace(
    /"data": \[\n([\s\S]*?)\n\s*\]/g,
    (match, valuesBlock) => {
      const values = valuesBlock
        .split(",")
        .map((entry: string) => entry.trim())
        .filter((entry: string) => entry.length > 0);

      if (values.length === 0) {
        return "\"data\": []";
      }

      return `"data": [${values.join(", ")}]`;
    },
  );
}
