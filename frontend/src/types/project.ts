export type ProjectState = {
  project: TilejamProject;
  sourceImageAsset: SourceImageAssetState;
  session: SessionState;
};

export type TilejamProject = {
  version: number;
  sourceImage: string | null;
  workingImage: string | null;
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
  selectedSceneCell: GridCoordinate | null;
  hoveredPanel: WorkspacePanel | null;
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
  flipX: boolean;
  flipY: boolean;
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
  data: number[];
};
