import type { ProjectState, SourceRect, TilePlacement, TilejamProject } from "../types/project";

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

export function applyProjectData(state: ProjectState, project: TilejamProject): void {
  state.project = project;
}

export function serializeProject(project: TilejamProject): string {
  return JSON.stringify(project, null, 2);
}

function parseTilejamProject(value: unknown): TilejamProject {
  if (!isRecord(value)) {
    throw new Error("Project file must contain a JSON object.");
  }

  return {
    version: readNumber(value.version, "version"),
    sourceImage: readNullableString(value.sourceImage, "sourceImage"),
    tileWidth: readTileSize(value.tileWidth, "tileWidth"),
    tileHeight: readTileSize(value.tileHeight, "tileHeight"),
    columns: readNumber(value.columns, "columns"),
    rows: readNumber(value.rows, "rows"),
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
    id: readNumber(value.id, `tiles[${index}].id`),
    destCol: readNumber(value.destCol, `tiles[${index}].destCol`),
    destRow: readNumber(value.destRow, `tiles[${index}].destRow`),
    sourceRect: parseSourceRect(value.sourceRect, `tiles[${index}].sourceRect`),
    offsetX: readNumber(value.offsetX, `tiles[${index}].offsetX`),
    offsetY: readNumber(value.offsetY, `tiles[${index}].offsetY`),
    scaleX: readNumber(value.scaleX, `tiles[${index}].scaleX`),
    scaleY: readNumber(value.scaleY, `tiles[${index}].scaleY`),
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
    x: readNumber(value.x, `${path}.x`),
    y: readNumber(value.y, `${path}.y`),
    w: readNumber(value.w, `${path}.w`),
    h: readNumber(value.h, `${path}.h`),
  };
}

function readTileSize(value: unknown, path: string): 8 | 16 | 32 {
  const size = readNumber(value, path);

  if (size !== 8 && size !== 16 && size !== 32) {
    throw new Error(`${path} must be 8, 16, or 32.`);
  }

  return size;
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
