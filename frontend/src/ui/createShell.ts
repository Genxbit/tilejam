import type { ProjectState, TileFilterMode } from "../types/project";
import { getSelectedOutputTile } from "../systems/tileEditorSystem";
import { getOutputGridMetrics, getProjectIndexRange, getProjectPixelSize, getProjectTileCount, TILE_SIZE_OPTIONS } from "../systems/tileGridSystem";
import { getAssignedTileCount } from "../systems/tilePlacementSystem";
import { getVisibleSelection } from "../systems/selectionSystem";

type ShellOptions = {
  root: HTMLElement;
  state: ProjectState;
  onFileSelected: (file: File) => Promise<void>;
  onProjectSelected: (file: File) => Promise<void>;
  onOpenProject: () => Promise<boolean>;
  onSaveProject: () => Promise<void>;
  onExportPng: () => Promise<void>;
  onExportTsj: () => Promise<void>;
  onSourceGridSizeChanged: (tileSize: 8 | 16 | 32 | 64) => void;
  onOutputTileSizeChanged: (tileSize: 8 | 16 | 32 | 64) => void;
  onOutputWidthChanged: (width: number) => void;
  onOutputHeightChanged: (height: number) => void;
  onSelectedTileUpdated: (patch: SelectedTilePatch) => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopyAllTiles: () => void;
};

type SelectedTilePatch = {
  destCol?: number;
  destRow?: number;
  offsetX?: number;
  offsetY?: number;
  scaleX?: number;
  scaleY?: number;
  flipX?: boolean;
  flipY?: boolean;
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

type Shell = {
  canvas: HTMLCanvasElement;
  update: (state: ProjectState) => void;
};

type EditorTab = "layout" | "visual" | "meta";
type SidebarTab = "project" | "editor";

export function createShell({
  root,
  state,
  onFileSelected,
  onProjectSelected,
  onOpenProject,
  onSaveProject,
  onExportPng,
  onExportTsj,
  onSourceGridSizeChanged,
  onOutputTileSizeChanged,
  onOutputWidthChanged,
  onOutputHeightChanged,
  onSelectedTileUpdated,
  onUndo,
  onRedo,
  onCopyAllTiles,
}: ShellOptions): Shell {
  root.innerHTML = "";

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

  const heading = document.createElement("h1");
  heading.className = "panel-title";
  heading.textContent = "Tilejam";

  const intro = document.createElement("p");
  intro.className = "panel-copy";
  intro.textContent = "Configure the source tilesheet grid and the target/output tilesheet before moving tiles across.";

  const inputLabel = document.createElement("label");
  inputLabel.className = "file-input";
  inputLabel.textContent = "Choose image";

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

  const projectInputLabel = document.createElement("label");
  projectInputLabel.className = "file-input file-input-secondary";
  projectInputLabel.textContent = "Open project";

  const projectInput = document.createElement("input");
  projectInput.type = "file";
  projectInput.accept = ".json,.tilejam.json,application/json";
  projectInput.addEventListener("change", async () => {
    const file = projectInput.files?.[0];

    if (!file) {
      return;
    }

    await onProjectSelected(file);
    projectInput.value = "";
  });

  projectInputLabel.append(projectInput);

  projectInputLabel.addEventListener("click", async (event) => {
    event.preventDefault();

    const handled = await onOpenProject();

    if (!handled) {
      projectInput.click();
    }
  });

  const saveProjectButton = document.createElement("button");
  saveProjectButton.type = "button";
  saveProjectButton.className = "file-input file-input-secondary";
  saveProjectButton.textContent = "Save project";
  saveProjectButton.addEventListener("click", async () => {
    await onSaveProject();
  });

  const actions = document.createElement("div");
  actions.className = "panel-actions";
  actions.append(inputLabel, projectInputLabel, saveProjectButton);

  const historyActions = document.createElement("div");
  historyActions.className = "panel-actions";
  const undoButton = createActionButton("Undo", onUndo);
  const redoButton = createActionButton("Redo", onRedo);
  const copyAllButton = createActionButton("Copy All Tiles", onCopyAllTiles);
  historyActions.append(undoButton, redoButton, copyAllButton);

  const exportActions = document.createElement("div");
  exportActions.className = "panel-actions";
  const exportPngButton = createAsyncActionButton("Export PNG", onExportPng);
  const exportTsjButton = createAsyncActionButton("Export TSJ", onExportTsj);
  exportActions.append(exportPngButton, exportTsjButton);

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

  const controls = document.createElement("div");
  controls.className = "grid-controls";

  const sourceSection = createControlSection("Source Grid", "Choose how the incoming tilesheet is divided.");
  sourceSection.append(sourceGridField);

  const outputSection = createControlSection("Output Sheet", "Set the exported image size first, then choose tile size.");
  outputSection.append(outputGridField, outputTileField);

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
  let activeSidebarTab: SidebarTab = "project";
  const editorSection = createControlSection(
    "Tile Editor",
    "Select a placed output tile to repair seams, move it, and adjust export settings.",
  );
  let activeEditorTab: EditorTab = "layout";
  const editorEmpty = document.createElement("p");
  editorEmpty.className = "field-note";
  editorEmpty.textContent = selectedTile ? "" : "No output tile selected yet.";

  const selectedTileSummary = document.createElement("div");
  selectedTileSummary.className = "derived-value";
  selectedTileSummary.textContent = selectedTile
    ? `Tile ${selectedTile.id} at ${selectedTile.destCol}, ${selectedTile.destRow}`
    : "No selection";

  const editorTabs = document.createElement("div");
  editorTabs.className = "editor-tabs";
  const layoutTab = createEditorTabButton("Layout");
  const visualTab = createEditorTabButton("Visual");
  const metaTab = createEditorTabButton("Meta");
  editorTabs.append(layoutTab, visualTab, metaTab);

  const layoutPanel = document.createElement("div");
  layoutPanel.className = "editor-tab-panel";
  const visualPanel = document.createElement("div");
  visualPanel.className = "editor-tab-panel";
  const metaPanel = document.createElement("div");
  metaPanel.className = "editor-tab-panel";

  const tileCellInputs = document.createElement("div");
  tileCellInputs.className = "grid-inputs";
  const tileColField = createLabeledNumberField("Tile col", selectedTile?.destCol ?? 0, "Selected tile column", 0, 1);
  const tileRowField = createLabeledNumberField("Tile row", selectedTile?.destRow ?? 0, "Selected tile row", 0, 1);
  tileColField.input.addEventListener("change", () => {
    onSelectedTileUpdated({ destCol: Math.max(0, Number.parseInt(tileColField.input.value, 10) || 0) });
  });
  tileRowField.input.addEventListener("change", () => {
    onSelectedTileUpdated({ destRow: Math.max(0, Number.parseInt(tileRowField.input.value, 10) || 0) });
  });
  tileCellInputs.append(tileColField.field, tileRowField.field);

  const offsetInputs = document.createElement("div");
  offsetInputs.className = "grid-inputs";
  const offsetXField = createLabeledNumberField("Offset X", selectedTile?.offsetX ?? 0, "Offset X", undefined, 1);
  const offsetYField = createLabeledNumberField("Offset Y", selectedTile?.offsetY ?? 0, "Offset Y", undefined, 1);
  offsetXField.input.addEventListener("change", () => {
    onSelectedTileUpdated({ offsetX: Number.parseFloat(offsetXField.input.value) || 0 });
  });
  offsetYField.input.addEventListener("change", () => {
    onSelectedTileUpdated({ offsetY: Number.parseFloat(offsetYField.input.value) || 0 });
  });
  offsetInputs.append(offsetXField.field, offsetYField.field);

  const scaleInputs = document.createElement("div");
  scaleInputs.className = "grid-inputs";
  const scaleXField = createLabeledNumberField("Scale X", selectedTile?.scaleX ?? 1, "Scale X", 0.1, 0.1);
  const scaleYField = createLabeledNumberField("Scale Y", selectedTile?.scaleY ?? 1, "Scale Y", 0.1, 0.1);
  scaleXField.input.addEventListener("change", () => {
    onSelectedTileUpdated({ scaleX: Math.max(0.1, Number.parseFloat(scaleXField.input.value) || 1) });
  });
  scaleYField.input.addEventListener("change", () => {
    onSelectedTileUpdated({ scaleY: Math.max(0.1, Number.parseFloat(scaleYField.input.value) || 1) });
  });
  scaleInputs.append(scaleXField.field, scaleYField.field);

  const colorInputs = document.createElement("div");
  colorInputs.className = "grid-inputs";
  const brightnessField = createLabeledNumberField("Brightness", selectedTile?.brightness ?? 0, "Brightness", undefined, 0.1);
  const contrastField = createLabeledNumberField("Contrast", selectedTile?.contrast ?? 1, "Contrast", 0.1, 0.1);
  const saturationField = createLabeledNumberField("Saturation", selectedTile?.saturation ?? 1, "Saturation", 0.1, 0.1);
  brightnessField.input.addEventListener("change", () => {
    onSelectedTileUpdated({ brightness: Number.parseFloat(brightnessField.input.value) || 0 });
  });
  contrastField.input.addEventListener("change", () => {
    onSelectedTileUpdated({ contrast: Math.max(0.1, Number.parseFloat(contrastField.input.value) || 1) });
  });
  saturationField.input.addEventListener("change", () => {
    onSelectedTileUpdated({ saturation: Math.max(0.1, Number.parseFloat(saturationField.input.value) || 1) });
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
      onSelectedTileUpdated({ filterMode: value });
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
    onSelectedTileUpdated({ tintColor: value.length > 0 ? value : null });
  });
  tintField.append(tintLabel, tintInput);

  const toggleRow = document.createElement("div");
  toggleRow.className = "toggle-row";
  const flipXToggle = createCheckboxField("Flip X", selectedTile?.flipX ?? false, (checked) => {
    onSelectedTileUpdated({ flipX: checked });
  });
  const flipYToggle = createCheckboxField("Flip Y", selectedTile?.flipY ?? false, (checked) => {
    onSelectedTileUpdated({ flipY: checked });
  });
  const pixelSnapToggle = createCheckboxField("Pixel snap", selectedTile?.pixelSnap ?? true, (checked) => {
    onSelectedTileUpdated({ pixelSnap: checked });
  });
  toggleRow.append(flipXToggle, flipYToggle, pixelSnapToggle);

  const metadataInputs = document.createElement("div");
  metadataInputs.className = "editor-stack";
  const nameField = createLabeledTextField("Name", selectedTile?.name ?? "", "Tile name");
  nameField.input.addEventListener("change", () => {
    onSelectedTileUpdated({ name: nameField.input.value.trim() });
  });
  const tagsField = createLabeledTextField("Tags", selectedTile?.tags.join(", ") ?? "", "Tile tags");
  tagsField.input.addEventListener("change", () => {
    const tags = tagsField.input.value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    onSelectedTileUpdated({ tags });
  });
  const collisionField = createLabeledTextField("Collision", selectedTile?.collision ?? "none", "Tile collision");
  collisionField.input.addEventListener("change", () => {
    onSelectedTileUpdated({ collision: collisionField.input.value.trim() || "none" });
  });
  metadataInputs.append(nameField.field, tagsField.field, collisionField.field);

  layoutPanel.append(tileCellInputs, offsetInputs, scaleInputs, toggleRow);
  visualPanel.append(colorInputs, filterField, tintField);
  metaPanel.append(metadataInputs);

  editorSection.append(selectedTileSummary, editorEmpty, editorTabs, layoutPanel, visualPanel, metaPanel);

  layoutTab.addEventListener("click", () => {
    activeEditorTab = "layout";
    syncEditorTabState(activeEditorTab, layoutTab, visualTab, metaTab, layoutPanel, visualPanel, metaPanel);
  });
  visualTab.addEventListener("click", () => {
    activeEditorTab = "visual";
    syncEditorTabState(activeEditorTab, layoutTab, visualTab, metaTab, layoutPanel, visualPanel, metaPanel);
  });
  metaTab.addEventListener("click", () => {
    activeEditorTab = "meta";
    syncEditorTabState(activeEditorTab, layoutTab, visualTab, metaTab, layoutPanel, visualPanel, metaPanel);
  });
  syncEditorTabState(activeEditorTab, layoutTab, visualTab, metaTab, layoutPanel, visualPanel, metaPanel);

  const metadata = document.createElement("dl");
  metadata.className = "meta-grid";
  const outputPixels = getProjectPixelSize(state.project);
  const outputGrid = getOutputGridMetrics(state.project);

  const items = [
    ["Source", state.sourceImageAsset.name ?? state.project.sourceImage ?? "Not loaded"],
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

  controls.append(sourceSection, outputSection, derivedGridField);

  const sidebarTabs = document.createElement("div");
  sidebarTabs.className = "sidebar-tabs";
  const projectTab = createSidebarTabButton("Project");
  const editorTab = createSidebarTabButton("Editor");
  sidebarTabs.append(projectTab, editorTab);

  const projectPanel = document.createElement("div");
  projectPanel.className = "sidebar-tab-panel";
  projectPanel.append(controls, metadata);

  const editorPanel = document.createElement("div");
  editorPanel.className = "sidebar-tab-panel";
  editorPanel.append(editorSection);

  projectTab.addEventListener("click", () => {
    activeSidebarTab = "project";
    syncSidebarTabState(activeSidebarTab, projectTab, editorTab, projectPanel, editorPanel);
  });
  editorTab.addEventListener("click", () => {
    activeSidebarTab = "editor";
    syncSidebarTabState(activeSidebarTab, projectTab, editorTab, projectPanel, editorPanel);
  });
  syncSidebarTabState(activeSidebarTab, projectTab, editorTab, projectPanel, editorPanel);

  const notes = document.createElement("p");
  notes.className = "panel-note";
  notes.textContent = state.session.message ?? "";

  panel.append(heading, intro, actions, historyActions, exportActions, sidebarTabs, projectPanel, editorPanel, notes);
  appShell.append(workspace, panel);
  root.append(appShell);

  return {
    canvas,
    update(nextState) {
      const scrollTop = panel.scrollTop;
      items[0].description.textContent = nextState.sourceImageAsset.name ?? nextState.project.sourceImage ?? "Not loaded";
      items[1].description.textContent = `${nextState.sourceImageAsset.width} x ${nextState.sourceImageAsset.height}`;
      items[2].description.textContent = `${nextState.project.sourceTileWidth} x ${nextState.project.sourceTileHeight}`;
      const selection = getVisibleSelection(nextState);
      items[3].description.textContent = selection ? `${selection.columns} x ${selection.rows} source tiles` : "None";
      items[4].description.textContent = `${nextState.project.tileWidth} x ${nextState.project.tileHeight}`;
      const nextOutputGrid = getOutputGridMetrics(nextState.project);
      items[5].description.textContent = `${nextOutputGrid.columns} columns x ${nextOutputGrid.rows} rows`;
      const nextOutputPixels = getProjectPixelSize(nextState.project);
      items[6].description.textContent = `${nextOutputPixels.width} x ${nextOutputPixels.height}`;
      items[7].description.textContent = `${getAssignedTileCount(nextState)}`;
      items[8].description.textContent = `${getProjectTileCount(nextState.project)}`;
      items[9].description.textContent = getProjectIndexRange(nextState.project);
      const nextSelectedTile = getSelectedOutputTile(nextState);
      items[10].description.textContent = nextSelectedTile ? `${nextSelectedTile.id}` : "None";
      sourceGridSelect.value = `${nextState.project.sourceTileWidth}`;
      outputTileSelect.value = `${nextState.project.tileWidth}`;
      widthInput.value = `${nextState.project.outputWidth}`;
      heightInput.value = `${nextState.project.outputHeight}`;
      derivedGridValue.textContent = `${nextOutputGrid.columns} columns x ${nextOutputGrid.rows} rows`;
      syncSelectedTileEditor(
        nextSelectedTile,
        {
          summary: selectedTileSummary,
          empty: editorEmpty,
          tileColInput: tileColField.input,
          tileRowInput: tileRowField.input,
          offsetXInput: offsetXField.input,
          offsetYInput: offsetYField.input,
          scaleXInput: scaleXField.input,
          scaleYInput: scaleYField.input,
          brightnessInput: brightnessField.input,
          contrastInput: contrastField.input,
          saturationInput: saturationField.input,
          filterSelect,
          tintInput,
          flipXInput: flipXToggle.querySelector("input") as HTMLInputElement,
          flipYInput: flipYToggle.querySelector("input") as HTMLInputElement,
          pixelSnapInput: pixelSnapToggle.querySelector("input") as HTMLInputElement,
          nameInput: nameField.input,
          tagsInput: tagsField.input,
          collisionInput: collisionField.input,
        },
      );
      notes.textContent = nextState.session.message ?? "";
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
  visualTab: HTMLButtonElement,
  metaTab: HTMLButtonElement,
  layoutPanel: HTMLDivElement,
  visualPanel: HTMLDivElement,
  metaPanel: HTMLDivElement,
): void {
  layoutTab.dataset.active = activeTab === "layout" ? "true" : "false";
  visualTab.dataset.active = activeTab === "visual" ? "true" : "false";
  metaTab.dataset.active = activeTab === "meta" ? "true" : "false";
  layoutPanel.hidden = activeTab !== "layout";
  visualPanel.hidden = activeTab !== "visual";
  metaPanel.hidden = activeTab !== "meta";
}

function syncSidebarTabState(
  activeTab: SidebarTab,
  projectTab: HTMLButtonElement,
  editorTab: HTMLButtonElement,
  projectPanel: HTMLDivElement,
  editorPanel: HTMLDivElement,
): void {
  projectTab.dataset.active = activeTab === "project" ? "true" : "false";
  editorTab.dataset.active = activeTab === "editor" ? "true" : "false";
  projectPanel.hidden = activeTab !== "project";
  editorPanel.hidden = activeTab !== "editor";
}

function syncSelectedTileEditor(
  tile: ReturnType<typeof getSelectedOutputTile>,
  controls: {
    summary: HTMLDivElement;
    empty: HTMLParagraphElement;
    tileColInput: HTMLInputElement;
    tileRowInput: HTMLInputElement;
    offsetXInput: HTMLInputElement;
    offsetYInput: HTMLInputElement;
    scaleXInput: HTMLInputElement;
    scaleYInput: HTMLInputElement;
    brightnessInput: HTMLInputElement;
    contrastInput: HTMLInputElement;
    saturationInput: HTMLInputElement;
    filterSelect: HTMLSelectElement;
    tintInput: HTMLInputElement;
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
    controls.brightnessInput,
    controls.contrastInput,
    controls.saturationInput,
    controls.filterSelect,
    controls.tintInput,
    controls.flipXInput,
    controls.flipYInput,
    controls.pixelSnapInput,
    controls.nameInput,
    controls.tagsInput,
    controls.collisionInput,
  ];

  if (!tile) {
    controls.summary.textContent = "No selection";
    controls.empty.textContent = "No output tile selected yet.";
    for (const input of inputs) {
      input.disabled = true;
    }
    return;
  }

  controls.summary.textContent = `Tile ${tile.id} at ${tile.destCol}, ${tile.destRow}`;
  controls.empty.textContent = "";
  controls.tileColInput.value = `${tile.destCol}`;
  controls.tileRowInput.value = `${tile.destRow}`;
  controls.offsetXInput.value = `${tile.offsetX}`;
  controls.offsetYInput.value = `${tile.offsetY}`;
  controls.scaleXInput.value = `${tile.scaleX}`;
  controls.scaleYInput.value = `${tile.scaleY}`;
  controls.brightnessInput.value = `${tile.brightness}`;
  controls.contrastInput.value = `${tile.contrast}`;
  controls.saturationInput.value = `${tile.saturation}`;
  controls.filterSelect.value = tile.filterMode;
  controls.tintInput.value = tile.tintColor ?? "";
  controls.flipXInput.checked = tile.flipX;
  controls.flipYInput.checked = tile.flipY;
  controls.pixelSnapInput.checked = tile.pixelSnap;
  controls.nameInput.value = tile.name;
  controls.tagsInput.value = tile.tags.join(", ");
  controls.collisionInput.value = tile.collision;

  for (const input of inputs) {
    input.disabled = false;
  }
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
