import type {
  ColorReplaceTargetMode,
  ProjectState,
  SeamDirection,
  SeamRepairMode,
  SeamRepairReference,
  TileAnchorX,
  TileAnchorY,
  TileFilterMode,
  TileFitMode,
  TilePreviewMode,
} from "../types/project";
import { getSelectedOutputTile, getSelectedOutputTiles } from "../systems/tileEditorSystem";
import { getSeamRepairPair } from "../systems/seamRepairSystem";
import { getSelectedOutputBounds, getSelectedTileGroupSignature } from "../systems/transformPreviewSystem";

export type SelectedTilePatch = {
  destCol?: number;
  destRow?: number;
  offsetX?: number;
  offsetY?: number;
  scaleX?: number;
  scaleY?: number;
  fitMode?: TileFitMode;
  anchorX?: TileAnchorX;
  anchorY?: TileAnchorY;
  cropLeft?: number;
  cropRight?: number;
  cropTop?: number;
  cropBottom?: number;
  clampToTile?: boolean;
  edgeStretchLeft?: number;
  edgeStretchRight?: number;
  edgeStretchTop?: number;
  edgeStretchBottom?: number;
  edgeExtend?: boolean;
  fillExposedColor?: string | null;
  flipX?: boolean;
  flipY?: boolean;
  rotationQuarterTurns?: 0 | 1 | 2 | 3;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  tintColor?: string | null;
  filterMode?: TileFilterMode;
  pixelSnap?: boolean;
  name?: string;
  tags?: string[];
  collision?: string;
};

type EditorTab = "layout" | "fit" | "preview" | "visual" | "meta";

type TileEditorCallbacks = {
  onTileMultiEditModeChanged: (mode: "individual" | "group") => void;
  onMoveSelectedTiles: (deltaCol: number, deltaRow: number) => void;
  onSelectedTileUpdated: (patch: SelectedTilePatch) => Promise<void>;
  onPreviewTileLayoutUpdated: (patch: SelectedTilePatch) => void;
  onApplyTileLayoutPreview: () => Promise<void>;
  onCancelTileLayoutPreview: () => void;
  onNudgeSelectedTile: (deltaX: number, deltaY: number) => Promise<void>;
  onGroupScaleXChanged: (value: number) => void;
  onGroupScaleYChanged: (value: number) => void;
  onApplyGroupScale: () => Promise<void>;
  onCancelGroupTransform: () => void;
  onGroupStretchUpdated: (patch: { left?: number; right?: number; top?: number; bottom?: number }) => void;
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
  onClearSelectedTile: () => void;
};

type TileEditorSection = {
  section: HTMLElement;
  update: (nextState: ProjectState) => void;
};

export function createTileEditorSection(state: ProjectState, callbacks: TileEditorCallbacks): TileEditorSection {
  const selectedTile = getSelectedOutputTile(state);
  const selectedTiles = getSelectedOutputTiles(state);
  let currentSelectedTile = selectedTile;
  let currentSelectionCount = Math.max(state.session.selectedOutputCells.length, selectedTiles.length);
  let currentSelectionBounds = getSelectedOutputBounds(state);
  let currentSelectionSignature = getSelectedTileGroupSignature(state);
  let currentGroupOffsetX = state.session.groupOffsetX;
  let currentGroupOffsetY = state.session.groupOffsetY;
  let currentEditMode = state.session.tileMultiEditMode;
  let tileColCommitTimeout: number | null = null;
  let tileRowCommitTimeout: number | null = null;
  const editorSection = document.createElement("section");
  editorSection.className = "control-section";
  let activeEditorTab: EditorTab = "layout";
  const editorEmpty = document.createElement("p");
  editorEmpty.className = "field-note";
  editorEmpty.textContent = selectedTile ? "" : "No output tile selected yet. Hold Shift and click to build a multi-selection.";

  const editorActions = document.createElement("div");
  editorActions.className = "panel-actions";
  const copyTileButton = createActionButton("Copy", callbacks.onCopySelectedTiles);
  copyTileButton.disabled = selectedTiles.length < 1;
  const pasteTileButton = createActionButton("Paste", callbacks.onPasteSelectedTiles);
  pasteTileButton.disabled = !state.session.outputTileClipboard;
  const clearTileButton = createActionButton("Clear", callbacks.onClearSelectedTile);
  clearTileButton.disabled = !selectedTile;
  editorActions.append(copyTileButton, pasteTileButton, clearTileButton);

  const editorTabs = document.createElement("div");
  editorTabs.className = "editor-tabs";
  const layoutTab = createEditorTabButton("Layout");
  const fitTab = createEditorTabButton("Fit");
  const previewTab = createEditorTabButton("Preview");
  const visualTab = createEditorTabButton("Visual");
  const metaTab = createEditorTabButton("Meta");
  editorTabs.append(layoutTab, fitTab, previewTab, visualTab, metaTab);

  const layoutPanel = document.createElement("div");
  layoutPanel.className = "editor-tab-panel";
  const fitPanel = document.createElement("div");
  fitPanel.className = "editor-tab-panel";
  const previewPanel = document.createElement("div");
  previewPanel.className = "editor-tab-panel";
  const visualPanel = document.createElement("div");
  visualPanel.className = "editor-tab-panel";
  const metaPanel = document.createElement("div");
  metaPanel.className = "editor-tab-panel";

  const tileCellInputs = document.createElement("div");
  tileCellInputs.className = "grid-inputs";
  const tileColField = createLabeledNumberField("Tile col", selectedTile?.destCol ?? 0, "Selected tile column", 0, 1);
  const tileRowField = createLabeledNumberField("Tile row", selectedTile?.destRow ?? 0, "Selected tile row", 0, 1);
  const commitTileColChanged = () => {
    const nextValue = Math.max(0, Number.parseInt(tileColField.input.value, 10) || 0);

    if (currentSelectionCount > 1 && currentEditMode === "group" && currentSelectionBounds) {
      const currentPreviewCol = currentSelectionBounds.minCol + Math.round(currentGroupOffsetX / state.project.tileWidth);
      void callbacks.onNudgeSelectedTile((nextValue - currentPreviewCol) * state.project.tileWidth, 0);
      return;
    }

    callbacks.onPreviewTileLayoutUpdated({ destCol: nextValue });
  };
  const commitTileRowChanged = () => {
    const nextValue = Math.max(0, Number.parseInt(tileRowField.input.value, 10) || 0);

    if (currentSelectionCount > 1 && currentEditMode === "group" && currentSelectionBounds) {
      const currentPreviewRow = currentSelectionBounds.minRow + Math.round(currentGroupOffsetY / state.project.tileHeight);
      void callbacks.onNudgeSelectedTile(0, (nextValue - currentPreviewRow) * state.project.tileHeight);
      return;
    }

    callbacks.onPreviewTileLayoutUpdated({ destRow: nextValue });
  };
  tileColField.input.addEventListener("change", commitTileColChanged);
  tileColField.input.addEventListener("input", () => {
    if (tileColCommitTimeout !== null) {
      window.clearTimeout(tileColCommitTimeout);
    }
    tileColCommitTimeout = window.setTimeout(() => {
      tileColCommitTimeout = null;
      commitTileColChanged();
    }, 180);
  });
  tileRowField.input.addEventListener("change", commitTileRowChanged);
  tileRowField.input.addEventListener("input", () => {
    if (tileRowCommitTimeout !== null) {
      window.clearTimeout(tileRowCommitTimeout);
    }
    tileRowCommitTimeout = window.setTimeout(() => {
      tileRowCommitTimeout = null;
      commitTileRowChanged();
    }, 180);
  });
  tileCellInputs.append(tileColField.field, tileRowField.field);

  const offsetInputs = document.createElement("div");
  offsetInputs.className = "grid-inputs";
  const offsetXField = createLabeledNumberField("Offset X", selectedTile?.offsetX ?? 0, "Offset X", undefined, 1);
  const offsetYField = createLabeledNumberField("Offset Y", selectedTile?.offsetY ?? 0, "Offset Y", undefined, 1);
  offsetXField.input.addEventListener("change", async () => {
    const nextValue = Number.parseFloat(offsetXField.input.value) || 0;

    if (currentSelectionCount > 1 && currentEditMode === "group") {
      const delta = Math.round(nextValue - currentGroupOffsetX);
      currentGroupOffsetX = nextValue;
      if (delta !== 0) {
        await callbacks.onNudgeSelectedTile(delta, 0);
      }
      return;
    }

    callbacks.onPreviewTileLayoutUpdated({ offsetX: nextValue });
  });
  offsetYField.input.addEventListener("change", async () => {
    const nextValue = Number.parseFloat(offsetYField.input.value) || 0;

    if (currentSelectionCount > 1 && currentEditMode === "group") {
      const delta = Math.round(nextValue - currentGroupOffsetY);
      currentGroupOffsetY = nextValue;
      if (delta !== 0) {
        await callbacks.onNudgeSelectedTile(0, delta);
      }
      return;
    }

    callbacks.onPreviewTileLayoutUpdated({ offsetY: nextValue });
  });
  offsetInputs.append(offsetXField.field, offsetYField.field);

  const scaleInputs = document.createElement("div");
  scaleInputs.className = "grid-inputs";
  const scaleXField = createLabeledNumberField("Scale X", selectedTile?.scaleX ?? 1, "Scale X", 0.1, 0.1);
  const scaleYField = createLabeledNumberField("Scale Y", selectedTile?.scaleY ?? 1, "Scale Y", 0.1, 0.1);
  const groupTransformActions = document.createElement("div");
  groupTransformActions.className = "panel-actions";
  const applyGroupTransformButton = createAsyncActionButton("Apply Layout", async () => {
    if (currentSelectionCount > 1 && currentEditMode === "group") {
      await callbacks.onApplyGroupScale();
      return;
    }

    await callbacks.onApplyTileLayoutPreview();
  });
  const cancelGroupTransformButton = createActionButton("Cancel", callbacks.onCancelTileLayoutPreview);
  groupTransformActions.append(applyGroupTransformButton, cancelGroupTransformButton);
  const scaleModeToggle = createCheckboxField("Whole group", currentEditMode === "group", (checked) => {
    currentEditMode = checked ? "group" : "individual";
    callbacks.onTileMultiEditModeChanged(currentEditMode);
    syncScaleControls(currentSelectedTile, currentSelectionCount, scaleModeToggle, scaleXField.input, scaleYField.input, currentEditMode, state);
  });
  scaleXField.input.addEventListener("change", async () => {
    const nextValue = Math.max(0.1, Number.parseFloat(scaleXField.input.value) || 1);

    if (currentSelectionCount > 1 && currentEditMode === "group") {
      callbacks.onGroupScaleXChanged(nextValue);
      return;
    }

    callbacks.onPreviewTileLayoutUpdated({ scaleX: nextValue });
  });
  scaleYField.input.addEventListener("change", async () => {
    const nextValue = Math.max(0.1, Number.parseFloat(scaleYField.input.value) || 1);

    if (currentSelectionCount > 1 && currentEditMode === "group") {
      callbacks.onGroupScaleYChanged(nextValue);
      return;
    }

    callbacks.onPreviewTileLayoutUpdated({ scaleY: nextValue });
  });
  scaleInputs.append(scaleXField.field, scaleYField.field);

  const cropInputs = document.createElement("div");
  cropInputs.className = "grid-inputs";
  const cropLeftField = createLabeledNumberField("Crop L", selectedTile?.cropLeft ?? 0, "Crop left", 0, 1);
  const cropRightField = createLabeledNumberField("Crop R", selectedTile?.cropRight ?? 0, "Crop right", 0, 1);
  const cropTopField = createLabeledNumberField("Crop T", selectedTile?.cropTop ?? 0, "Crop top", 0, 1);
  const cropBottomField = createLabeledNumberField("Crop B", selectedTile?.cropBottom ?? 0, "Crop bottom", 0, 1);
  cropLeftField.input.addEventListener("change", () => { void callbacks.onSelectedTileUpdated({ cropLeft: Math.max(0, Number.parseInt(cropLeftField.input.value, 10) || 0) }); });
  cropRightField.input.addEventListener("change", () => { void callbacks.onSelectedTileUpdated({ cropRight: Math.max(0, Number.parseInt(cropRightField.input.value, 10) || 0) }); });
  cropTopField.input.addEventListener("change", () => { void callbacks.onSelectedTileUpdated({ cropTop: Math.max(0, Number.parseInt(cropTopField.input.value, 10) || 0) }); });
  cropBottomField.input.addEventListener("change", () => { void callbacks.onSelectedTileUpdated({ cropBottom: Math.max(0, Number.parseInt(cropBottomField.input.value, 10) || 0) }); });
  cropInputs.append(cropLeftField.field, cropRightField.field, cropTopField.field, cropBottomField.field);

  const stretchInputs = document.createElement("div");
  stretchInputs.className = "grid-inputs";
  const edgeStretchLeftField = createLabeledNumberField("Stretch L", selectedTile?.edgeStretchLeft ?? 0, "Stretch left", undefined, 1);
  const edgeStretchRightField = createLabeledNumberField("Stretch R", selectedTile?.edgeStretchRight ?? 0, "Stretch right", undefined, 1);
  const edgeStretchTopField = createLabeledNumberField("Stretch T", selectedTile?.edgeStretchTop ?? 0, "Stretch top", undefined, 1);
  const edgeStretchBottomField = createLabeledNumberField("Stretch B", selectedTile?.edgeStretchBottom ?? 0, "Stretch bottom", undefined, 1);
  edgeStretchLeftField.input.addEventListener("change", async () => {
    const value = Number.parseFloat(edgeStretchLeftField.input.value) || 0;
    if (currentSelectionCount > 1 && currentEditMode === "group") {
      callbacks.onGroupStretchUpdated({ left: value });
      await callbacks.onApplyGroupStretch();
      return;
    }
    await callbacks.onSelectedTileUpdated({ edgeStretchLeft: value });
  });
  edgeStretchRightField.input.addEventListener("change", async () => {
    const value = Number.parseFloat(edgeStretchRightField.input.value) || 0;
    if (currentSelectionCount > 1 && currentEditMode === "group") {
      callbacks.onGroupStretchUpdated({ right: value });
      await callbacks.onApplyGroupStretch();
      return;
    }
    await callbacks.onSelectedTileUpdated({ edgeStretchRight: value });
  });
  edgeStretchTopField.input.addEventListener("change", async () => {
    const value = Number.parseFloat(edgeStretchTopField.input.value) || 0;
    if (currentSelectionCount > 1 && currentEditMode === "group") {
      callbacks.onGroupStretchUpdated({ top: value });
      await callbacks.onApplyGroupStretch();
      return;
    }
    await callbacks.onSelectedTileUpdated({ edgeStretchTop: value });
  });
  edgeStretchBottomField.input.addEventListener("change", async () => {
    const value = Number.parseFloat(edgeStretchBottomField.input.value) || 0;
    if (currentSelectionCount > 1 && currentEditMode === "group") {
      callbacks.onGroupStretchUpdated({ bottom: value });
      await callbacks.onApplyGroupStretch();
      return;
    }
    await callbacks.onSelectedTileUpdated({ edgeStretchBottom: value });
  });
  stretchInputs.append(edgeStretchLeftField.field, edgeStretchRightField.field, edgeStretchTopField.field, edgeStretchBottomField.field);

  const repairOptions = document.createElement("div");
  repairOptions.className = "grid-inputs";
  const fillExposedField = document.createElement("label");
  fillExposedField.className = "field-group";
  const fillExposedLabel = document.createElement("span");
  fillExposedLabel.className = "field-label";
  fillExposedLabel.textContent = "Fill exposed";
  const fillExposedInput = document.createElement("input");
  fillExposedInput.type = "text";
  fillExposedInput.className = "grid-number-input";
  fillExposedInput.placeholder = "#000000";
  fillExposedInput.value = selectedTile?.fillExposedColor ?? "";
  fillExposedInput.addEventListener("change", () => {
    const value = fillExposedInput.value.trim();
    void callbacks.onSelectedTileUpdated({ fillExposedColor: value.length > 0 ? value : null });
  });
  fillExposedField.append(fillExposedLabel, fillExposedInput);

  const edgeExtendField = document.createElement("div");
  edgeExtendField.className = "number-field";
  const edgeExtendLabel = document.createElement("span");
  edgeExtendLabel.className = "number-field-label";
  edgeExtendLabel.textContent = "Gap repair";
  const edgeExtendButton = createAsyncActionButton("Bake Edge Extend", callbacks.onBakeSelectedTileEdgeExtend);
  edgeExtendField.append(edgeExtendLabel, edgeExtendButton);
  repairOptions.append(fillExposedField, edgeExtendField);

  const fitActions = document.createElement("div");
  fitActions.className = "panel-actions";
  const manualFitButton = createActionButton("Manual", () => { callbacks.onSetSelectedTileFitMode("manual"); });
  const stretchFitButton = createActionButton("Stretch", () => { callbacks.onSetSelectedTileFitMode("stretch"); });
  const containFitButton = createActionButton("Contain", () => { callbacks.onSetSelectedTileFitMode("contain"); });
  manualFitButton.dataset.active = selectedTile?.fitMode === "manual" ? "true" : "false";
  stretchFitButton.dataset.active = selectedTile?.fitMode === "stretch" ? "true" : "false";
  containFitButton.dataset.active = selectedTile?.fitMode === "contain" ? "true" : "false";
  fitActions.append(
    manualFitButton,
    stretchFitButton,
    containFitButton,
    createActionButton("Trim Transparent", callbacks.onTrimSelectedTileTransparent),
  );

  const fitModeNote = document.createElement("p");
  fitModeNote.className = "field-note";
  fitModeNote.textContent = describeFitMode(selectedTile);

  const anchorField = document.createElement("div");
  anchorField.className = "grid-inputs";
  const anchorXField = document.createElement("label");
  anchorXField.className = "field-group";
  const anchorXLabel = document.createElement("span");
  anchorXLabel.className = "field-label";
  anchorXLabel.textContent = "Anchor X";
  const anchorXSelect = document.createElement("select");
  anchorXSelect.className = "tile-size-select";
  ["left", "center", "right"].forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    anchorXSelect.append(option);
  });
  anchorXSelect.value = selectedTile?.anchorX ?? "center";
  anchorXField.append(anchorXLabel, anchorXSelect);
  const anchorYField = document.createElement("label");
  anchorYField.className = "field-group";
  const anchorYLabel = document.createElement("span");
  anchorYLabel.className = "field-label";
  anchorYLabel.textContent = "Anchor Y";
  const anchorYSelect = document.createElement("select");
  anchorYSelect.className = "tile-size-select";
  ["top", "center", "bottom"].forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    anchorYSelect.append(option);
  });
  anchorYSelect.value = selectedTile?.anchorY ?? "center";
  anchorYField.append(anchorYLabel, anchorYSelect);
  anchorField.append(anchorXField, anchorYField);

  const anchorActions = document.createElement("div");
  anchorActions.className = "panel-actions";
  anchorActions.append(
    createActionButton("Apply Anchor", () => {
      callbacks.onAlignSelectedTile(anchorXSelect.value as TileAnchorX, anchorYSelect.value as TileAnchorY);
    }),
    createActionButton("Edge Snap", callbacks.onSnapSelectedTileToEdges),
    createActionButton("Rotate -90", () => { callbacks.onRotateSelectedTile(-1); }),
    createActionButton("Rotate +90", () => { callbacks.onRotateSelectedTile(1); }),
  );

  const previewField = document.createElement("label");
  previewField.className = "field-group";
  const previewLabel = document.createElement("span");
  previewLabel.className = "field-label";
  previewLabel.textContent = "Preview mode";
  const previewSelect = document.createElement("select");
  previewSelect.className = "tile-size-select";
  [
    ["none", "None"],
    ["repeat", "Repeat"],
    ["neighbors", "Neighbors"],
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    previewSelect.append(option);
  });
  previewSelect.value = state.session.tilePreviewMode;
  previewSelect.addEventListener("change", () => {
    if (previewSelect.value === "none" || previewSelect.value === "repeat" || previewSelect.value === "neighbors") {
      callbacks.onTilePreviewModeChanged(previewSelect.value);
    }
  });
  previewField.append(previewLabel, previewSelect);

  const previewNote = document.createElement("p");
  previewNote.className = "field-note";
  previewNote.textContent = "Preview is shown on the canvas for the selected tile.";

  const colorInputs = document.createElement("div");
  colorInputs.className = "grid-inputs";
  const brightnessField = createLabeledNumberField("Brightness", selectedTile?.brightness ?? 0, "Brightness", undefined, 0.1);
  const contrastField = createLabeledNumberField("Contrast", selectedTile?.contrast ?? 1, "Contrast", 0.1, 0.1);
  const saturationField = createLabeledNumberField("Saturation", selectedTile?.saturation ?? 1, "Saturation", 0.1, 0.1);
  brightnessField.input.addEventListener("change", () => {
    void callbacks.onSelectedTileUpdated({ brightness: Number.parseFloat(brightnessField.input.value) || 0 });
  });
  contrastField.input.addEventListener("change", () => {
    void callbacks.onSelectedTileUpdated({ contrast: Math.max(0.1, Number.parseFloat(contrastField.input.value) || 1) });
  });
  saturationField.input.addEventListener("change", () => {
    void callbacks.onSelectedTileUpdated({ saturation: Math.max(0.1, Number.parseFloat(saturationField.input.value) || 1) });
  });
  colorInputs.append(brightnessField.field, contrastField.field, saturationField.field);

  const filterField = document.createElement("label");
  filterField.className = "field-group";
  const filterLabel = document.createElement("span");
  filterLabel.className = "field-label";
  filterLabel.textContent = "Filter mode";
  const filterSelect = document.createElement("select");
  filterSelect.className = "tile-size-select";
  ["nearest", "linear"].forEach((mode) => {
    const option = document.createElement("option");
    option.value = mode;
    option.textContent = mode;
    filterSelect.append(option);
  });
  filterSelect.value = selectedTile?.filterMode ?? "nearest";
  filterSelect.addEventListener("change", () => {
    const value = filterSelect.value;
    if (value === "nearest" || value === "linear") {
      void callbacks.onSelectedTileUpdated({ filterMode: value });
    }
  });
  filterField.append(filterLabel, filterSelect);

  const tintField = document.createElement("label");
  tintField.className = "field-group";
  const tintLabel = document.createElement("span");
  tintLabel.className = "field-label";
  tintLabel.textContent = "Tint color";
  const tintInput = document.createElement("input");
  tintInput.type = "text";
  tintInput.className = "grid-number-input";
  tintInput.placeholder = "#ff9966aa";
  tintInput.value = selectedTile?.tintColor ?? "";
  tintInput.addEventListener("change", () => {
    const value = tintInput.value.trim();
    void callbacks.onSelectedTileUpdated({ tintColor: value.length > 0 ? value : null });
  });
  tintField.append(tintLabel, tintInput);

  const fillTileSection = document.createElement("div");
  fillTileSection.className = "editor-stack";
  const fillTileHeading = document.createElement("p");
  fillTileHeading.className = "field-label";
  fillTileHeading.textContent = "Fill tile";
  const fillTileField = document.createElement("label");
  fillTileField.className = "field-group";
  const fillTileLabel = document.createElement("span");
  fillTileLabel.className = "field-label";
  fillTileLabel.textContent = "Fill color";
  const fillTileInput = document.createElement("input");
  fillTileInput.type = "color";
  fillTileInput.className = "color-input";
  fillTileInput.value = state.session.fillTileColor;
  fillTileInput.addEventListener("input", () => {
    callbacks.onFillTileColorChanged(fillTileInput.value);
  });
  fillTileField.append(fillTileLabel, fillTileInput);
  const fillTileNote = document.createElement("p");
  fillTileNote.className = "field-note";
  fillTileNote.textContent = "Create or replace the selected output cells with a solid tile color.";
  const fillTileButton = createAsyncActionButton("Fill Selected Tiles", callbacks.onApplyTileFill);
  fillTileSection.append(fillTileHeading, fillTileField, fillTileNote, fillTileButton);

  const colorReplaceSection = document.createElement("div");
  colorReplaceSection.className = "editor-stack";
  const colorReplaceHeading = document.createElement("p");
  colorReplaceHeading.className = "field-label";
  colorReplaceHeading.textContent = "Color replace";
  const colorReplaceInputs = document.createElement("div");
  colorReplaceInputs.className = "grid-inputs";
  const colorReplaceSourceField = document.createElement("label");
  colorReplaceSourceField.className = "field-group";
  const colorReplaceSourceLabel = document.createElement("span");
  colorReplaceSourceLabel.className = "field-label";
  colorReplaceSourceLabel.textContent = "Source color";
  const colorReplaceSourceInput = document.createElement("input");
  colorReplaceSourceInput.type = "color";
  colorReplaceSourceInput.className = "color-input";
  colorReplaceSourceInput.value = state.session.colorReplaceSourceColor;
  colorReplaceSourceInput.addEventListener("input", () => {
    callbacks.onColorReplaceSourceColorChanged(colorReplaceSourceInput.value);
  });
  colorReplaceSourceField.append(colorReplaceSourceLabel, colorReplaceSourceInput);
  const colorReplaceToleranceField = createLabeledNumberField("Tolerance", state.session.colorReplaceTolerance, "Color replace tolerance", 0, 1);
  colorReplaceToleranceField.input.max = "441";
  colorReplaceToleranceField.input.addEventListener("change", () => {
    callbacks.onColorReplaceToleranceChanged(Math.max(0, Math.min(441, Number.parseInt(colorReplaceToleranceField.input.value, 10) || 0)));
  });
  colorReplaceInputs.append(colorReplaceSourceField, colorReplaceToleranceField.field);
  const colorReplaceModeField = document.createElement("label");
  colorReplaceModeField.className = "field-group";
  const colorReplaceModeLabel = document.createElement("span");
  colorReplaceModeLabel.className = "field-label";
  colorReplaceModeLabel.textContent = "Replace with";
  const colorReplaceModeSelect = document.createElement("select");
  colorReplaceModeSelect.className = "tile-size-select";
  [["transparent", "Transparent"], ["color", "Color"]].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    colorReplaceModeSelect.append(option);
  });
  colorReplaceModeSelect.value = state.session.colorReplaceTargetMode;
  const colorReplaceTargetField = document.createElement("label");
  colorReplaceTargetField.className = "field-group";
  const colorReplaceTargetLabel = document.createElement("span");
  colorReplaceTargetLabel.className = "field-label";
  colorReplaceTargetLabel.textContent = "Target color";
  const colorReplaceTargetInput = document.createElement("input");
  colorReplaceTargetInput.type = "color";
  colorReplaceTargetInput.className = "color-input";
  colorReplaceTargetInput.value = state.session.colorReplaceTargetColor;
  colorReplaceTargetInput.addEventListener("input", () => {
    callbacks.onColorReplaceTargetColorChanged(colorReplaceTargetInput.value);
  });
  colorReplaceTargetField.append(colorReplaceTargetLabel, colorReplaceTargetInput);
  colorReplaceTargetField.hidden = state.session.colorReplaceTargetMode !== "color";
  colorReplaceModeSelect.addEventListener("change", () => {
    if (colorReplaceModeSelect.value === "transparent" || colorReplaceModeSelect.value === "color") {
      callbacks.onColorReplaceTargetModeChanged(colorReplaceModeSelect.value);
      colorReplaceTargetField.hidden = colorReplaceModeSelect.value !== "color";
    }
  });
  colorReplaceModeField.append(colorReplaceModeLabel, colorReplaceModeSelect);
  const colorReplaceNote = document.createElement("p");
  colorReplaceNote.className = "field-note";
  colorReplaceNote.textContent = describeColorReplaceAction(
    state.session.colorReplaceSourceColor,
    state.session.colorReplaceTargetMode,
    state.session.colorReplaceTargetColor,
    state.session.colorReplaceTolerance,
  );
  const colorReplaceButton = createAsyncActionButton("Apply Color Replace", callbacks.onApplyColorReplace);
  colorReplaceSection.append(
    colorReplaceHeading,
    colorReplaceInputs,
    colorReplaceModeField,
    colorReplaceTargetField,
    colorReplaceNote,
    colorReplaceButton,
  );

  const seamRepairSection = document.createElement("div");
  seamRepairSection.className = "editor-stack";
  const seamRepairHeading = document.createElement("p");
  seamRepairHeading.className = "field-label";
  seamRepairHeading.textContent = "Seam repair";
  const seamPair = getSeamRepairPair(state);
  const seamRepairDirectionField = document.createElement("label");
  seamRepairDirectionField.className = "field-group";
  const seamRepairDirectionLabel = document.createElement("span");
  seamRepairDirectionLabel.className = "field-label";
  seamRepairDirectionLabel.textContent = "Neighbor";
  const seamRepairDirectionSelect = document.createElement("select");
  seamRepairDirectionSelect.className = "tile-size-select";
  [["left", "Left"], ["right", "Right"], ["top", "Top"], ["bottom", "Bottom"]].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    seamRepairDirectionSelect.append(option);
  });
  seamRepairDirectionSelect.value = state.session.seamRepairDirection;
  seamRepairDirectionSelect.addEventListener("change", () => {
    if (seamRepairDirectionSelect.value === "left" || seamRepairDirectionSelect.value === "right" || seamRepairDirectionSelect.value === "top" || seamRepairDirectionSelect.value === "bottom") {
      callbacks.onSeamRepairDirectionChanged(seamRepairDirectionSelect.value);
    }
  });
  seamRepairDirectionField.append(seamRepairDirectionLabel, seamRepairDirectionSelect);

  const seamRepairModeField = document.createElement("label");
  seamRepairModeField.className = "field-group";
  const seamRepairModeLabel = document.createElement("span");
  seamRepairModeLabel.className = "field-label";
  seamRepairModeLabel.textContent = "Mode";
  const seamRepairModeSelect = document.createElement("select");
  seamRepairModeSelect.className = "tile-size-select";
  [["full", "Full color"], ["luminance", "Luminance"], ["chroma", "Chroma"]].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    seamRepairModeSelect.append(option);
  });
  seamRepairModeSelect.value = state.session.seamRepairMode;
  seamRepairModeSelect.addEventListener("change", () => {
    if (seamRepairModeSelect.value === "full" || seamRepairModeSelect.value === "luminance" || seamRepairModeSelect.value === "chroma") {
      callbacks.onSeamRepairModeChanged(seamRepairModeSelect.value);
    }
  });
  seamRepairModeField.append(seamRepairModeLabel, seamRepairModeSelect);

  const seamRepairReferenceField = document.createElement("label");
  seamRepairReferenceField.className = "field-group";
  const seamRepairReferenceLabel = document.createElement("span");
  seamRepairReferenceLabel.className = "field-label";
  seamRepairReferenceLabel.textContent = "Reference";
  const seamRepairReferenceSelect = document.createElement("select");
  seamRepairReferenceSelect.className = "tile-size-select";
  [["balanced", "Balanced"], ["primary", "Selected tile"], ["neighbor", "Neighbor tile"]].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    seamRepairReferenceSelect.append(option);
  });
  seamRepairReferenceSelect.value = state.session.seamRepairReference;
  seamRepairReferenceSelect.addEventListener("change", () => {
    if (seamRepairReferenceSelect.value === "balanced" || seamRepairReferenceSelect.value === "primary" || seamRepairReferenceSelect.value === "neighbor") {
      callbacks.onSeamRepairReferenceChanged(seamRepairReferenceSelect.value);
    }
  });
  seamRepairReferenceField.append(seamRepairReferenceLabel, seamRepairReferenceSelect);

  const seamRepairInputs = document.createElement("div");
  seamRepairInputs.className = "grid-inputs";
  const seamRepairStripField = createLabeledNumberField("Strip width", state.session.seamRepairStripWidth, "Seam strip width", 1, 1);
  seamRepairStripField.input.addEventListener("change", () => {
    callbacks.onSeamRepairStripWidthChanged(Math.max(1, Number.parseInt(seamRepairStripField.input.value, 10) || 1));
  });
  const seamRepairFalloffField = createLabeledNumberField("Falloff", state.session.seamRepairFalloff, "Seam falloff", 1, 1);
  seamRepairFalloffField.input.addEventListener("change", () => {
    callbacks.onSeamRepairFalloffChanged(Math.max(1, Number.parseInt(seamRepairFalloffField.input.value, 10) || 1));
  });
  const seamRepairStrengthField = createLabeledNumberField("Strength", state.session.seamRepairStrength, "Seam repair strength", 0, 0.05);
  seamRepairStrengthField.input.max = "1";
  seamRepairStrengthField.input.addEventListener("change", () => {
    callbacks.onSeamRepairStrengthChanged(Math.max(0, Math.min(1, Number.parseFloat(seamRepairStrengthField.input.value) || 0)));
  });
  seamRepairInputs.append(seamRepairStripField.field, seamRepairFalloffField.field, seamRepairStrengthField.field);

  const seamRepairToggles = document.createElement("div");
  seamRepairToggles.className = "toggle-row";
  const seamPreviewToggle = createCheckboxField("Preview", state.session.seamRepairPreview, (checked) => {
    callbacks.onSeamRepairPreviewChanged(checked);
  });
  const seamQuantizeToggle = createCheckboxField("Quantize", state.session.seamRepairQuantize, (checked) => {
    callbacks.onSeamRepairQuantizeChanged(checked);
  });
  const seamContrastToggle = createCheckboxField("Preserve contrast", state.session.seamRepairPreserveContrast, (checked) => {
    callbacks.onSeamRepairPreserveContrastChanged(checked);
  });
  const seamRampToggle = createCheckboxField("Continue ramp", state.session.seamRepairContinueRamp, (checked) => {
    callbacks.onSeamRepairContinueRampChanged(checked);
  });
  seamRepairToggles.append(seamPreviewToggle, seamQuantizeToggle, seamContrastToggle, seamRampToggle);

  const seamRepairNote = document.createElement("p");
  seamRepairNote.className = "field-note";
  seamRepairNote.textContent = describeSeamRepair(seamPair, state);
  const seamRepairButton = createAsyncActionButton("Apply Seam Repair", callbacks.onApplySeamRepair);
  seamRepairSection.append(
    seamRepairHeading,
    seamRepairDirectionField,
    seamRepairModeField,
    seamRepairReferenceField,
    seamRepairInputs,
    seamRepairToggles,
    seamRepairNote,
    seamRepairButton,
  );

  const transformToggleRow = document.createElement("div");
  transformToggleRow.className = "toggle-row";
  const flipXToggle = createCheckboxField("Flip X", selectedTile?.flipX ?? false, (checked) => {
    callbacks.onPreviewTileLayoutUpdated({ flipX: checked });
  });
  const flipYToggle = createCheckboxField("Flip Y", selectedTile?.flipY ?? false, (checked) => {
    callbacks.onPreviewTileLayoutUpdated({ flipY: checked });
  });
  transformToggleRow.append(scaleModeToggle, flipXToggle, flipYToggle);

  const propertyToggleRow = document.createElement("div");
  propertyToggleRow.className = "toggle-row";
  const pixelSnapToggle = createCheckboxField("Pixel snap", selectedTile?.pixelSnap ?? true, (checked) => {
    void callbacks.onSelectedTileUpdated({ pixelSnap: checked });
  });
  const clampToggle = createCheckboxField("Clamp to tile", selectedTile?.clampToTile ?? true, (checked) => {
    void callbacks.onSelectedTileUpdated({ clampToTile: checked });
  });
  propertyToggleRow.append(pixelSnapToggle, clampToggle);

  const metadataInputs = document.createElement("div");
  metadataInputs.className = "editor-stack";
  const nameField = createLabeledTextField("Name", selectedTile?.name ?? "", "Tile name");
  nameField.input.addEventListener("change", () => {
    void callbacks.onSelectedTileUpdated({ name: nameField.input.value.trim() });
  });
  const tagsField = createLabeledTextField("Tags", selectedTile?.tags.join(", ") ?? "", "Tile tags");
  tagsField.input.addEventListener("change", () => {
    const tags = tagsField.input.value.split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0);
    void callbacks.onSelectedTileUpdated({ tags });
  });
  const collisionField = createLabeledTextField("Collision", selectedTile?.collision ?? "none", "Tile collision");
  collisionField.input.addEventListener("change", () => {
    void callbacks.onSelectedTileUpdated({ collision: collisionField.input.value.trim() || "none" });
  });
  metadataInputs.append(nameField.field, tagsField.field, collisionField.field);

  layoutPanel.append(transformToggleRow, tileCellInputs, offsetInputs, scaleInputs, groupTransformActions, propertyToggleRow);
  fitPanel.append(fitActions, fitModeNote, anchorField, anchorActions, cropInputs, stretchInputs, repairOptions);
  previewPanel.append(previewField, previewNote);
  visualPanel.append(colorInputs, filterField, tintField, fillTileSection, colorReplaceSection, seamRepairSection);
  metaPanel.append(metadataInputs);

  syncScaleControls(selectedTile, selectedTiles.length, scaleModeToggle, scaleXField.input, scaleYField.input, currentEditMode, state);
  syncGroupTransformUi(
    groupTransformActions,
    applyGroupTransformButton,
    cancelGroupTransformButton,
    currentSelectionCount,
    currentEditMode,
    state,
  );
  editorSection.append(editorActions, editorEmpty, editorTabs, layoutPanel, fitPanel, previewPanel, visualPanel, metaPanel);

  layoutTab.addEventListener("click", () => {
    activeEditorTab = "layout";
    syncEditorTabState(activeEditorTab, layoutTab, fitTab, previewTab, visualTab, metaTab, layoutPanel, fitPanel, previewPanel, visualPanel, metaPanel);
  });
  fitTab.addEventListener("click", () => {
    activeEditorTab = "fit";
    syncEditorTabState(activeEditorTab, layoutTab, fitTab, previewTab, visualTab, metaTab, layoutPanel, fitPanel, previewPanel, visualPanel, metaPanel);
  });
  previewTab.addEventListener("click", () => {
    activeEditorTab = "preview";
    syncEditorTabState(activeEditorTab, layoutTab, fitTab, previewTab, visualTab, metaTab, layoutPanel, fitPanel, previewPanel, visualPanel, metaPanel);
  });
  visualTab.addEventListener("click", () => {
    activeEditorTab = "visual";
    syncEditorTabState(activeEditorTab, layoutTab, fitTab, previewTab, visualTab, metaTab, layoutPanel, fitPanel, previewPanel, visualPanel, metaPanel);
  });
  metaTab.addEventListener("click", () => {
    activeEditorTab = "meta";
    syncEditorTabState(activeEditorTab, layoutTab, fitTab, previewTab, visualTab, metaTab, layoutPanel, fitPanel, previewPanel, visualPanel, metaPanel);
  });
  syncEditorTabState(activeEditorTab, layoutTab, fitTab, previewTab, visualTab, metaTab, layoutPanel, fitPanel, previewPanel, visualPanel, metaPanel);

  return {
    section: editorSection,
    update(nextState) {
      const nextSelectedTile = getSelectedOutputTile(nextState);
      const nextSelectedTiles = getSelectedOutputTiles(nextState);
      currentSelectedTile = nextSelectedTile;
      currentSelectionCount = nextState.session.selectedOutputCells.length > 0 ? nextState.session.selectedOutputCells.length : nextSelectedTiles.length;
      currentSelectionBounds = getSelectedOutputBounds(nextState);
      const nextSelectionSignature = getSelectedTileGroupSignature(nextState);
      if (nextSelectionSignature !== currentSelectionSignature) {
        currentSelectionSignature = nextSelectionSignature;
      }
      currentGroupOffsetX = nextState.session.groupOffsetX;
      currentGroupOffsetY = nextState.session.groupOffsetY;
      currentEditMode = nextState.session.tileMultiEditMode;
      previewSelect.value = nextState.session.tilePreviewMode;
      manualFitButton.dataset.active = nextSelectedTile?.fitMode === "manual" ? "true" : "false";
      stretchFitButton.dataset.active = nextSelectedTile?.fitMode === "stretch" ? "true" : "false";
      containFitButton.dataset.active = nextSelectedTile?.fitMode === "contain" ? "true" : "false";
      fitModeNote.textContent = describeFitMode(nextSelectedTile);
      fillTileInput.value = nextState.session.fillTileColor;
      colorReplaceSourceInput.value = nextState.session.colorReplaceSourceColor;
      colorReplaceModeSelect.value = nextState.session.colorReplaceTargetMode;
      colorReplaceTargetInput.value = nextState.session.colorReplaceTargetColor;
      colorReplaceToleranceField.input.value = `${nextState.session.colorReplaceTolerance}`;
      colorReplaceTargetField.hidden = nextState.session.colorReplaceTargetMode !== "color";
      colorReplaceNote.textContent = describeColorReplaceAction(
        nextState.session.colorReplaceSourceColor,
        nextState.session.colorReplaceTargetMode,
        nextState.session.colorReplaceTargetColor,
        nextState.session.colorReplaceTolerance,
      );
      seamRepairDirectionSelect.value = nextState.session.seamRepairDirection;
      seamRepairModeSelect.value = nextState.session.seamRepairMode;
      seamRepairReferenceSelect.value = nextState.session.seamRepairReference;
      seamRepairStripField.input.value = `${nextState.session.seamRepairStripWidth}`;
      seamRepairFalloffField.input.value = `${nextState.session.seamRepairFalloff}`;
      seamRepairStrengthField.input.value = `${nextState.session.seamRepairStrength}`;
      (seamPreviewToggle.querySelector("input") as HTMLInputElement).checked = nextState.session.seamRepairPreview;
      (seamQuantizeToggle.querySelector("input") as HTMLInputElement).checked = nextState.session.seamRepairQuantize;
      (seamContrastToggle.querySelector("input") as HTMLInputElement).checked = nextState.session.seamRepairPreserveContrast;
      (seamRampToggle.querySelector("input") as HTMLInputElement).checked = nextState.session.seamRepairContinueRamp;
      seamRepairNote.textContent = describeSeamRepair(getSeamRepairPair(nextState), nextState);
      anchorXSelect.value = nextSelectedTile?.anchorX ?? "center";
      anchorYSelect.value = nextSelectedTile?.anchorY ?? "center";
      syncSelectedTileEditor(
        nextSelectedTile,
        nextState,
        {
          selectionCount: nextState.session.selectedOutputCells.length > 0 ? nextState.session.selectedOutputCells.length : nextSelectedTiles.length,
          copyButton: copyTileButton,
          pasteButton: pasteTileButton,
          clearButton: clearTileButton,
          empty: editorEmpty,
          tileColInput: tileColField.input,
          tileRowInput: tileRowField.input,
          offsetXInput: offsetXField.input,
          offsetYInput: offsetYField.input,
          scaleXInput: scaleXField.input,
          scaleYInput: scaleYField.input,
          cropLeftInput: cropLeftField.input,
          cropRightInput: cropRightField.input,
          cropTopInput: cropTopField.input,
          cropBottomInput: cropBottomField.input,
          edgeStretchLeftInput: edgeStretchLeftField.input,
          edgeStretchRightInput: edgeStretchRightField.input,
          edgeStretchTopInput: edgeStretchTopField.input,
          edgeStretchBottomInput: edgeStretchBottomField.input,
          fillExposedInput,
          anchorXSelect,
          anchorYSelect,
          brightnessInput: brightnessField.input,
          contrastInput: contrastField.input,
          saturationInput: saturationField.input,
          filterSelect,
          tintInput,
          clampToTileInput: clampToggle.querySelector("input") as HTMLInputElement,
          flipXInput: flipXToggle.querySelector("input") as HTMLInputElement,
          flipYInput: flipYToggle.querySelector("input") as HTMLInputElement,
          pixelSnapInput: pixelSnapToggle.querySelector("input") as HTMLInputElement,
          nameInput: nameField.input,
          tagsInput: tagsField.input,
          collisionInput: collisionField.input,
        },
      );
      syncScaleControls(
        nextSelectedTile,
        currentSelectionCount,
        scaleModeToggle,
        scaleXField.input,
        scaleYField.input,
        currentEditMode,
        nextState,
      );
      syncGroupReferenceControls(
        nextSelectedTile,
        currentSelectionBounds,
        currentSelectionCount,
        currentEditMode,
        tileColField.input,
        tileRowField.input,
        offsetXField.input,
        offsetYField.input,
        currentGroupOffsetX,
        currentGroupOffsetY,
        nextState,
      );
      syncGroupTransformUi(
        groupTransformActions,
        applyGroupTransformButton,
        cancelGroupTransformButton,
        currentSelectionCount,
        currentEditMode,
        nextState,
      );
    },
  };
}

function syncGroupReferenceControls(
  tile: ReturnType<typeof getSelectedOutputTile>,
  bounds: { minCol: number; minRow: number; maxCol: number; maxRow: number } | null,
  selectionCount: number,
  editMode: "individual" | "group",
  tileColInput: HTMLInputElement,
  tileRowInput: HTMLInputElement,
  offsetXInput: HTMLInputElement,
  offsetYInput: HTMLInputElement,
  groupOffsetX: number,
  groupOffsetY: number,
  state: ProjectState,
): void {
  if (selectionCount > 1 && editMode === "group" && bounds) {
    const previewCol = bounds.minCol + Math.round(groupOffsetX / state.project.tileWidth);
    const previewRow = bounds.minRow + Math.round(groupOffsetY / state.project.tileHeight);
    setInputValueUnlessFocused(tileColInput, `${previewCol}`);
    setInputValueUnlessFocused(tileRowInput, `${previewRow}`);
    setInputValueUnlessFocused(offsetXInput, `${groupOffsetX}`);
    setInputValueUnlessFocused(offsetYInput, `${groupOffsetY}`);
    return;
  }

  const previewPatch = state.session.tileLayoutPreview?.patch;
  setInputValueUnlessFocused(tileColInput, `${previewPatch?.destCol ?? tile?.destCol ?? 0}`);
  setInputValueUnlessFocused(tileRowInput, `${previewPatch?.destRow ?? tile?.destRow ?? 0}`);
  setInputValueUnlessFocused(offsetXInput, `${previewPatch?.offsetX ?? tile?.offsetX ?? 0}`);
  setInputValueUnlessFocused(offsetYInput, `${previewPatch?.offsetY ?? tile?.offsetY ?? 0}`);
}

function setInputValueUnlessFocused(input: HTMLInputElement, value: string): void {
  if (document.activeElement === input) {
    return;
  }

  input.value = value;
}

function syncScaleControls(
  tile: ReturnType<typeof getSelectedOutputTile>,
  selectionCount: number,
  scaleModeToggle: HTMLLabelElement,
  scaleXInput: HTMLInputElement,
  scaleYInput: HTMLInputElement,
  scaleApplyMode: "individual" | "group",
  state: ProjectState,
): void {
  const canUseGroupMode = selectionCount > 1;
  scaleModeToggle.hidden = !canUseGroupMode;
  const scaleModeInput = scaleModeToggle.querySelector("input") as HTMLInputElement | null;

  if (!canUseGroupMode) {
    if (scaleModeInput) {
      scaleModeInput.checked = false;
    }
    scaleXInput.value = `${state.session.tileLayoutPreview?.patch.scaleX ?? tile?.scaleX ?? 1}`;
    scaleYInput.value = `${state.session.tileLayoutPreview?.patch.scaleY ?? tile?.scaleY ?? 1}`;
    return;
  }

  if (scaleModeInput) {
    scaleModeInput.checked = scaleApplyMode === "group";
  }

  if (scaleApplyMode === "group") {
    scaleXInput.value = `${state.session.groupScaleX}`;
    scaleYInput.value = `${state.session.groupScaleY}`;
    return;
  }

  scaleXInput.value = `${state.session.tileLayoutPreview?.patch.scaleX ?? tile?.scaleX ?? 1}`;
  scaleYInput.value = `${state.session.tileLayoutPreview?.patch.scaleY ?? tile?.scaleY ?? 1}`;
}

function syncGroupTransformUi(
  actions: HTMLDivElement,
  applyButton: HTMLButtonElement,
  cancelButton: HTMLButtonElement,
  selectionCount: number,
  editMode: "individual" | "group",
  state: ProjectState,
): void {
  const isGroupMode = selectionCount > 1 && editMode === "group";
  const hasIndividualSelection = selectionCount > 0 && editMode === "individual";
  actions.hidden = !(isGroupMode || hasIndividualSelection);

  if (!isGroupMode && !hasIndividualSelection) {
    return;
  }

  const hasPreview = state.session.groupTransformPreview !== null;
  const hasLayoutPreview = state.session.tileLayoutPreview !== null;
  applyButton.disabled = isGroupMode ? !hasPreview : !hasLayoutPreview;
  cancelButton.disabled = isGroupMode ? !hasPreview : !hasLayoutPreview;
}

function createNumberInput(value: number, ariaLabel: string, min?: number, step = 1): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.className = "grid-number-input";
  input.value = `${value}`;
  input.setAttribute("aria-label", ariaLabel);
  if (typeof min === "number") {
    input.min = `${min}`;
  }
  input.step = `${step}`;
  return input;
}

function createLabeledNumberField(label: string, value: number, ariaLabel: string, min?: number, step = 1) {
  const field = document.createElement("label");
  field.className = "number-field";
  const fieldLabel = document.createElement("span");
  fieldLabel.className = "number-field-label";
  fieldLabel.textContent = label;
  const input = createNumberInput(value, ariaLabel, min, step);
  field.append(fieldLabel, input);
  return { field, input };
}

function createLabeledTextField(label: string, value: string, ariaLabel: string) {
  const field = document.createElement("label");
  field.className = "field-group";
  const fieldLabel = document.createElement("span");
  fieldLabel.className = "field-label";
  fieldLabel.textContent = label;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "grid-number-input";
  input.value = value;
  input.setAttribute("aria-label", ariaLabel);
  field.append(fieldLabel, input);
  return { field, input };
}

function createCheckboxField(label: string, checked: boolean, onChange: (checked: boolean) => void): HTMLLabelElement {
  const field = document.createElement("label");
  field.className = "toggle-pill";
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
  button.addEventListener("click", onClick);
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

function createEditorTabButton(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "editor-tab";
  button.textContent = label;
  return button;
}

function syncEditorTabState(
  activeTab: EditorTab,
  layoutTab: HTMLButtonElement,
  fitTab: HTMLButtonElement,
  previewTab: HTMLButtonElement,
  visualTab: HTMLButtonElement,
  metaTab: HTMLButtonElement,
  layoutPanel: HTMLDivElement,
  fitPanel: HTMLDivElement,
  previewPanel: HTMLDivElement,
  visualPanel: HTMLDivElement,
  metaPanel: HTMLDivElement,
): void {
  layoutTab.dataset.active = `${activeTab === "layout"}`;
  fitTab.dataset.active = `${activeTab === "fit"}`;
  previewTab.dataset.active = `${activeTab === "preview"}`;
  visualTab.dataset.active = `${activeTab === "visual"}`;
  metaTab.dataset.active = `${activeTab === "meta"}`;
  layoutPanel.hidden = activeTab !== "layout";
  fitPanel.hidden = activeTab !== "fit";
  previewPanel.hidden = activeTab !== "preview";
  visualPanel.hidden = activeTab !== "visual";
  metaPanel.hidden = activeTab !== "meta";
}

function syncSelectedTileEditor(
  tile: ReturnType<typeof getSelectedOutputTile>,
  state: ProjectState,
  controls: {
    selectionCount: number;
    copyButton: HTMLButtonElement;
    pasteButton: HTMLButtonElement;
    clearButton: HTMLButtonElement;
    empty: HTMLParagraphElement;
    tileColInput: HTMLInputElement;
    tileRowInput: HTMLInputElement;
    offsetXInput: HTMLInputElement;
    offsetYInput: HTMLInputElement;
    scaleXInput: HTMLInputElement;
    scaleYInput: HTMLInputElement;
    cropLeftInput: HTMLInputElement;
    cropRightInput: HTMLInputElement;
    cropTopInput: HTMLInputElement;
    cropBottomInput: HTMLInputElement;
    edgeStretchLeftInput: HTMLInputElement;
    edgeStretchRightInput: HTMLInputElement;
    edgeStretchTopInput: HTMLInputElement;
    edgeStretchBottomInput: HTMLInputElement;
    fillExposedInput: HTMLInputElement;
    anchorXSelect: HTMLSelectElement;
    anchorYSelect: HTMLSelectElement;
    brightnessInput: HTMLInputElement;
    contrastInput: HTMLInputElement;
    saturationInput: HTMLInputElement;
    filterSelect: HTMLSelectElement;
    tintInput: HTMLInputElement;
    clampToTileInput: HTMLInputElement;
    flipXInput: HTMLInputElement;
    flipYInput: HTMLInputElement;
    pixelSnapInput: HTMLInputElement;
    nameInput: HTMLInputElement;
    tagsInput: HTMLInputElement;
    collisionInput: HTMLInputElement;
  },
): void {
  const inputs = [
    controls.tileColInput,
    controls.tileRowInput,
    controls.offsetXInput,
    controls.offsetYInput,
    controls.scaleXInput,
    controls.scaleYInput,
    controls.cropLeftInput,
    controls.cropRightInput,
    controls.cropTopInput,
    controls.cropBottomInput,
    controls.edgeStretchLeftInput,
    controls.edgeStretchRightInput,
    controls.edgeStretchTopInput,
    controls.edgeStretchBottomInput,
    controls.fillExposedInput,
    controls.anchorXSelect,
    controls.anchorYSelect,
    controls.brightnessInput,
    controls.contrastInput,
    controls.saturationInput,
    controls.filterSelect,
    controls.tintInput,
    controls.clampToTileInput,
    controls.flipXInput,
    controls.flipYInput,
    controls.pixelSnapInput,
    controls.nameInput,
    controls.tagsInput,
    controls.collisionInput,
  ];

  if (!tile) {
    controls.copyButton.disabled = true;
    controls.clearButton.disabled = true;
    controls.empty.textContent = controls.selectionCount > 0
      ? "The selected grid area includes no placed tile in the primary cell. Placed tiles inside the selection are still part of the selected patch."
      : "No output tile selected yet. Hold Shift and click to build a multi-selection.";
    for (const input of inputs) {
      input.disabled = true;
    }
    return;
  }

  controls.copyButton.disabled = false;
  controls.pasteButton.disabled = false;
  controls.clearButton.disabled = false;
  controls.empty.textContent = "";
  setInputValueUnlessFocused(controls.tileColInput, `${tile.destCol}`);
  setInputValueUnlessFocused(controls.tileRowInput, `${tile.destRow}`);
  setInputValueUnlessFocused(controls.offsetXInput, `${tile.offsetX}`);
  setInputValueUnlessFocused(controls.offsetYInput, `${tile.offsetY}`);
  controls.scaleXInput.value = `${tile.scaleX}`;
  controls.scaleYInput.value = `${tile.scaleY}`;
  controls.cropLeftInput.value = `${tile.cropLeft}`;
  controls.cropRightInput.value = `${tile.cropRight}`;
  controls.cropTopInput.value = `${tile.cropTop}`;
  controls.cropBottomInput.value = `${tile.cropBottom}`;
  controls.edgeStretchLeftInput.value = `${tile.edgeStretchLeft}`;
  controls.edgeStretchRightInput.value = `${tile.edgeStretchRight}`;
  controls.edgeStretchTopInput.value = `${tile.edgeStretchTop}`;
  controls.edgeStretchBottomInput.value = `${tile.edgeStretchBottom}`;
  controls.fillExposedInput.value = tile.fillExposedColor ?? "";
  controls.anchorXSelect.value = tile.anchorX;
  controls.anchorYSelect.value = tile.anchorY;
  controls.brightnessInput.value = `${tile.brightness}`;
  controls.contrastInput.value = `${tile.contrast}`;
  controls.saturationInput.value = `${tile.saturation}`;
  controls.filterSelect.value = tile.filterMode;
  controls.tintInput.value = tile.tintColor ?? "";
  controls.clampToTileInput.checked = tile.clampToTile;
  controls.flipXInput.checked = controls.selectionCount > 1 && state.session.tileMultiEditMode === "group"
    ? state.session.groupTransformPreview?.flipX ?? false
    : state.session.tileLayoutPreview?.patch.flipX ?? tile.flipX;
  controls.flipYInput.checked = controls.selectionCount > 1 && state.session.tileMultiEditMode === "group"
    ? state.session.groupTransformPreview?.flipY ?? false
    : state.session.tileLayoutPreview?.patch.flipY ?? tile.flipY;
  controls.pixelSnapInput.checked = tile.pixelSnap;
  controls.nameInput.value = tile.name;
  controls.tagsInput.value = tile.tags.join(", ");
  controls.collisionInput.value = tile.collision;

  for (const input of inputs) {
    input.disabled = false;
  }
}

function describeColorReplaceAction(sourceColor: string, targetMode: ColorReplaceTargetMode, targetColor: string, tolerance: number): string {
  const targetLabel = targetMode === "transparent" ? "transparent" : targetColor;
  return `Replace ${sourceColor} with ${targetLabel}. Tolerance ${tolerance} controls how closely nearby colors match.`;
}

function describeFitMode(tile: ReturnType<typeof getSelectedOutputTile>): string {
  if (!tile) {
    return "Select a tile to switch fit mode.";
  }

  const activeLabel = tile.fitMode === "manual"
    ? "Manual keeps the tile's current drawn size."
    : tile.fitMode === "stretch"
      ? "Stretch fills the tile edge to edge."
      : "Contain keeps proportions inside the tile.";

  return `${activeLabel} Square tiles with matching source and output size can look identical across these modes until crop, trim, or scale changes are introduced.`;
}

function describeSeamRepair(seamPair: ReturnType<typeof getSeamRepairPair>, state: ProjectState): string {
  if (!seamPair) {
    return state.session.selectedOutputTileIds.length > 1
      ? "Select tiles with adjacent neighbors in the chosen direction to preview and repair all seams across the selection."
      : "Select a tile with an adjacent neighbor in the chosen direction to preview and repair that seam.";
  }

  const referenceLabel = state.session.seamRepairReference === "primary"
    ? "Selected tile is the reference."
    : state.session.seamRepairReference === "neighbor"
      ? "Neighbor tile is the reference."
      : "Both tiles meet in the middle.";
  const previewLabel = state.session.seamRepairPreview ? "Preview is visible on canvas." : "Enable Preview to inspect before baking.";
  return `Tile ${seamPair.primary.id} and tile ${seamPair.neighbor.id} share the ${state.session.seamRepairDirection} seam. ${referenceLabel} Strength ${state.session.seamRepairStrength.toFixed(2)}. ${previewLabel}`;
}
