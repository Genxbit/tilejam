import type { SceneLayerState, SceneMapState } from "../types/project";

export function parseSceneJson(value: unknown, path: string): SceneMapState {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object.`);
  }

  const width = readPositiveInteger(value.width, `${path}.width`);
  const height = readPositiveInteger(value.height, `${path}.height`);
  const tileWidth = readPositiveInteger(value.tileWidth, `${path}.tileWidth`);
  const tileHeight = readPositiveInteger(value.tileHeight, `${path}.tileHeight`);
  const layers = readSceneLayers(value.layers, width, height, `${path}.layers`);

  return {
    width,
    height,
    tileWidth,
    tileHeight,
    tilesetSource: readOptionalString(value.tilesetSource, "tileset.tsj", `${path}.tilesetSource`),
    layers,
  };
}

function readSceneLayers(value: unknown, width: number, height: number, path: string): SceneLayerState[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array.`);
  }

  return value.map((entry, index) => {
    const layerPath = `${path}[${index}]`;

    if (!isRecord(entry)) {
      throw new Error(`${layerPath} must be an object.`);
    }

    const data = readIntegerArray(entry.data, `${layerPath}.data`);

    if (data.length !== width * height) {
      throw new Error(`${layerPath}.data length must equal width * height.`);
    }

    return {
      id: readPositiveInteger(entry.id, `${layerPath}.id`),
      name: readString(entry.name, `${layerPath}.name`),
      width,
      height,
      visible: readOptionalBoolean(entry.visible, true, `${layerPath}.visible`),
      opacity: readOptionalNumber(entry.opacity, 1, `${layerPath}.opacity`),
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

function readOptionalString(value: unknown, fallback: string, path: string): string {
  if (value === undefined) {
    return fallback;
  }

  return readString(value, path);
}

function readPositiveInteger(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${path} must be a positive integer.`);
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

function readIntegerArray(value: unknown, path: string): number[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "number" && Number.isInteger(entry) && entry >= 0)) {
    throw new Error(`${path} must be an array of non-negative integers.`);
  }

  return value;
}
