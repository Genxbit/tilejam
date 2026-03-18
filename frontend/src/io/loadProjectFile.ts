import type { SourceRect, TilePlacement, TilejamProject } from "../types/project";

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
  return JSON.stringify(project, null, 2);
}

function parseTilejamProject(value: unknown): TilejamProject {
  if (!isRecord(value)) {
    throw new Error("Project file must contain a JSON object.");
  }

  return {
    version: readPositiveInteger(value.version, "version"),
    sourceImage: readNullableString(value.sourceImage, "sourceImage"),
    sourceTileWidth: readOptionalTileSize(value.sourceTileWidth, value.tileWidth, "sourceTileWidth"),
    sourceTileHeight: readOptionalTileSize(value.sourceTileHeight, value.tileHeight, "sourceTileHeight"),
    tileWidth: readTileSize(value.tileWidth, "tileWidth"),
    tileHeight: readTileSize(value.tileHeight, "tileHeight"),
    outputWidth: readOutputDimension(value.outputWidth, value.columns, value.tileWidth, "outputWidth"),
    outputHeight: readOutputDimension(value.outputHeight, value.rows, value.tileHeight, "outputHeight"),
    tiles: readTiles(value.tiles),
  };
}

function readTiles(value: unknown): TilePlacement[] {
  if (!Array.isArray(value)) {
    throw new Error("tiles must be an array.");
  }

  return value.map((entry, index) => parseTile(entry, index));
}

function parseTile(value: unknown, index: number): TilePlacement {
  if (!isRecord(value)) {
    throw new Error(`tiles[${index}] must be an object.`);
  }

  return {
    id: readNonNegativeInteger(value.id, `tiles[${index}].id`),
    destCol: readNonNegativeInteger(value.destCol, `tiles[${index}].destCol`),
    destRow: readNonNegativeInteger(value.destRow, `tiles[${index}].destRow`),
    sourceRect: parseSourceRect(value.sourceRect, `tiles[${index}].sourceRect`),
    offsetX: readNumber(value.offsetX, `tiles[${index}].offsetX`),
    offsetY: readNumber(value.offsetY, `tiles[${index}].offsetY`),
    scaleX: readPositiveNumber(value.scaleX, `tiles[${index}].scaleX`),
    scaleY: readPositiveNumber(value.scaleY, `tiles[${index}].scaleY`),
    flipX: readBoolean(value.flipX, `tiles[${index}].flipX`),
    flipY: readBoolean(value.flipY, `tiles[${index}].flipY`),
    name: readString(value.name, `tiles[${index}].name`),
    tags: readStringArray(value.tags, `tiles[${index}].tags`),
    collision: readString(value.collision, `tiles[${index}].collision`),
  };
}

function parseSourceRect(value: unknown, path: string): SourceRect {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object.`);
  }

  return {
    x: readNonNegativeInteger(value.x, `${path}.x`),
    y: readNonNegativeInteger(value.y, `${path}.y`),
    w: readPositiveInteger(value.w, `${path}.w`),
    h: readPositiveInteger(value.h, `${path}.h`),
  };
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

function readNonNegativeInteger(value: unknown, path: string): number {
  const result = readInteger(value, path);

  if (result < 0) {
    throw new Error(`${path} must be 0 or greater.`);
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

function readStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw new Error(`${path} must be an array of strings.`);
  }

  return value;
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
