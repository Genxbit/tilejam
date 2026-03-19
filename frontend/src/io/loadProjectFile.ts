import type { TilejamProject } from "../types/project";
import { parseSceneJson } from "./sceneJsonShared";

export async function loadProjectFile(file: File): Promise<TilejamProject> {
  const text = await file.text();
  const value = parseJson(text);

  return parseTilejamProject(value);
}

export async function loadProjectFromHandle(handle: FileSystemFileHandle): Promise<{
  file: File;
  project: TilejamProject;
}> {
  const file = await handle.getFile();
  const project = await loadProjectFile(file);

  return { file, project };
}

export async function loadProjectFromUrl(url: string): Promise<TilejamProject> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load project from ${url}.`);
  }

  const text = await response.text();
  const value = parseJson(text);

  return parseTilejamProject(value);
}

export function serializeProject(project: TilejamProject): string {
  return JSON.stringify(createPersistedProject(project), null, 2);
}

function parseTilejamProject(value: unknown): TilejamProject {
  if (!isRecord(value)) {
    throw new Error("Project file must contain a JSON object.");
  }

  const sourceImage = readNullableString(value.sourceImage, "sourceImage");

  return {
    version: readPositiveInteger(value.version, "version"),
    sourceImage,
    workingImage: readOptionalNullableString(value.workingImage, null, "workingImage"),
    sourceTileWidth: readOptionalTileSize(value.sourceTileWidth, value.tileWidth, "sourceTileWidth"),
    sourceTileHeight: readOptionalTileSize(value.sourceTileHeight, value.tileHeight, "sourceTileHeight"),
    tileWidth: readTileSize(value.tileWidth, "tileWidth"),
    tileHeight: readTileSize(value.tileHeight, "tileHeight"),
    outputWidth: readOutputDimension(value.outputWidth, value.columns, value.tileWidth, "outputWidth"),
    outputHeight: readOutputDimension(value.outputHeight, value.rows, value.tileHeight, "outputHeight"),
    tiles: [],
    scene: value.scene === undefined || value.scene === null ? null : parseSceneJson(value.scene, "scene"),
  };
}

function createPersistedProject(project: TilejamProject): {
  version: number;
  sourceImage: string | null;
  workingImage: string | null;
  sourceTileWidth: TilejamProject["sourceTileWidth"];
  sourceTileHeight: TilejamProject["sourceTileHeight"];
  tileWidth: TilejamProject["tileWidth"];
  tileHeight: TilejamProject["tileHeight"];
  outputWidth: number;
  outputHeight: number;
  scene?: TilejamProject["scene"];
} {
  const persistedProject: {
    version: number;
    sourceImage: string | null;
    workingImage: string | null;
    sourceTileWidth: TilejamProject["sourceTileWidth"];
    sourceTileHeight: TilejamProject["sourceTileHeight"];
    tileWidth: TilejamProject["tileWidth"];
    tileHeight: TilejamProject["tileHeight"];
    outputWidth: number;
    outputHeight: number;
    scene?: TilejamProject["scene"];
  } = {
    version: project.version,
    sourceImage: project.sourceImage,
    workingImage: project.workingImage,
    sourceTileWidth: project.sourceTileWidth,
    sourceTileHeight: project.sourceTileHeight,
    tileWidth: project.tileWidth,
    tileHeight: project.tileHeight,
    outputWidth: project.outputWidth,
    outputHeight: project.outputHeight,
  };

  if (project.scene) {
    persistedProject.scene = project.scene;
  }

  return persistedProject;
}

function readTileSize(value: unknown, path: string): 8 | 16 | 32 | 64 {
  const size = readNumber(value, path);

  if (size !== 8 && size !== 16 && size !== 32 && size !== 64) {
    throw new Error(`${path} must be 8, 16, 32, or 64.`);
  }

  return size;
}

function readOptionalTileSize(value: unknown, fallbackValue: unknown, path: string): 8 | 16 | 32 | 64 {
  if (value === undefined) {
    return readTileSize(fallbackValue, path);
  }

  return readTileSize(value, path);
}

function readOutputDimension(
  value: unknown,
  fallbackGridCount: unknown,
  tileSize: unknown,
  path: string,
): number {
  if (value === undefined) {
    return readPositiveInteger(fallbackGridCount, path.replace("output", "").toLowerCase()) * readTileSize(tileSize, `${path}.tileSize`);
  }

  return readPositiveInteger(value, path);
}

function readString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new Error(`${path} must be a string.`);
  }

  return value;
}

function readNullableString(value: unknown, path: string): string | null {
  if (value === null) {
    return null;
  }

  return readString(value, path);
}

function readNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${path} must be a number.`);
  }

  return value;
}

function readInteger(value: unknown, path: string): number {
  const result = readNumber(value, path);

  if (!Number.isInteger(result)) {
    throw new Error(`${path} must be an integer.`);
  }

  return result;
}

function readPositiveInteger(value: unknown, path: string): number {
  const result = readInteger(value, path);

  if (result <= 0) {
    throw new Error(`${path} must be greater than 0.`);
  }

  return result;
}

function readPositiveNumber(value: unknown, path: string): number {
  const result = readNumber(value, path);

  if (result <= 0) {
    throw new Error(`${path} must be greater than 0.`);
  }

  return result;
}

function readBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${path} must be a boolean.`);
  }

  return value;
}

function readOptionalNullableString(value: unknown, fallback: string | null, path: string): string | null {
  if (value === undefined) {
    return fallback;
  }

  return readNullableString(value, path);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Project file must contain valid JSON.");
  }
}
