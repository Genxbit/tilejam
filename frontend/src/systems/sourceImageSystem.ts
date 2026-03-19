import type { ProjectState } from "../types/project";

export async function loadSourceImageFromUrl(
  state: ProjectState,
  url: string,
  name: string,
): Promise<void> {
  await loadImageAssetFromUrl(state, url, name);
  setActiveSourceImage(state, name);
}

export async function loadSourceImageFromFile(state: ProjectState, file: File): Promise<void> {
  const name = await loadImageAssetFromFile(state, file);
  setActiveSourceImage(state, name);
}

export async function loadSourceImageFromFileWithRef(
  state: ProjectState,
  file: File,
  reference: string,
): Promise<void> {
  await loadImageAssetFromFile(state, file, reference);
  setActiveSourceImage(state, reference);
}

export function ensureActiveSourceImageFromProject(state: ProjectState): void {
  const projectRef = state.project.sourceImage;

  if (!projectRef) {
    return;
  }

  if (state.session.sourceImageAssetCache[projectRef]) {
    setActiveSourceImage(state, projectRef);
    return;
  }

  const refBasename = getBasename(projectRef);
  const matchingKey = Object.keys(state.session.sourceImageAssetCache).find((key) => getBasename(key) === refBasename);

  if (matchingKey) {
    setActiveSourceImage(state, matchingKey);
    state.project.sourceImage = projectRef;
  }
}

function getBasename(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  const segments = normalized.split("/");
  return segments[segments.length - 1] || value;
}

export async function loadImageAssetFromUrl(
  state: ProjectState,
  url: string,
  name: string,
): Promise<string> {
  const image = await loadImage(url);
  cacheSourceImage(state, name, image, null);
  return name;
}

export async function loadImageAssetFromFile(
  state: ProjectState,
  file: File,
  name = file.name,
): Promise<string> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    cacheSourceImage(state, name, image, objectUrl);
    return name;
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export function clearSourceImageAsset(state: ProjectState): void {
  state.sourceImageAsset.image = null;
  state.sourceImageAsset.name = null;
  state.sourceImageAsset.width = 0;
  state.sourceImageAsset.height = 0;
  state.sourceImageAsset.objectUrl = null;
}

export function getSourceImageForRef(state: ProjectState, sourceImageRef: string | null): HTMLImageElement | null {
  if (!sourceImageRef) {
    return null;
  }

  return state.session.sourceImageAssetCache[sourceImageRef]?.image ?? null;
}

export function getResolvedSourceImageAsset(state: ProjectState): {
  image: HTMLImageElement | null;
  name: string | null;
  width: number;
  height: number;
} {
  if (state.sourceImageAsset.image) {
    return {
      image: state.sourceImageAsset.image,
      name: state.sourceImageAsset.name,
      width: state.sourceImageAsset.width,
      height: state.sourceImageAsset.height,
    };
  }

  const projectRef = state.project.sourceImage;

  if (!projectRef) {
    return {
      image: null,
      name: null,
      width: 0,
      height: 0,
    };
  }

  const directAsset = state.session.sourceImageAssetCache[projectRef];

  if (directAsset) {
    return {
      image: directAsset.image,
      name: directAsset.name,
      width: directAsset.width,
      height: directAsset.height,
    };
  }

  const refBasename = getBasename(projectRef);
  const matchingKey = Object.keys(state.session.sourceImageAssetCache).find((key) => getBasename(key) === refBasename);
  const matchingAsset = matchingKey ? state.session.sourceImageAssetCache[matchingKey] : null;

  if (matchingAsset) {
    return {
      image: matchingAsset.image,
      name: projectRef,
      width: matchingAsset.width,
      height: matchingAsset.height,
    };
  }

  return {
    image: null,
    name: projectRef,
    width: 0,
    height: 0,
  };
}

function setActiveSourceImage(state: ProjectState, name: string): void {
  const cachedAsset = state.session.sourceImageAssetCache[name];

  if (!cachedAsset) {
    return;
  }

  state.project.sourceImage = name;
  state.sourceImageAsset.image = cachedAsset.image;
  state.sourceImageAsset.name = cachedAsset.name;
  state.sourceImageAsset.width = cachedAsset.width;
  state.sourceImageAsset.height = cachedAsset.height;
  state.sourceImageAsset.objectUrl = cachedAsset.objectUrl;
}

function cacheSourceImage(state: ProjectState, name: string, image: HTMLImageElement, objectUrl: string | null): void {
  const existingAsset = state.session.sourceImageAssetCache[name];

  if (existingAsset?.objectUrl && existingAsset.objectUrl !== objectUrl) {
    URL.revokeObjectURL(existingAsset.objectUrl);
  }

  state.session.sourceImageAssetCache[name] = {
    image,
    name,
    width: image.width,
    height: image.height,
    objectUrl,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}
