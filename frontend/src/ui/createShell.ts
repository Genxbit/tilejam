import type {
  ColorReplaceTargetMode,
  ProjectState,
  SceneLayerType,
  SeamDirection,
  SeamRepairMode,
  SeamRepairReference,
  TileAnchorX,
  TileAnchorY,
  TileFitMode,
  TilePreviewMode,
  WorkspaceMode,
} from "../types/project";
import { getSelectedOutputTile, getSelectedOutputTiles } from "../systems/tileEditorSystem";
import { getOutputGridMetrics, getProjectIndexRange, getProjectPixelSize, getProjectTileCount, TILE_SIZE_OPTIONS } from "../systems/tileGridSystem";
import { getAssignedTileCount } from "../systems/tilePlacementSystem";
import { getActiveSceneLayer } from "../systems/sceneSystem";
import { getVisibleSelection } from "../systems/selectionSystem";
import { createTileEditorSection, type SelectedTilePatch } from "./createTileEditorSection";

type ShellOptions = {
  root: HTMLElement;
  state: ProjectState;
  onFileSelected: (file: File) => Promise<void>;
  onOpenSource: () => Promise<boolean>;
  onDismissBrowserWorkflowNotice: () => void;
  onNewProject: () => void;
  onProjectSelected: (file: File) => Promise<void>;
  onOpenProject: () => Promise<boolean>;
  onSaveProject: () => Promise<void>;
  onWorkingImageSelected: (file: File) => Promise<void>;
  onOpenWorkingImage: () => Promise<boolean>;
  onSaveWorkingImage: () => Promise<void>;
  onNewTilesheet: () => void;
  onExportTsj: () => Promise<void>;
  onSceneSelected: (file: File) => Promise<void>;
  onOpenScene: () => Promise<boolean>;
  onSaveScene: () => Promise<void>;
  onNewScene: () => void;
  onClearScene: () => void;
  onCopySceneSelection: () => void;
  onPasteSceneSelection: () => void;
  onDeleteSceneSelection: () => void;
  onMoveSceneSelection: (deltaCol: number, deltaRow: number) => void;
  onWorkspaceModeChanged: (mode: WorkspaceMode) => void;
  onSourceGridSizeChanged: (tileSize: 8 | 16 | 32 | 64) => void;
  onOutputTileSizeChanged: (tileSize: 8 | 16 | 32 | 64) => void;
  onOutputWidthChanged: (width: number) => void;
  onOutputHeightChanged: (height: number) => void;
  onSceneWidthChanged: (width: number) => void;
  onSceneHeightChanged: (height: number) => void;
  onSceneTilesetSourceChanged: (tilesetSource: string) => void;
  onSceneLayerChanged: (layerId: number) => void;
  onSceneLayerAdded: (type: SceneLayerType) => void;
  onSceneLayerImageSelected: (file: File) => Promise<void>;
  onOpenSceneLayerImage: () => Promise<boolean>;
  onSceneLayerUpdated: (patch: {
    name?: string;
    type?: SceneLayerType;
    visible?: boolean;
    opacity?: number;
    offsetX?: number;
    offsetY?: number;
    parallaxX?: number;
    parallaxY?: number;
    image?: string;
    repeatX?: boolean;
    repeatY?: boolean;
  }) => void;
  onSceneLayerMoved: (delta: -1 | 1) => void;
  onSceneGridVisibilityChanged: (visible: boolean) => void;
  onTileMultiEditModeChanged: (mode: "individual" | "group") => void;
  onSelectedTileUpdated: (patch: SelectedTilePatch) => Promise<void>;
  onPreviewTileLayoutUpdated: (patch: SelectedTilePatch) => void;
  onApplyTileLayoutPreview: () => Promise<void>;
  onCancelTileLayoutPreview: () => void;
  onNudgeSelectedTile: (deltaX: number, deltaY: number) => Promise<void>;
  onGroupScaleXChanged: (value: number) => void;
  onGroupScaleYChanged: (value: number) => void;
  onApplyGroupScale: () => Promise<void>;
  onCancelGroupTransform: () => void;
  onGroupStretchUpdated: (patch: {
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
  }) => void;
  onApplyGroupStretch: () => Promise<void>;
  onSetSelectedTileFitMode: (fitMode: TileFitMode) => void;
  onAlignSelectedTile: (anchorX: TileAnchorX, anchorY: TileAnchorY) => void;
  onSnapSelectedTileToEdges: () => void;
  onBakeSelectedTileEdgeExtend: () => Promise<void>;
  onRotateSelectedTile: (delta: 1 | -1) => void;
  onTrimSelectedTileTransparent: () => void;
  onTilePreviewModeChanged: (previewMode: TilePreviewMode) => void;
  onFillTileColorChanged: (color: string) => void;
  onApplyTileFill: () => Promise<void>;
  onColorReplaceSourceColorChanged: (color: string) => void;
  onColorReplaceTargetModeChanged: (mode: ColorReplaceTargetMode) => void;
  onColorReplaceTargetColorChanged: (color: string) => void;
  onColorReplaceToleranceChanged: (tolerance: number) => void;
  onApplyColorReplace: () => Promise<void>;
  onSeamRepairDirectionChanged: (direction: SeamDirection) => void;
  onSeamRepairStripWidthChanged: (width: number) => void;
  onSeamRepairFalloffChanged: (falloff: number) => void;
  onSeamRepairModeChanged: (mode: SeamRepairMode) => void;
  onSeamRepairReferenceChanged: (reference: SeamRepairReference) => void;
  onSeamRepairStrengthChanged: (strength: number) => void;
  onSeamRepairQuantizeChanged: (enabled: boolean) => void;
  onSeamRepairPreserveContrastChanged: (enabled: boolean) => void;
  onSeamRepairContinueRampChanged: (enabled: boolean) => void;
  onSeamRepairPreviewChanged: (enabled: boolean) => void;
  onApplySeamRepair: () => Promise<void>;
  onCopySelectedTiles: () => void;
  onPasteSelectedTiles: () => void;
  onMoveSelectedTiles: (deltaCol: number, deltaRow: number) => void;
  onClearSelectedTile: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopyAllTiles: () => void;
  onClearAllTiles: () => void;
  onDismissUnresolvedResources: () => void;
  onResolveUnresolvedResource: (id: string, file: File) => Promise<void>;
};

type Shell = {
  canvas: HTMLCanvasElement;
  update: (state: ProjectState) => void;
};

type WorkspaceTab = "tilesheet" | "scene";
type TilesheetSubTab = "sheet" | "tile";
type SceneSubTab = "map" | "layers" | "selection";

export function createShell({
  root,
  state,
  onFileSelected,
  onOpenSource,
  onDismissBrowserWorkflowNotice,
  onNewProject,
  onProjectSelected,
  onOpenProject,
  onSaveProject,
  onWorkingImageSelected,
  onOpenWorkingImage,
  onSaveWorkingImage,
  onNewTilesheet,
  onExportTsj,
  onSceneSelected,
  onOpenScene,
  onSaveScene,
  onNewScene,
  onClearScene,
  onCopySceneSelection,
  onPasteSceneSelection,
  onDeleteSceneSelection,
  onMoveSceneSelection,
  onWorkspaceModeChanged,
  onSourceGridSizeChanged,
  onOutputTileSizeChanged,
  onOutputWidthChanged,
  onOutputHeightChanged,
  onSceneWidthChanged,
  onSceneHeightChanged,
  onSceneTilesetSourceChanged,
  onSceneLayerChanged,
  onSceneLayerAdded,
  onSceneLayerImageSelected,
  onOpenSceneLayerImage,
  onSceneLayerUpdated,
  onSceneLayerMoved,
  onSceneGridVisibilityChanged,
  onTileMultiEditModeChanged,
  onSelectedTileUpdated,
  onPreviewTileLayoutUpdated,
  onApplyTileLayoutPreview,
  onCancelTileLayoutPreview,
  onNudgeSelectedTile,
  onGroupScaleXChanged,
  onGroupScaleYChanged,
  onApplyGroupScale,
  onCancelGroupTransform,
  onGroupStretchUpdated,
  onApplyGroupStretch,
  onSetSelectedTileFitMode,
  onAlignSelectedTile,
  onSnapSelectedTileToEdges,
  onBakeSelectedTileEdgeExtend,
  onRotateSelectedTile,
  onTrimSelectedTileTransparent,
  onTilePreviewModeChanged,
  onFillTileColorChanged,
  onApplyTileFill,
  onColorReplaceSourceColorChanged,
  onColorReplaceTargetModeChanged,
  onColorReplaceTargetColorChanged,
  onColorReplaceToleranceChanged,
  onApplyColorReplace,
  onSeamRepairDirectionChanged,
  onSeamRepairStripWidthChanged,
  onSeamRepairFalloffChanged,
  onSeamRepairModeChanged,
  onSeamRepairReferenceChanged,
  onSeamRepairStrengthChanged,
  onSeamRepairQuantizeChanged,
  onSeamRepairPreserveContrastChanged,
  onSeamRepairContinueRampChanged,
  onSeamRepairPreviewChanged,
  onApplySeamRepair,
  onCopySelectedTiles,
  onPasteSelectedTiles,
  onMoveSelectedTiles,
  onClearSelectedTile,
  onUndo,
  onRedo,
  onCopyAllTiles,
  onClearAllTiles,
  onDismissUnresolvedResources,
  onResolveUnresolvedResource,
}: ShellOptions): Shell {
  root.innerHTML = "";

  const appFrame = document.createElement("div");
  appFrame.className = "app-frame";

  const topBar = document.createElement("header");
  topBar.className = "top-bar";

  const topBarBrand = document.createElement("div");
  topBarBrand.className = "top-bar-brand";

  const topBarTitle = document.createElement("h1");
  topBarTitle.className = "top-bar-title";
  topBarTitle.textContent = "Tilejam";

  const topBarProject = document.createElement("p");
  topBarProject.className = "top-bar-project";
  topBarProject.textContent = `Project: ${getDisplayFileLabel(state.session.projectFileName ?? "unsaved")}`;
  topBarBrand.append(topBarTitle, topBarProject);

  const browserNotice = document.createElement("div");
  browserNotice.className = "browser-notice";
  const browserNoticeText = document.createElement("p");
  browserNoticeText.className = "browser-notice-text";
  browserNoticeText.textContent = "Chrome or Edge gives the smoothest project open/save workflow. This browser may require manual relinking of project and scene files.";
  const browserNoticeDismiss = createActionButton("Dismiss", onDismissBrowserWorkflowNotice);
  browserNoticeDismiss.classList.add("browser-notice-dismiss");
  browserNotice.append(browserNoticeText, browserNoticeDismiss);
  browserNotice.hidden = state.session.browserWorkflowNoticeDismissed || isChromiumBrowser();

  const appShell = document.createElement("div");
  appShell.className = "app-shell";

  const workspace = document.createElement("section");
  workspace.className = "workspace";

  const canvasWrap = document.createElement("div");
  canvasWrap.className = "canvas-wrap";

  const canvas = document.createElement("canvas");
  canvas.className = "workspace-canvas";
  canvas.setAttribute("aria-label", "Source image workspace");

  canvasWrap.append(canvas);
  workspace.append(canvasWrap);

  const panel = document.createElement("aside");
  panel.className = "sidebar";
  panel.tabIndex = -1;

  const inputLabel = document.createElement("label");
  inputLabel.className = "file-input";
  inputLabel.textContent = "Open source";

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    await onFileSelected(file);
    input.value = "";
  });

  inputLabel.append(input);

  inputLabel.addEventListener("click", async (event) => {
    const handled = await onOpenSource();

    if (handled) {
      event.preventDefault();
    }
  });

  const projectInputButton = document.createElement("label");
  projectInputButton.className = "file-input file-input-secondary";
  projectInputButton.textContent = "Open project";

  const projectInput = document.createElement("input");
  projectInput.type = "file";
  projectInput.accept = ".tilejam.json,.json";
  projectInput.addEventListener("change", async () => {
    const file = projectInput.files?.[0];

    if (!file) {
      return;
    }

    await onProjectSelected(file);
    projectInput.value = "";
  });

  projectInputButton.append(projectInput);
  projectInputButton.addEventListener("click", async (event) => {
    const handled = await onOpenProject();

    if (handled) {
      event.preventDefault();
    }
  });

  const saveProjectButton = document.createElement("button");
  saveProjectButton.type = "button";
  saveProjectButton.className = "file-input file-input-secondary";
  saveProjectButton.textContent = "Save project";
  saveProjectButton.addEventListener("click", async () => {
    await onSaveProject();
  });

  const workingImageInputLabel = document.createElement("label");
  workingImageInputLabel.className = "file-input file-input-secondary";
  workingImageInputLabel.textContent = "Open tilesheet";

  const workingImageInput = document.createElement("input");
  workingImageInput.type = "file";
  workingImageInput.accept = "image/png,image/*";
  workingImageInput.addEventListener("change", async () => {
    const file = workingImageInput.files?.[0];

    if (!file) {
      return;
    }

    await onWorkingImageSelected(file);
    workingImageInput.value = "";
  });

  workingImageInputLabel.append(workingImageInput);

  workingImageInputLabel.addEventListener("click", async (event) => {
    const handled = await onOpenWorkingImage();

    if (handled) {
      event.preventDefault();
    }
  });

  const saveWorkingImageButton = document.createElement("button");
  saveWorkingImageButton.type = "button";
  saveWorkingImageButton.className = "file-input file-input-secondary";
  saveWorkingImageButton.textContent = "Save tilesheet";
  saveWorkingImageButton.addEventListener("click", async () => {
    await onSaveWorkingImage();
  });

  const historyActions = document.createElement("div");
  historyActions.className = "top-bar-actions";
  const newProjectButton = createActionButton("New project", onNewProject);
  const undoButton = createActionButton("Undo", onUndo);
  const redoButton = createActionButton("Redo", onRedo);
  historyActions.append(newProjectButton, projectInputButton, saveProjectButton, undoButton, redoButton);
  topBar.append(topBarBrand, historyActions);

  const fileActions = document.createElement("div");
  fileActions.className = "panel-actions";
  const newTilesheetButton = createActionButton("New", onNewTilesheet);
  const exportTsjButton = createAsyncActionButton("Export TSJ", onExportTsj);
  fileActions.append(inputLabel, workingImageInputLabel, saveWorkingImageButton, newTilesheetButton, exportTsjButton);

  const actionsSection = createControlSection("Files & Export", "Open the source and working sheet, then save or export from the same place.");
  actionsSection.append(fileActions);

  const editingActions = document.createElement("div");
  editingActions.className = "panel-actions";
  const copyAllButton = createActionButton("Copy All Tiles", onCopyAllTiles);
  const clearAllTilesButton = createActionButton("Clear All", onClearAllTiles);
  editingActions.append(copyAllButton, clearAllTilesButton);

  const historySection = createControlSection("Sheet Actions", "Bulk actions for the current working tilesheet.");
  historySection.append(editingActions);

  const sceneInputLabel = document.createElement("label");
  sceneInputLabel.className = "file-input file-input-secondary";
  sceneInputLabel.textContent = "Open scene";

  const sceneInput = document.createElement("input");
  sceneInput.type = "file";
  sceneInput.accept = ".tmj,application/json";
  sceneInput.addEventListener("change", async () => {
    const file = sceneInput.files?.[0];

    if (!file) {
      return;
    }

    await onSceneSelected(file);
    sceneInput.value = "";
  });
  sceneInputLabel.append(sceneInput);
  sceneInputLabel.addEventListener("click", async (event) => {
    const handled = await onOpenScene();

    if (handled) {
      event.preventDefault();
    }
  });

  const saveSceneButton = document.createElement("button");
  saveSceneButton.type = "button";
  saveSceneButton.className = "file-input file-input-secondary";
  saveSceneButton.textContent = "Save scene";
  saveSceneButton.addEventListener("click", async () => {
    await onSaveScene();
  });

  const sourceGridField = document.createElement("label");
  sourceGridField.className = "field-group";

  const sourceGridLabel = document.createElement("span");
  sourceGridLabel.className = "field-label";
  sourceGridLabel.textContent = "Source grid";

  const sourceGridSelect = document.createElement("select");
  sourceGridSelect.className = "tile-size-select";
  TILE_SIZE_OPTIONS.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = `${option}`;
    optionElement.textContent = `${option} x ${option}`;
    optionElement.selected = option === state.project.sourceTileWidth;
    sourceGridSelect.append(optionElement);
  });
  sourceGridSelect.addEventListener("change", () => {
    const tileSize = Number.parseInt(sourceGridSelect.value, 10);

    if (tileSize === 8 || tileSize === 16 || tileSize === 32 || tileSize === 64) {
      onSourceGridSizeChanged(tileSize);
    }
  });

  sourceGridField.append(sourceGridLabel, sourceGridSelect);

  const outputTileField = document.createElement("label");
  outputTileField.className = "field-group";

  const outputTileLabel = document.createElement("span");
  outputTileLabel.className = "field-label";
  outputTileLabel.textContent = "Output tile";

  const outputTileSelect = document.createElement("select");
  outputTileSelect.className = "tile-size-select";
  TILE_SIZE_OPTIONS.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = `${option}`;
    optionElement.textContent = `${option} x ${option}`;
    optionElement.selected = option === state.project.tileWidth;
    outputTileSelect.append(optionElement);
  });
  outputTileSelect.addEventListener("change", () => {
    const tileSize = Number.parseInt(outputTileSelect.value, 10);

    if (tileSize === 8 || tileSize === 16 || tileSize === 32 || tileSize === 64) {
      onOutputTileSizeChanged(tileSize);
    }
  });

  outputTileField.append(outputTileLabel, outputTileSelect);

  const outputGridField = document.createElement("div");
  outputGridField.className = "field-group";

  const outputGridLabel = document.createElement("span");
  outputGridLabel.className = "field-label";
  outputGridLabel.textContent = "Output image";

  const outputGridInputs = document.createElement("div");
  outputGridInputs.className = "grid-inputs";

  const widthField = createLabeledNumberField("Width", state.project.outputWidth, "Output width");
  const widthInput = widthField.input;
  widthInput.addEventListener("change", () => {
    onOutputWidthChanged(Math.max(1, Number.parseInt(widthInput.value, 10) || 1));
  });

  const heightField = createLabeledNumberField("Height", state.project.outputHeight, "Output height");
  const heightInput = heightField.input;
  heightInput.addEventListener("change", () => {
    onOutputHeightChanged(Math.max(1, Number.parseInt(heightInput.value, 10) || 1));
  });

  outputGridInputs.append(widthField.field, heightField.field);
  outputGridField.append(outputGridLabel, outputGridInputs);

  const setupSection = createControlSection("Sheet Setup", "Set the source grid, output size, and exported tile size together.");
  const controls = document.createElement("div");
  controls.className = "grid-controls";

  const derivedGridField = document.createElement("div");
  derivedGridField.className = "field-group";

  const derivedGridLabel = document.createElement("span");
  derivedGridLabel.className = "field-label";
  derivedGridLabel.textContent = "Derived grid";

  const derivedGridValue = document.createElement("div");
  derivedGridValue.className = "derived-value";
  const initialGrid = getOutputGridMetrics(state.project);
  derivedGridValue.textContent = `${initialGrid.columns} columns x ${initialGrid.rows} rows`;

  const derivedGridNote = document.createElement("p");
  derivedGridNote.className = "field-note";
  derivedGridNote.textContent = "Calculated automatically from output image size and output tile size.";

  derivedGridField.append(derivedGridLabel, derivedGridValue, derivedGridNote);

  const selectedTile = getSelectedOutputTile(state);
  const selectedTiles = getSelectedOutputTiles(state);
  const selectedSceneLayer = getActiveSceneLayer(state);
  let activeWorkspaceTab: WorkspaceTab = state.session.activeWorkspaceMode === "scene" ? "scene" : "tilesheet";
  let activeTilesheetSubTab: TilesheetSubTab = selectedTiles.length > 0 ? "tile" : "sheet";
  let activeSceneSubTab: SceneSubTab = "map";
  const tileEditor = createTileEditorSection(state, {
    onSelectedTileUpdated,
    onPreviewTileLayoutUpdated,
    onApplyTileLayoutPreview,
    onCancelTileLayoutPreview,
    onTileMultiEditModeChanged,
    onMoveSelectedTiles,
    onNudgeSelectedTile,
    onGroupScaleXChanged,
    onGroupScaleYChanged,
    onApplyGroupScale,
    onCancelGroupTransform,
    onGroupStretchUpdated,
    onApplyGroupStretch,
    onSetSelectedTileFitMode,
    onAlignSelectedTile,
    onSnapSelectedTileToEdges,
    onBakeSelectedTileEdgeExtend,
    onRotateSelectedTile,
    onTrimSelectedTileTransparent,
    onTilePreviewModeChanged,
    onFillTileColorChanged,
    onApplyTileFill,
    onColorReplaceSourceColorChanged,
    onColorReplaceTargetModeChanged,
    onColorReplaceTargetColorChanged,
    onColorReplaceToleranceChanged,
    onApplyColorReplace,
    onSeamRepairDirectionChanged,
    onSeamRepairStripWidthChanged,
    onSeamRepairFalloffChanged,
    onSeamRepairModeChanged,
    onSeamRepairReferenceChanged,
    onSeamRepairStrengthChanged,
    onSeamRepairQuantizeChanged,
    onSeamRepairPreserveContrastChanged,
    onSeamRepairContinueRampChanged,
    onSeamRepairPreviewChanged,
    onApplySeamRepair,
    onCopySelectedTiles,
    onPasteSelectedTiles,
    onClearSelectedTile,
  });
  const editorSection = tileEditor.section;

  const metadata = document.createElement("dl");
  metadata.className = "meta-grid";
  const outputPixels = getProjectPixelSize(state.project);
  const outputGrid = getOutputGridMetrics(state.project);

  const items = [
    ["Source", state.project.sourceImage ?? state.sourceImageAsset.name ?? "Not loaded"],
    ["Working PNG", state.project.workingImage ?? state.session.workingImageFileName ?? "Not loaded"],
    ["Resolution", `${state.sourceImageAsset.width} x ${state.sourceImageAsset.height}`],
    ["Source grid", `${state.project.sourceTileWidth} x ${state.project.sourceTileHeight}`],
    [
      "Selection",
      getVisibleSelection(state)
        ? `${getVisibleSelection(state)?.columns} x ${getVisibleSelection(state)?.rows} source tiles`
        : "None",
    ],
    ["Output tile", `${state.project.tileWidth} x ${state.project.tileHeight}`],
    ["Output grid", `${outputGrid.columns} columns x ${outputGrid.rows} rows`],
    ["Output image", `${outputPixels.width} x ${outputPixels.height}`],
    ["Assigned tiles", `${getAssignedTileCount(state)}`],
    ["Grid capacity", `${getProjectTileCount(state.project)}`],
    ["Tile IDs", getProjectIndexRange(state.project)],
    ["Selected tile", selectedTile ? `${selectedTile.id}` : "None"],
  ].map(([label, value]) => createMetaItem(label, value));

  items.forEach((item) => metadata.append(item.term, item.description));

  controls.append(sourceGridField, outputGridField, outputTileField, derivedGridField);
  setupSection.append(controls);
  const tilesheetPanelContent = document.createElement("div");
  tilesheetPanelContent.className = "sidebar-section-stack";
  const sheetStatusSection = createControlSection("Status", "Quick sheet summary.");
  sheetStatusSection.classList.add("compact-section");
  sheetStatusSection.append(metadata);
  tilesheetPanelContent.append(actionsSection, setupSection, historySection, sheetStatusSection);

  const workspaceTabs = document.createElement("div");
  workspaceTabs.className = "sidebar-tabs";
  const tilesheetTab = createSidebarTabButton("Tilesheet");
  const sceneTab = createSidebarTabButton("Scene");
  workspaceTabs.append(tilesheetTab, sceneTab);

  const tilesheetWorkspacePanel = document.createElement("div");
  tilesheetWorkspacePanel.className = "sidebar-tab-panel";
  const tilesheetSubTabs = document.createElement("div");
  tilesheetSubTabs.className = "sidebar-subtabs";
  const tilesheetSheetTab = createSidebarTabButton("Sheet");
  const tilesheetTileTab = createSidebarTabButton("Tile");
  tilesheetSubTabs.append(tilesheetSheetTab, tilesheetTileTab);

  const tilesheetSheetPanel = document.createElement("div");
  tilesheetSheetPanel.className = "sidebar-tab-panel";
  tilesheetSheetPanel.append(tilesheetPanelContent);

  const tilesheetTilePanel = document.createElement("div");
  tilesheetTilePanel.className = "sidebar-tab-panel";
  tilesheetTilePanel.append(editorSection);

  tilesheetWorkspacePanel.append(tilesheetSubTabs, tilesheetSheetPanel, tilesheetTilePanel);

  const sceneWorkspacePanel = document.createElement("div");
  sceneWorkspacePanel.className = "sidebar-tab-panel";
  const sceneSubTabs = document.createElement("div");
  sceneSubTabs.className = "sidebar-subtabs";
  const sceneMapTab = createSidebarTabButton("Map");
  const sceneLayersTab = createSidebarTabButton("Layers");
  const sceneSelectionTab = createSidebarTabButton("Selection");
  sceneSubTabs.append(sceneMapTab, sceneLayersTab, sceneSelectionTab);

  const sceneMapPanel = document.createElement("div");
  sceneMapPanel.className = "sidebar-tab-panel";
  const sceneMapSection = createControlSection(
    "Scene Setup",
    "Open, size, preview, and relink the scene from one compact setup area.",
  );
  const sceneActions = document.createElement("div");
  sceneActions.className = "panel-actions";
  const sceneTilesheetButton = createAsyncActionButton("Open tilesheet", async () => {
    const handled = await onOpenWorkingImage();

    if (!handled) {
      workingImageInput.click();
    }
  });
  const newSceneButton = createActionButton("New", onNewScene);
  const clearSceneButton = createActionButton("Clear All", onClearScene);
  sceneActions.append(sceneTilesheetButton, sceneInputLabel, saveSceneButton, newSceneButton, clearSceneButton);

  const sceneSelectionPanel = document.createElement("div");
  sceneSelectionPanel.className = "sidebar-tab-panel";
  const sceneSelectionSection = createControlSection(
    "Selection Actions",
    "Work with the current scene selection.",
  );
  const sceneEditActions = document.createElement("div");
  sceneEditActions.className = "panel-actions";
  const sceneCopyButton = createActionButton("Copy", onCopySceneSelection);
  const scenePasteButton = createActionButton("Paste", onPasteSceneSelection);
  const sceneDeleteButton = createActionButton("Delete", onDeleteSceneSelection);
  scenePasteButton.disabled = !state.session.sceneClipboard;
  sceneEditActions.append(sceneCopyButton, scenePasteButton, sceneDeleteButton);

  const sceneMoveActions = document.createElement("div");
  sceneMoveActions.className = "panel-actions";
  sceneMoveActions.append(
    createActionButton("Left", () => { onMoveSceneSelection(-1, 0); }),
    createActionButton("Right", () => { onMoveSceneSelection(1, 0); }),
    createActionButton("Up", () => { onMoveSceneSelection(0, -1); }),
    createActionButton("Down", () => { onMoveSceneSelection(0, 1); }),
  );

  const sceneSizeInputs = document.createElement("div");
  sceneSizeInputs.className = "grid-inputs";
  const sceneWidthField = createLabeledNumberField("Width", state.project.scene?.width ?? 32, "Scene width", 1, 1);
  const sceneHeightField = createLabeledNumberField("Height", state.project.scene?.height ?? 32, "Scene height", 1, 1);
  sceneWidthField.input.addEventListener("change", () => {
    onSceneWidthChanged(Math.max(1, Number.parseInt(sceneWidthField.input.value, 10) || 1));
  });
  sceneHeightField.input.addEventListener("change", () => {
    onSceneHeightChanged(Math.max(1, Number.parseInt(sceneHeightField.input.value, 10) || 1));
  });
  sceneSizeInputs.append(sceneWidthField.field, sceneHeightField.field);

  const sceneTilesetField = document.createElement("label");
  sceneTilesetField.className = "field-group";
  const sceneTilesetLabel = document.createElement("span");
  sceneTilesetLabel.className = "field-label";
  sceneTilesetLabel.textContent = "Tileset source";
  const sceneTilesetInput = document.createElement("input");
  sceneTilesetInput.type = "text";
  sceneTilesetInput.className = "grid-number-input";
  sceneTilesetInput.value = state.project.scene?.tilesetSource ?? "tileset.tsj";
  sceneTilesetInput.addEventListener("change", () => {
    onSceneTilesetSourceChanged(sceneTilesetInput.value);
  });
  sceneTilesetField.append(sceneTilesetLabel, sceneTilesetInput);

  const sceneLayersPanel = document.createElement("div");
  sceneLayersPanel.className = "sidebar-tab-panel";
  const sceneLayerStackSection = createControlSection(
    "Layer Stack",
    "Choose the active layer, add new ones, and reorder the stack.",
  );
  const sceneLayerRow = document.createElement("div");
  sceneLayerRow.className = "panel-actions";
  const sceneLayerSelect = document.createElement("select");
  sceneLayerSelect.className = "tile-size-select";
  for (const layer of state.project.scene?.layers ?? []) {
    const option = document.createElement("option");
    option.value = `${layer.id}`;
    option.textContent = layer.name;
    option.selected = layer.id === selectedSceneLayer?.id;
    sceneLayerSelect.append(option);
  }
  sceneLayerSelect.addEventListener("change", () => {
    onSceneLayerChanged(Number.parseInt(sceneLayerSelect.value, 10));
  });
  const addLayerButton = createActionButton("Add Layer", () => {
    onSceneLayerAdded("tilelayer");
  });
  const moveLayerUpButton = createActionButton("Move Up", () => {
    onSceneLayerMoved(-1);
  });
  const moveLayerDownButton = createActionButton("Move Down", () => {
    onSceneLayerMoved(1);
  });
  sceneLayerRow.append(sceneLayerSelect, addLayerButton, moveLayerUpButton, moveLayerDownButton);

  const sceneLayerNameField = createLabeledTextField("Layer name", selectedSceneLayer?.name ?? "ground", "Scene layer name");
  sceneLayerNameField.input.addEventListener("change", () => {
    onSceneLayerUpdated({ name: sceneLayerNameField.input.value });
  });

  const sceneLayerTypeField = document.createElement("label");
  sceneLayerTypeField.className = "field-group";
  const sceneLayerTypeLabel = document.createElement("span");
  sceneLayerTypeLabel.className = "field-label";
  sceneLayerTypeLabel.textContent = "Layer type";
  const sceneLayerTypeSelect = document.createElement("select");
  sceneLayerTypeSelect.className = "tile-size-select";
  [
    ["tilelayer", "Tile layer"],
    ["imagelayer", "Image layer"],
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    sceneLayerTypeSelect.append(option);
  });
  sceneLayerTypeSelect.value = selectedSceneLayer?.type ?? "tilelayer";
  sceneLayerTypeSelect.addEventListener("change", () => {
    if (sceneLayerTypeSelect.value === "tilelayer" || sceneLayerTypeSelect.value === "imagelayer") {
      onSceneLayerUpdated({ type: sceneLayerTypeSelect.value });
    }
  });
  sceneLayerTypeField.append(sceneLayerTypeLabel, sceneLayerTypeSelect);

  const sceneLayerSettings = document.createElement("div");
  sceneLayerSettings.className = "grid-inputs";
  const sceneLayerOpacityField = createLabeledNumberField("Opacity", selectedSceneLayer?.opacity ?? 1, "Scene layer opacity", 0, 0.1);
  sceneLayerOpacityField.input.max = "1";
  sceneLayerOpacityField.input.addEventListener("change", () => {
    onSceneLayerUpdated({ opacity: Number.parseFloat(sceneLayerOpacityField.input.value) || 0 });
  });
  const sceneLayerVisibleToggle = createCheckboxField("Visible", selectedSceneLayer?.visible ?? true, (checked) => {
    onSceneLayerUpdated({ visible: checked });
  });
  const sceneLayerVisibleField = document.createElement("div");
  sceneLayerVisibleField.className = "number-field";
  const sceneLayerVisibleLabel = document.createElement("span");
  sceneLayerVisibleLabel.className = "number-field-label";
  sceneLayerVisibleLabel.textContent = "Visibility";
  sceneLayerVisibleField.append(sceneLayerVisibleLabel, sceneLayerVisibleToggle);
  sceneLayerSettings.append(sceneLayerOpacityField.field, sceneLayerVisibleField);

  const sceneLayerTransformSettings = document.createElement("div");
  sceneLayerTransformSettings.className = "grid-inputs";
  const sceneLayerOffsetXField = createLabeledNumberField("Offset X", selectedSceneLayer?.offsetX ?? 0, "Scene layer offset x", undefined, 1);
  const sceneLayerOffsetYField = createLabeledNumberField("Offset Y", selectedSceneLayer?.offsetY ?? 0, "Scene layer offset y", undefined, 1);
  sceneLayerOffsetXField.input.addEventListener("change", () => {
    onSceneLayerUpdated({ offsetX: Number.parseFloat(sceneLayerOffsetXField.input.value) || 0 });
  });
  sceneLayerOffsetYField.input.addEventListener("change", () => {
    onSceneLayerUpdated({ offsetY: Number.parseFloat(sceneLayerOffsetYField.input.value) || 0 });
  });
  sceneLayerTransformSettings.append(sceneLayerOffsetXField.field, sceneLayerOffsetYField.field);

  const sceneLayerParallaxSettings = document.createElement("div");
  sceneLayerParallaxSettings.className = "grid-inputs";
  const sceneLayerParallaxXField = createLabeledNumberField("Parallax X", selectedSceneLayer?.parallaxX ?? 1, "Scene layer parallax x", undefined, 0.1);
  const sceneLayerParallaxYField = createLabeledNumberField("Parallax Y", selectedSceneLayer?.parallaxY ?? 1, "Scene layer parallax y", undefined, 0.1);
  sceneLayerParallaxXField.input.addEventListener("change", () => {
    const value = Number.parseFloat(sceneLayerParallaxXField.input.value);
    onSceneLayerUpdated({ parallaxX: Number.isFinite(value) ? value : 1 });
  });
  sceneLayerParallaxYField.input.addEventListener("change", () => {
    const value = Number.parseFloat(sceneLayerParallaxYField.input.value);
    onSceneLayerUpdated({ parallaxY: Number.isFinite(value) ? value : 1 });
  });
  sceneLayerParallaxSettings.append(sceneLayerParallaxXField.field, sceneLayerParallaxYField.field);

  const sceneLayerSettingsSection = createControlSection(
    "Layer Settings",
    "Adjust the selected layer name, type, visibility, opacity, offset, and parallax.",
  );

  const imageLayerSection = createControlSection(
    "Image Layer",
    "Only shown when the selected layer draws from an image asset.",
  );
  imageLayerSection.classList.add("compact-section");
  const imageLayerControls = document.createElement("div");
  imageLayerControls.className = "editor-stack";

  const imageLayerActions = document.createElement("div");
  imageLayerActions.className = "panel-actions";
  const imageLayerInputButton = createAsyncActionButton("Open image", async () => {
    const handled = await onOpenSceneLayerImage();

    if (!handled) {
      imageLayerInput.click();
    }
  });
  const imageLayerInput = document.createElement("input");
  imageLayerInput.type = "file";
  imageLayerInput.accept = "image/*";
  imageLayerInput.hidden = true;
  imageLayerInput.addEventListener("change", async () => {
    const file = imageLayerInput.files?.[0];

    if (!file) {
      return;
    }

    await onSceneLayerImageSelected(file);
    imageLayerInput.value = "";
  });
  imageLayerActions.append(imageLayerInputButton, imageLayerInput);

  const imageLayerPathField = createLabeledTextField("Image path", selectedSceneLayer?.type === "imagelayer" ? selectedSceneLayer.image : "", "Scene image layer path");
  imageLayerPathField.input.addEventListener("change", () => {
    onSceneLayerUpdated({ image: imageLayerPathField.input.value.trim() });
  });

  const imageLayerRepeats = document.createElement("div");
  imageLayerRepeats.className = "toggle-row";
  const imageLayerRepeatXToggle = createCheckboxField("Repeat X", selectedSceneLayer?.type === "imagelayer" ? selectedSceneLayer.repeatX : false, (checked) => {
    onSceneLayerUpdated({ repeatX: checked });
  });
  const imageLayerRepeatYToggle = createCheckboxField("Repeat Y", selectedSceneLayer?.type === "imagelayer" ? selectedSceneLayer.repeatY : false, (checked) => {
    onSceneLayerUpdated({ repeatY: checked });
  });
  imageLayerRepeats.append(imageLayerRepeatXToggle, imageLayerRepeatYToggle);
  imageLayerControls.append(imageLayerActions, imageLayerPathField.field, imageLayerRepeats);
  imageLayerSection.append(imageLayerControls);
  imageLayerSection.hidden = selectedSceneLayer?.type !== "imagelayer";
  sceneEditActions.hidden = selectedSceneLayer?.type === "imagelayer";
  sceneMoveActions.hidden = selectedSceneLayer?.type === "imagelayer";

  const sceneMapStatus = document.createElement("dl");
  sceneMapStatus.className = "meta-grid compact-meta-grid";
  const sceneMapStatusItems = [
    createMetaItem("Scene", state.project.scene ? `${state.project.scene.width} x ${state.project.scene.height}` : "Not loaded"),
    createMetaItem("Layers", `${state.project.scene?.layers.length ?? 0}`),
    createMetaItem("Active layer", selectedSceneLayer?.name ?? "None"),
    createMetaItem("Selection", `${state.session.selectedSceneCells.length}`),
  ];
  sceneMapStatusItems.forEach((item) => sceneMapStatus.append(item.term, item.description));

  const sceneSelectionStatus = document.createElement("dl");
  sceneSelectionStatus.className = "meta-grid compact-meta-grid";
  const sceneSelectionStatusItems = [
    createMetaItem("Selected cells", `${state.session.selectedSceneCells.length}`),
    createMetaItem("Clipboard", state.session.sceneClipboard ? "Ready" : "Empty"),
    createMetaItem("Active layer", selectedSceneLayer?.name ?? "None"),
  ];
  sceneSelectionStatusItems.forEach((item) => sceneSelectionStatus.append(item.term, item.description));

  const sceneGridToggle = createCheckboxField("Preview", !state.session.showSceneGrid, (checked) => {
    onSceneGridVisibilityChanged(!checked);
  });
  const sceneGridField = document.createElement("div");
  sceneGridField.className = "number-field";
  const sceneGridLabel = document.createElement("span");
  sceneGridLabel.className = "number-field-label";
  sceneGridLabel.textContent = "Scene preview";
  sceneGridField.append(sceneGridLabel, sceneGridToggle);

  sceneMapSection.append(
    sceneActions,
    sceneGridField,
    sceneSizeInputs,
    sceneTilesetField,
    sceneMapStatus,
  );
  sceneMapPanel.append(sceneMapSection);

  sceneLayerStackSection.append(sceneLayerRow);
  sceneLayersPanel.append(sceneLayerStackSection);

  sceneLayerSettingsSection.append(
    sceneLayerNameField.field,
    sceneLayerTypeField,
    sceneLayerSettings,
    sceneLayerTransformSettings,
    sceneLayerParallaxSettings,
  );
  sceneLayersPanel.append(sceneLayerSettingsSection, imageLayerSection);

  sceneSelectionSection.append(
    sceneEditActions,
    sceneMoveActions,
    sceneSelectionStatus,
  );
  sceneSelectionPanel.append(sceneSelectionSection);

  sceneWorkspacePanel.append(sceneSubTabs, sceneMapPanel, sceneLayersPanel, sceneSelectionPanel);

  tilesheetTab.addEventListener("click", () => {
    activeWorkspaceTab = "tilesheet";
    onWorkspaceModeChanged("tilesheet");
    syncWorkspaceTabState(activeWorkspaceTab, tilesheetTab, sceneTab, tilesheetWorkspacePanel, sceneWorkspacePanel);
  });
  sceneTab.addEventListener("click", () => {
    activeWorkspaceTab = "scene";
    onWorkspaceModeChanged("scene");
    syncWorkspaceTabState(activeWorkspaceTab, tilesheetTab, sceneTab, tilesheetWorkspacePanel, sceneWorkspacePanel);
  });
  tilesheetSheetTab.addEventListener("click", () => {
    activeTilesheetSubTab = "sheet";
    syncTilesheetSubTabState(activeTilesheetSubTab, tilesheetSheetTab, tilesheetTileTab, tilesheetSheetPanel, tilesheetTilePanel);
  });
  tilesheetTileTab.addEventListener("click", () => {
    activeTilesheetSubTab = "tile";
    syncTilesheetSubTabState(activeTilesheetSubTab, tilesheetSheetTab, tilesheetTileTab, tilesheetSheetPanel, tilesheetTilePanel);
  });
  sceneMapTab.addEventListener("click", () => {
    activeSceneSubTab = "map";
    syncSceneSubTabState(activeSceneSubTab, sceneMapTab, sceneLayersTab, sceneSelectionTab, sceneMapPanel, sceneLayersPanel, sceneSelectionPanel);
  });
  sceneLayersTab.addEventListener("click", () => {
    activeSceneSubTab = "layers";
    syncSceneSubTabState(activeSceneSubTab, sceneMapTab, sceneLayersTab, sceneSelectionTab, sceneMapPanel, sceneLayersPanel, sceneSelectionPanel);
  });
  sceneSelectionTab.addEventListener("click", () => {
    activeSceneSubTab = "selection";
    syncSceneSubTabState(activeSceneSubTab, sceneMapTab, sceneLayersTab, sceneSelectionTab, sceneMapPanel, sceneLayersPanel, sceneSelectionPanel);
  });
  syncWorkspaceTabState(activeWorkspaceTab, tilesheetTab, sceneTab, tilesheetWorkspacePanel, sceneWorkspacePanel);
  syncTilesheetSubTabState(activeTilesheetSubTab, tilesheetSheetTab, tilesheetTileTab, tilesheetSheetPanel, tilesheetTilePanel);
  syncSceneSubTabState(activeSceneSubTab, sceneMapTab, sceneLayersTab, sceneSelectionTab, sceneMapPanel, sceneLayersPanel, sceneSelectionPanel);

  const notes = document.createElement("p");
  notes.className = "panel-note";
  notes.textContent = state.session.message ?? "";

  const resourceDialogOverlay = document.createElement("div");
  resourceDialogOverlay.className = "resource-dialog-overlay";
  resourceDialogOverlay.hidden = state.session.unresolvedResources.length < 1 || !state.session.unresolvedResourceScope;

  const resourceDialog = document.createElement("section");
  resourceDialog.className = "resource-dialog";
  const resourceDialogHeader = document.createElement("div");
  resourceDialogHeader.className = "resource-dialog-header";
  const resourceDialogTitle = document.createElement("h2");
  resourceDialogTitle.className = "control-title";
  resourceDialogTitle.textContent = "Resolve Files";
  const resourceDialogClose = createActionButton("Close", onDismissUnresolvedResources);
  resourceDialogHeader.append(resourceDialogTitle, resourceDialogClose);
  const resourceDialogCopy = document.createElement("p");
  resourceDialogCopy.className = "field-note";
  resourceDialogCopy.textContent = "Choose the missing files to finish loading the current project or scene.";
  const resourceDialogList = document.createElement("div");
  resourceDialogList.className = "resource-dialog-list";
  resourceDialog.append(resourceDialogHeader, resourceDialogCopy, resourceDialogList);
  resourceDialogOverlay.append(resourceDialog);

  panel.append(workspaceTabs, tilesheetWorkspacePanel, sceneWorkspacePanel, notes);
  appShell.append(workspace, panel);
  appFrame.append(topBar, browserNotice, appShell, resourceDialogOverlay);
  root.append(appFrame);

  return {
    canvas,
    update(nextState) {
      const scrollTop = panel.scrollTop;
      activeWorkspaceTab = nextState.session.activeWorkspaceMode === "scene" ? "scene" : "tilesheet";
      topBarProject.textContent = `Project: ${getDisplayFileLabel(nextState.session.projectFileName ?? "unsaved")}`;
      browserNotice.hidden = nextState.session.browserWorkflowNoticeDismissed || isChromiumBrowser();
      items[0].description.textContent = nextState.project.sourceImage ?? nextState.sourceImageAsset.name ?? "Not loaded";
      items[1].description.textContent = nextState.project.workingImage ?? nextState.session.workingImageFileName ?? "Not loaded";
      items[2].description.textContent = `${nextState.sourceImageAsset.width} x ${nextState.sourceImageAsset.height}`;
      items[3].description.textContent = `${nextState.project.sourceTileWidth} x ${nextState.project.sourceTileHeight}`;
      const selection = getVisibleSelection(nextState);
      items[4].description.textContent = selection ? `${selection.columns} x ${selection.rows} source tiles` : "None";
      items[5].description.textContent = `${nextState.project.tileWidth} x ${nextState.project.tileHeight}`;
      const nextOutputGrid = getOutputGridMetrics(nextState.project);
      items[6].description.textContent = `${nextOutputGrid.columns} columns x ${nextOutputGrid.rows} rows`;
      const nextOutputPixels = getProjectPixelSize(nextState.project);
      items[7].description.textContent = `${nextOutputPixels.width} x ${nextOutputPixels.height}`;
      items[8].description.textContent = `${getAssignedTileCount(nextState)}`;
      items[9].description.textContent = `${getProjectTileCount(nextState.project)}`;
      items[10].description.textContent = getProjectIndexRange(nextState.project);
      const nextSelectedTile = getSelectedOutputTile(nextState);
      items[11].description.textContent = nextSelectedTile ? `${nextSelectedTile.id}` : "None";
      tileEditor.update(nextState);
      sourceGridSelect.value = `${nextState.project.sourceTileWidth}`;
      outputTileSelect.value = `${nextState.project.tileWidth}`;
      widthInput.value = `${nextState.project.outputWidth}`;
      heightInput.value = `${nextState.project.outputHeight}`;
      sceneWidthField.input.value = `${nextState.project.scene?.width ?? 32}`;
      sceneHeightField.input.value = `${nextState.project.scene?.height ?? 32}`;
      sceneTilesetInput.value = nextState.project.scene?.tilesetSource ?? "tileset.tsj";
      const nextSceneLayer = getActiveSceneLayer(nextState);
      sceneLayerNameField.input.value = nextSceneLayer?.name ?? "ground";
      sceneLayerTypeSelect.value = nextSceneLayer?.type ?? "tilelayer";
      sceneLayerOpacityField.input.value = `${nextSceneLayer?.opacity ?? 1}`;
      (sceneLayerVisibleToggle.querySelector("input") as HTMLInputElement).checked = nextSceneLayer?.visible ?? true;
      sceneLayerOffsetXField.input.value = `${nextSceneLayer?.offsetX ?? 0}`;
      sceneLayerOffsetYField.input.value = `${nextSceneLayer?.offsetY ?? 0}`;
      sceneLayerParallaxXField.input.value = `${nextSceneLayer?.parallaxX ?? 1}`;
      sceneLayerParallaxYField.input.value = `${nextSceneLayer?.parallaxY ?? 1}`;
      imageLayerPathField.input.value = nextSceneLayer?.type === "imagelayer" ? nextSceneLayer.image : "";
      (imageLayerRepeatXToggle.querySelector("input") as HTMLInputElement).checked = nextSceneLayer?.type === "imagelayer" ? nextSceneLayer.repeatX : false;
      (imageLayerRepeatYToggle.querySelector("input") as HTMLInputElement).checked = nextSceneLayer?.type === "imagelayer" ? nextSceneLayer.repeatY : false;
      imageLayerSection.hidden = nextSceneLayer?.type !== "imagelayer";
      sceneEditActions.hidden = nextSceneLayer?.type === "imagelayer";
      sceneMoveActions.hidden = nextSceneLayer?.type === "imagelayer";
      sceneCopyButton.disabled = !nextState.session.sourceSelection && nextState.session.selectedSceneCells.length < 1;
      scenePasteButton.disabled = !nextState.session.sceneClipboard;
      sceneDeleteButton.disabled = nextState.session.selectedSceneCells.length < 1 || nextSceneLayer?.type !== "tilelayer";
      (sceneGridToggle.querySelector("input") as HTMLInputElement).checked = !nextState.session.showSceneGrid;
      sceneLayerSelect.replaceChildren();
      for (const layer of nextState.project.scene?.layers ?? []) {
        const option = document.createElement("option");
        option.value = `${layer.id}`;
        option.textContent = layer.name;
        option.selected = layer.id === nextSceneLayer?.id;
        sceneLayerSelect.append(option);
      }
      derivedGridValue.textContent = `${nextOutputGrid.columns} columns x ${nextOutputGrid.rows} rows`;
      sceneMapStatusItems[0].description.textContent = nextState.project.scene
        ? `${nextState.project.scene.width} x ${nextState.project.scene.height}`
        : "Not loaded";
      sceneMapStatusItems[1].description.textContent = `${nextState.project.scene?.layers.length ?? 0}`;
      sceneMapStatusItems[2].description.textContent = nextSceneLayer?.name ?? "None";
      sceneMapStatusItems[3].description.textContent = `${nextState.session.selectedSceneCells.length}`;
      sceneSelectionStatusItems[0].description.textContent = `${nextState.session.selectedSceneCells.length}`;
      sceneSelectionStatusItems[1].description.textContent = nextState.session.sceneClipboard ? "Ready" : "Empty";
      sceneSelectionStatusItems[2].description.textContent = nextSceneLayer?.name ?? "None";
      if (activeWorkspaceTab === "tilesheet" && activeTilesheetSubTab === "sheet" && getSelectedOutputTiles(nextState).length > 0) {
        activeTilesheetSubTab = "tile";
      }
      syncWorkspaceTabState(activeWorkspaceTab, tilesheetTab, sceneTab, tilesheetWorkspacePanel, sceneWorkspacePanel);
      syncTilesheetSubTabState(activeTilesheetSubTab, tilesheetSheetTab, tilesheetTileTab, tilesheetSheetPanel, tilesheetTilePanel);
      syncSceneSubTabState(activeSceneSubTab, sceneMapTab, sceneLayersTab, sceneSelectionTab, sceneMapPanel, sceneLayersPanel, sceneSelectionPanel);
      notes.textContent = nextState.session.message ?? "";
      resourceDialogOverlay.hidden = nextState.session.unresolvedResources.length < 1 || !nextState.session.unresolvedResourceScope;
      resourceDialogList.replaceChildren();
      for (const resource of nextState.session.unresolvedResources) {
        const row = document.createElement("div");
        row.className = "resource-row";

        const copy = document.createElement("div");
        copy.className = "resource-row-copy";

        const title = document.createElement("div");
        title.className = "resource-row-title";
        title.textContent = resource.label;

        const path = document.createElement("div");
        path.className = "resource-row-path";
        path.textContent = resource.path;

        const status = document.createElement("div");
        status.className = "resource-row-status";
        status.textContent = "Needs file";

        copy.append(title, path, status);

        const chooser = document.createElement("label");
        chooser.className = "file-input file-input-secondary";
        chooser.textContent = getResourceChooserLabel(resource);
        const input = document.createElement("input");
        input.type = "file";
        input.accept = getResourceAccept(resource);
        input.addEventListener("change", async () => {
          const file = input.files?.[0];

          if (!file) {
            return;
          }

          await onResolveUnresolvedResource(resource.id, file);
          input.value = "";
        });
        chooser.append(input);

        row.append(copy, chooser);
        resourceDialogList.append(row);
      }
      panel.scrollTop = scrollTop;
    },
  };
}

function createMetaItem(label: string, value: string) {
  const term = document.createElement("dt");
  term.textContent = label;

  const description = document.createElement("dd");
  description.textContent = value;

  return { term, description };
}

function createNumberInput(value: number, ariaLabel: string, min?: number, step = 1): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  if (min !== undefined) {
    input.min = `${min}`;
  }
  input.step = `${step}`;
  input.value = `${value}`;
  input.className = "grid-number-input";
  input.setAttribute("aria-label", ariaLabel);
  return input;
}

function createLabeledNumberField(
  label: string,
  value: number,
  ariaLabel: string,
  min?: number,
  step = 1,
): {
  field: HTMLLabelElement;
  input: HTMLInputElement;
} {
  const field = document.createElement("label");
  field.className = "number-field";

  const text = document.createElement("span");
  text.className = "number-field-label";
  text.textContent = label;

  const input = createNumberInput(value, ariaLabel, min, step);

  field.append(text, input);

  return { field, input };
}

function createLabeledTextField(label: string, value: string, ariaLabel: string): {
  field: HTMLLabelElement;
  input: HTMLInputElement;
} {
  const field = document.createElement("label");
  field.className = "number-field";

  const text = document.createElement("span");
  text.className = "number-field-label";
  text.textContent = label;

  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.className = "grid-number-input";
  input.setAttribute("aria-label", ariaLabel);

  field.append(text, input);
  return { field, input };
}

function createCheckboxField(label: string, checked: boolean, onChange: (checked: boolean) => void): HTMLLabelElement {
  const field = document.createElement("label");
  field.className = "checkbox-field";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => {
    onChange(input.checked);
  });

  const text = document.createElement("span");
  text.textContent = label;

  field.append(input, text);
  return field;
}

function createActionButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "file-input file-input-secondary";
  button.textContent = label;
  button.addEventListener("click", () => {
    onClick();
  });
  return button;
}

function createAsyncActionButton(label: string, onClick: () => Promise<void>): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "file-input file-input-secondary";
  button.textContent = label;
  button.addEventListener("click", async () => {
    await onClick();
  });
  return button;
}

function createSidebarTabButton(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sidebar-tab";
  button.textContent = label;
  return button;
}

function syncWorkspaceTabState(
  activeTab: WorkspaceTab,
  tilesheetTab: HTMLButtonElement,
  sceneTab: HTMLButtonElement,
  tilesheetPanel: HTMLDivElement,
  scenePanel: HTMLDivElement,
): void {
  tilesheetTab.dataset.active = activeTab === "tilesheet" ? "true" : "false";
  sceneTab.dataset.active = activeTab === "scene" ? "true" : "false";
  tilesheetPanel.hidden = activeTab !== "tilesheet";
  scenePanel.hidden = activeTab !== "scene";
}

function syncTilesheetSubTabState(
  activeTab: TilesheetSubTab,
  sheetTab: HTMLButtonElement,
  tileTab: HTMLButtonElement,
  sheetPanel: HTMLDivElement,
  tilePanel: HTMLDivElement,
): void {
  sheetTab.dataset.active = activeTab === "sheet" ? "true" : "false";
  tileTab.dataset.active = activeTab === "tile" ? "true" : "false";
  sheetPanel.hidden = activeTab !== "sheet";
  tilePanel.hidden = activeTab !== "tile";
}

function syncSceneSubTabState(
  activeTab: SceneSubTab,
  mapTab: HTMLButtonElement,
  layersTab: HTMLButtonElement,
  selectionTab: HTMLButtonElement,
  mapPanel: HTMLDivElement,
  layersPanel: HTMLDivElement,
  selectionPanel: HTMLDivElement,
): void {
  mapTab.dataset.active = activeTab === "map" ? "true" : "false";
  layersTab.dataset.active = activeTab === "layers" ? "true" : "false";
  selectionTab.dataset.active = activeTab === "selection" ? "true" : "false";
  mapPanel.hidden = activeTab !== "map";
  layersPanel.hidden = activeTab !== "layers";
  selectionPanel.hidden = activeTab !== "selection";
}

function createControlSection(title: string, description: string): HTMLElement {
  const section = document.createElement("section");
  section.className = "control-section";

  const heading = document.createElement("h2");
  heading.className = "control-title";
  heading.textContent = title;

  const copy = document.createElement("p");
  copy.className = "field-note";
  copy.textContent = description;

  section.append(heading, copy);
  return section;
}

function getDisplayFileLabel(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  const segments = normalized.split("/");
  return segments[segments.length - 1] || value;
}

function isChromiumBrowser(): boolean {
  const userAgent = navigator.userAgent;
  return /(Chrome|Chromium|CriOS|Edg|EdgiOS)/.test(userAgent) && !/(Firefox|FxiOS)/.test(userAgent);
}

function getResourceChooserLabel(resource: ProjectState["session"]["unresolvedResources"][number]): string {
  switch (resource.role) {
    case "source-image":
      return "Choose Source";
    case "working-image":
      return "Choose Tilesheet";
    case "scene-file":
      return "Choose Scene";
    case "scene-image-layer":
      return "Choose Image";
  }
}

function getResourceAccept(resource: ProjectState["session"]["unresolvedResources"][number]): string {
  switch (resource.role) {
    case "scene-file":
      return ".tmj,application/json";
    case "source-image":
    case "working-image":
    case "scene-image-layer":
      return "image/*";
  }
}
