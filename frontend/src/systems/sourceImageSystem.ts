import type { ProjectState } from "../types/project";

export async function loadSourceImageFromUrl(
  state: ProjectState,
  url: string,
  name: string,
): Promise<void> {
  releaseObjectUrl(state);

  const image = await loadImage(url);
  state.project.sourceImage = name;
  state.sourceImageAsset.image = image;
  state.sourceImageAsset.name = name;
  state.sourceImageAsset.width = image.width;
  state.sourceImageAsset.height = image.height;
}

export async function loadSourceImageFromFile(state: ProjectState, file: File): Promise<void> {
  releaseObjectUrl(state);

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    state.project.sourceImage = file.name;
    state.sourceImageAsset.image = image;
    state.sourceImageAsset.name = file.name;
    state.sourceImageAsset.width = image.width;
    state.sourceImageAsset.height = image.height;
    state.sourceImageAsset.objectUrl = objectUrl;
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export function clearSourceImageAsset(state: ProjectState): void {
  releaseObjectUrl(state);
  state.sourceImageAsset.image = null;
  state.sourceImageAsset.name = null;
  state.sourceImageAsset.width = 0;
  state.sourceImageAsset.height = 0;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

function releaseObjectUrl(state: ProjectState): void {
  if (state.sourceImageAsset.objectUrl) {
    URL.revokeObjectURL(state.sourceImageAsset.objectUrl);
    state.sourceImageAsset.objectUrl = null;
  }
}
