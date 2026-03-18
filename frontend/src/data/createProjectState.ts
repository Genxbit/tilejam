import type { ProjectState } from "../types/project";

export function createProjectState(): ProjectState {
  return {
    project: {
      version: 1,
      sourceImage: null,
      sourceTileWidth: 32,
      sourceTileHeight: 32,
      tileWidth: 32,
      tileHeight: 32,
      outputWidth: 1024,
      outputHeight: 1024,
      tiles: [],
    },
    sourceImageAsset: {
      image: null,
      name: null,
      width: 0,
      height: 0,
      objectUrl: null,
    },
    session: {
      message: "The bundled sample image is loaded on startup so the canvas stays immediately visible.",
      projectFileName: null,
      projectFileHandle: null,
    },
  };
}
