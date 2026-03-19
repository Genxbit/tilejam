import type { ProjectState } from "../types/project";

export function createProjectState(): ProjectState {
  return {
    project: {
      version: 1,
      sourceImage: null,
      workingImage: null,
      sourceTileWidth: 32,
      sourceTileHeight: 32,
      tileWidth: 32,
      tileHeight: 32,
      outputWidth: 1024,
      outputHeight: 1024,
      tiles: [],
      scene: null,
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
      projectDirectoryHandle: null,
      projectBaseUrl: null,
      workingImageFileName: null,
      workingImageFileHandle: null,
      sceneFileName: null,
      sceneFileHandle: null,
      activeWorkspaceMode: "tilesheet",
      activeSceneLayerId: null,
      sourceSelection: null,
      draftSourceSelection: null,
      hoveredOutputTile: null,
      selectedOutputTileId: null,
      selectedSceneCell: null,
      hoveredPanel: null,
      sourceCamera: {
        zoom: 1,
        panX: 0,
        panY: 0,
      },
      outputCamera: {
        zoom: 1,
        panX: 0,
        panY: 0,
      },
      sourceImageAssetCache: {},
      renderRevision: 0,
    },
  };
}
