import type { ProjectState } from "../types/project";

export function createProjectState(): ProjectState {
  return {
    project: {
      version: 1,
      sourceImage: null,
      tileWidth: 32,
      tileHeight: 32,
      columns: 4,
      rows: 2,
      tiles: [],
    },
    sourceImageAsset: {
      image: null,
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
