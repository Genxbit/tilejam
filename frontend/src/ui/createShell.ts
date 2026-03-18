import type { ProjectState } from "../types/project";
import { getProjectIndexRange, getProjectTileCount, TILE_SIZE_OPTIONS } from "../systems/tileGridSystem";

type ShellOptions = {
  root: HTMLElement;
  state: ProjectState;
  onFileSelected: (file: File) => Promise<void>;
  onProjectSelected: (file: File) => Promise<void>;
  onOpenProject: () => Promise<boolean>;
  onSaveProject: () => Promise<void>;
  onTileSizeChanged: (tileSize: 8 | 16 | 32 | 64) => void;
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
  onTileSizeChanged,
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
  intro.textContent = "Load a source image, review its dimensions, and prepare the workspace for grid-based tile editing.";

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

  const tileSizeField = document.createElement("label");
  tileSizeField.className = "field-group";

  const tileSizeLabel = document.createElement("span");
  tileSizeLabel.className = "field-label";
  tileSizeLabel.textContent = "Tile size";

  const tileSizeSelect = document.createElement("select");
  tileSizeSelect.className = "tile-size-select";
  TILE_SIZE_OPTIONS.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = `${option}`;
    optionElement.textContent = `${option} x ${option}`;
    optionElement.selected = option === state.project.tileWidth;
    tileSizeSelect.append(optionElement);
  });
  tileSizeSelect.addEventListener("change", () => {
    const tileSize = Number.parseInt(tileSizeSelect.value, 10);

    if (tileSize === 8 || tileSize === 16 || tileSize === 32 || tileSize === 64) {
      onTileSizeChanged(tileSize);
    }
  });

  tileSizeField.append(tileSizeLabel, tileSizeSelect);

  const metadata = document.createElement("dl");
  metadata.className = "meta-grid";

  const items = [
    ["Source", state.sourceImageAsset.name ?? state.project.sourceImage ?? "Not loaded"],
    ["Resolution", `${state.sourceImageAsset.width} x ${state.sourceImageAsset.height}`],
    ["Tile size", `${state.project.tileWidth} x ${state.project.tileHeight}`],
    ["Layout", `${state.project.columns} columns x ${state.project.rows} rows`],
    ["Tile count", `${getProjectTileCount(state.project)}`],
    ["Tile IDs", getProjectIndexRange(state.project)],
  ].map(([label, value]) => createMetaItem(label, value));

  items.forEach((item) => metadata.append(item.term, item.description));

  const notes = document.createElement("p");
  notes.className = "panel-note";
  notes.textContent = state.session.message ?? "";

  panel.append(heading, intro, actions, tileSizeField, metadata, notes);
  appShell.append(workspace, panel);
  root.append(appShell);

  return {
    canvas,
    update(nextState) {
      items[0].description.textContent = nextState.sourceImageAsset.name ?? nextState.project.sourceImage ?? "Not loaded";
      items[1].description.textContent = `${nextState.sourceImageAsset.width} x ${nextState.sourceImageAsset.height}`;
      items[2].description.textContent = `${nextState.project.tileWidth} x ${nextState.project.tileHeight}`;
      items[3].description.textContent = `${nextState.project.columns} columns x ${nextState.project.rows} rows`;
      items[4].description.textContent = `${getProjectTileCount(nextState.project)}`;
      items[5].description.textContent = getProjectIndexRange(nextState.project);
      tileSizeSelect.value = `${nextState.project.tileWidth}`;
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
