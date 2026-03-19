export type ProjectState = {
  project: TilejamProject;
  sourceImageAsset: SourceImageAssetState;
  session: SessionState;
};

export type TilejamProject = {
  version: number;
  sourceImage: string | null;
  workingImage: string | null;
  sceneFile: string | null;
  sourceTileWidth: TileSize;
  sourceTileHeight: TileSize;
  tileWidth: TileSize;
  tileHeight: TileSize;
  outputWidth: number;
  outputHeight: number;
  tiles: TilePlacement[];
  scene: SceneMapState | null;
};

export type SourceImageAssetState = {
  image: HTMLImageElement | null;
  name: string | null;
  width: number;
  height: number;
  objectUrl: string | null;
};

export type SessionState = {
  message: string | null;
  projectFileName: string | null;
  projectFileHandle: FileSystemFileHandle | null;
  projectDirectoryHandle: FileSystemDirectoryHandle | null;
  projectBaseUrl: string | null;
  workingImageFileName: string | null;
  workingImageFileHandle: FileSystemFileHandle | null;
  sceneFileName: string | null;
  sceneFileHandle: FileSystemFileHandle | null;
  activeWorkspaceMode: WorkspaceMode;
  activeSceneLayerId: number | null;
  sourceSelection: SourceSelection | null;
  draftSourceSelection: SourceSelection | null;
  hoveredOutputTile: GridCoordinate | null;
  selectedOutputTileId: number | null;
  selectedOutputTileIds: number[];
  selectedSceneCell: GridCoordinate | null;
  hoveredPanel: WorkspacePanel | null;
  tilePreviewMode: TilePreviewMode;
  sourceCamera: CameraState;
  outputCamera: CameraState;
  sourceImageAssetCache: Record<string, CachedSourceImageAsset>;
  renderRevision: number;
};

export type TileSize = 8 | 16 | 32 | 64;

export type GridCoordinate = {
  col: number;
  row: number;
};

export type WorkspacePanel = "source" | "output";
export type WorkspaceMode = "tilesheet" | "scene";

export type CameraState = {
  zoom: number;
  panX: number;
  panY: number;
};

export type SourceSelection = {
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
  columns: number;
  rows: number;
  sourceRect: SourceRect;
};

export type TilePlacement = {
  id: number;
  destCol: number;
  destRow: number;
  sourceImageRef: string | null;
  sourceRect: SourceRect;
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  fitMode: TileFitMode;
  anchorX: TileAnchorX;
  anchorY: TileAnchorY;
  cropLeft: number;
  cropRight: number;
  cropTop: number;
  cropBottom: number;
  clampToTile: boolean;
  edgeStretchLeft: number;
  edgeStretchRight: number;
  edgeStretchTop: number;
  edgeStretchBottom: number;
  edgeExtend: boolean;
  fillExposedColor: string | null;
  flipX: boolean;
  flipY: boolean;
  rotationQuarterTurns: 0 | 1 | 2 | 3;
  brightness: number;
  contrast: number;
  saturation: number;
  tintColor: string | null;
  filterMode: TileFilterMode;
  pixelSnap: boolean;
  name: string;
  tags: string[];
  collision: string;
};

export type TileFilterMode = "nearest" | "linear";
export type TileFitMode = "manual" | "stretch" | "contain";
export type TileAnchorX = "left" | "center" | "right";
export type TileAnchorY = "top" | "center" | "bottom";
export type TilePreviewMode = "none" | "repeat" | "neighbors";

export type CachedSourceImageAsset = {
  image: HTMLImageElement;
  name: string;
  width: number;
  height: number;
  objectUrl: string | null;
};

export type SourceRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type SceneMapState = {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  tilesetSource: string;
  layers: SceneLayerState[];
};

export type SceneLayerState = {
  id: number;
  name: string;
  width: number;
  height: number;
  visible: boolean;
  opacity: number;
  offsetX: number;
  offsetY: number;
  parallaxX: number;
  parallaxY: number;
  data: number[];
};
