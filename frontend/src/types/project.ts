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
  selectedOutputCells: GridCoordinate[];
  outputTileClipboard: OutputTileClipboard | null;
  sceneClipboard: SceneClipboard | null;
  tileMultiEditMode: "individual" | "group";
  tileLayoutPreview: TileLayoutPreview | null;
  dragMovePreview: GroupTransformPreview | null;
  groupTransformPreview: GroupTransformPreview | null;
  groupOffsetX: number;
  groupOffsetY: number;
  groupScaleX: number;
  groupScaleY: number;
  groupStretchLeft: number;
  groupStretchRight: number;
  groupStretchTop: number;
  groupStretchBottom: number;
  selectedSceneCell: GridCoordinate | null;
  selectedSceneCells: GridCoordinate[];
  hoveredPanel: WorkspacePanel | null;
  tilePreviewMode: TilePreviewMode;
  showSceneGrid: boolean;
  scenePreviewPointer: { x: number; y: number } | null;
  fillTileColor: string;
  colorReplaceSourceColor: string;
  colorReplaceTargetMode: ColorReplaceTargetMode;
  colorReplaceTargetColor: string;
  colorReplaceTolerance: number;
  seamRepairDirection: SeamDirection;
  seamRepairStripWidth: number;
  seamRepairFalloff: number;
  seamRepairMode: SeamRepairMode;
  seamRepairReference: SeamRepairReference;
  seamRepairStrength: number;
  seamRepairQuantize: boolean;
  seamRepairPreserveContrast: boolean;
  seamRepairContinueRamp: boolean;
  seamRepairPreview: boolean;
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

export type SelectionBounds = {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
};

export type GroupTransformPreview = {
  selectionSignature: string;
  renderRevision: number;
  bounds: SelectionBounds;
  canvas: HTMLCanvasElement;
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  flipX: boolean;
  flipY: boolean;
};

export type TileLayoutPreview = {
  selectionSignature: string;
  renderRevision: number;
  primaryTileId: number | null;
  patch: Partial<Pick<TilePlacement, "destCol" | "destRow" | "offsetX" | "offsetY" | "scaleX" | "scaleY" | "flipX" | "flipY">>;
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

export type OutputTileClipboard = {
  width: number;
  height: number;
  anchorCol: number;
  anchorRow: number;
  tiles: OutputTileClipboardEntry[];
};

export type OutputTileClipboardEntry = {
  colOffset: number;
  rowOffset: number;
  tile: TilePlacement;
};

export type SceneClipboard = {
  width: number;
  height: number;
  cells: SceneClipboardEntry[];
};

export type SceneClipboardEntry = {
  colOffset: number;
  rowOffset: number;
  gid: number;
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
export type ColorReplaceTargetMode = "transparent" | "color";
export type SeamDirection = "left" | "right" | "top" | "bottom";
export type SeamRepairMode = "full" | "luminance" | "chroma";
export type SeamRepairReference = "balanced" | "primary" | "neighbor";

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

export type SceneLayerType = "tilelayer" | "imagelayer";

export type SceneLayerBaseState = {
  id: number;
  name: string;
  type: SceneLayerType;
  visible: boolean;
  opacity: number;
  offsetX: number;
  offsetY: number;
  parallaxX: number;
  parallaxY: number;
};

export type SceneTileLayerState = SceneLayerBaseState & {
  type: "tilelayer";
  width: number;
  height: number;
  data: number[];
};

export type SceneImageLayerState = SceneLayerBaseState & {
  type: "imagelayer";
  image: string;
  repeatX: boolean;
  repeatY: boolean;
};

export type SceneLayerState = SceneTileLayerState | SceneImageLayerState;
