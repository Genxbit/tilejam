import type { ProjectState } from "../types/project";

export async function loadSourceImageFromUrl(
  state: ProjectState,
  url: string,
  name: string,
): Promise<void> {
  const image = await loadImage(url);
  cacheSourceImage(state, name, image, null);
  setActiveSourceImage(state, name);
}

export async function loadSourceImageFromFile(state: ProjectState, file: File): Promise<void> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    cacheSourceImage(state, file.name, image, objectUrl);
    setActiveSourceImage(state, file.name);
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export function clearSourceImageAsset(state: ProjectState): void {
  state.project.sourceImage = null;
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
