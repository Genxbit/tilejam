import type { ProjectState } from "../types/project";
import { getOutputGridMetrics, getProjectIndexRange, getProjectPixelSize, getProjectTileCount, TILE_SIZE_OPTIONS } from "../systems/tileGridSystem";

type ShellOptions = {
  root: HTMLElement;
  state: ProjectState;
  onFileSelected: (file: File) => Promise<void>;
  onProjectSelected: (file: File) => Promise<void>;
  onOpenProject: () => Promise<boolean>;
  onSaveProject: () => Promise<void>;
  onSourceGridSizeChanged: (tileSize: 8 | 16 | 32 | 64) => void;
  onOutputTileSizeChanged: (tileSize: 8 | 16 | 32 | 64) => void;
  onOutputWidthChanged: (width: number) => void;
  onOutputHeightChanged: (height: number) => void;
};

type Shell = {
  canvas: HTMLCanvasElement;
  update: (state: ProjectState) => void;
};

export function createShell({
  root,
  state,
  onFileSelected,
  onProjectSelected,
  onOpenProject,
  onSaveProject,
  onSourceGridSizeChanged,
  onOutputTileSizeChanged,
  onOutputWidthChanged,
  onOutputHeightChanged,
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

  controls.append(sourceSection, outputSection, derivedGridField);

  const metadata = document.createElement("dl");
  metadata.className = "meta-grid";
  const outputPixels = getProjectPixelSize(state.project);
  const outputGrid = getOutputGridMetrics(state.project);

  const items = [
    ["Source", state.sourceImageAsset.name ?? state.project.sourceImage ?? "Not loaded"],
    ["Resolution", `${state.sourceImageAsset.width} x ${state.sourceImageAsset.height}`],
    ["Source grid", `${state.project.sourceTileWidth} x ${state.project.sourceTileHeight}`],
    ["Output tile", `${state.project.tileWidth} x ${state.project.tileHeight}`],
    ["Output grid", `${outputGrid.columns} columns x ${outputGrid.rows} rows`],
    ["Output image", `${outputPixels.width} x ${outputPixels.height}`],
    ["Tile count", `${getProjectTileCount(state.project)}`],
    ["Tile IDs", getProjectIndexRange(state.project)],
  ].map(([label, value]) => createMetaItem(label, value));

  items.forEach((item) => metadata.append(item.term, item.description));

  const notes = document.createElement("p");
  notes.className = "panel-note";
  notes.textContent = state.session.message ?? "";

  panel.append(heading, intro, actions, controls, metadata, notes);
  appShell.append(workspace, panel);
  root.append(appShell);

  return {
    canvas,
    update(nextState) {
      items[0].description.textContent = nextState.sourceImageAsset.name ?? nextState.project.sourceImage ?? "Not loaded";
      items[1].description.textContent = `${nextState.sourceImageAsset.width} x ${nextState.sourceImageAsset.height}`;
      items[2].description.textContent = `${nextState.project.sourceTileWidth} x ${nextState.project.sourceTileHeight}`;
      items[3].description.textContent = `${nextState.project.tileWidth} x ${nextState.project.tileHeight}`;
      const nextOutputGrid = getOutputGridMetrics(nextState.project);
      items[4].description.textContent = `${nextOutputGrid.columns} columns x ${nextOutputGrid.rows} rows`;
      const nextOutputPixels = getProjectPixelSize(nextState.project);
      items[5].description.textContent = `${nextOutputPixels.width} x ${nextOutputPixels.height}`;
      items[6].description.textContent = `${getProjectTileCount(nextState.project)}`;
      items[7].description.textContent = getProjectIndexRange(nextState.project);
      sourceGridSelect.value = `${nextState.project.sourceTileWidth}`;
      outputTileSelect.value = `${nextState.project.tileWidth}`;
      widthInput.value = `${nextState.project.outputWidth}`;
      heightInput.value = `${nextState.project.outputHeight}`;
      derivedGridValue.textContent = `${nextOutputGrid.columns} columns x ${nextOutputGrid.rows} rows`;
      notes.textContent = nextState.session.message ?? "";
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

function createNumberInput(value: number, ariaLabel: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.step = "1";
  input.value = `${value}`;
  input.className = "grid-number-input";
  input.setAttribute("aria-label", ariaLabel);
  return input;
}

function createLabeledNumberField(label: string, value: number, ariaLabel: string): {
  field: HTMLLabelElement;
  input: HTMLInputElement;
} {
  const field = document.createElement("label");
  field.className = "number-field";

  const text = document.createElement("span");
  text.className = "number-field-label";
  text.textContent = label;

  const input = createNumberInput(value, ariaLabel);

  field.append(text, input);

  return { field, input };
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
