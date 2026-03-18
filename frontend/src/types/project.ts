export type ProjectState = {
  project: TilejamProject;
  sourceImageAsset: SourceImageAssetState;
  session: SessionState;
};

export type TilejamProject = {
  version: number;
  sourceImage: string | null;
  tileWidth: 8 | 16 | 32;
  tileHeight: 8 | 16 | 32;
  columns: number;
  rows: number;
  tiles: TilePlacement[];
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
};

export type TilePlacement = {
  id: number;
  destCol: number;
  destRow: number;
  sourceRect: SourceRect;
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  flipX: boolean;
  flipY: boolean;
  name: string;
  tags: string[];
  collision: string;
};

export type SourceRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};
