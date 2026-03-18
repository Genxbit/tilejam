# Tilejam

Tilejam is a small, data-driven tile editor for turning messy or AI-generated source images into clean, grid-aligned tilesets.

This repository is currently at the first iteration of the product roadmap. The frontend app includes:

* a Vite + TypeScript scaffold
* a responsive workspace layout with canvas and side panel
* default project loading on startup from `latest.tilejam.json`
* manual source image loading from disk
* project JSON load and save support
* canvas rendering of the current source image

The source-of-truth product and workflow docs live in [`docs/PRODUCT.md`](/Users/larsdahllof/Development/tilejam/docs/PRODUCT.md), [`docs/TECH_WORKFLOW.md`](/Users/larsdahllof/Development/tilejam/docs/TECH_WORKFLOW.md), [`docs/FORMATS.md`](/Users/larsdahllof/Development/tilejam/docs/FORMATS.md), and [`docs/ITERATIONS.md`](/Users/larsdahllof/Development/tilejam/docs/ITERATIONS.md).

## Current Status

The project currently implements Ticket 1 from [`docs/ITERATIONS.md`](/Users/larsdahllof/Development/tilejam/docs/ITERATIONS.md):

* project scaffold
* responsive layout
* canvas setup
* source image load and render

Grid editing, tile placement, transforms, and export are planned in later tickets.

The checked-in default project file lives at [`frontend/public/projects/latest.tilejam.json`](/Users/larsdahllof/Development/tilejam/frontend/public/projects/latest.tilejam.json).

## Project Structure

The frontend follows the structure defined in [`docs/TECH_WORKFLOW.md`](/Users/larsdahllof/Development/tilejam/docs/TECH_WORKFLOW.md):

```text
frontend/
  public/
  src/
    app/
    data/
    rendering/
    systems/
    types/
    ui/
```

High-level responsibilities:

* `app/` wires the application together
* `data/` owns editable state
* `systems/` contains domain behavior such as image loading
* `rendering/` draws the current state to canvas
* `ui/` creates the layout and input controls
* `types/` defines shared data shapes

## Run

Requirements:

* Node.js 20+ recommended
* npm 10+ recommended

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

By default, Vite serves the app at:

```text
http://localhost:5174/
```

If that port is busy, Vite will print a different local URL in the terminal. Open the reported URL in your web browser.

On startup, the app attempts to load the default project from [`frontend/public/projects/latest.tilejam.json`](/Users/larsdahllof/Development/tilejam/frontend/public/projects/latest.tilejam.json). If that file cannot be loaded, it falls back to the bundled sample image.

## Test

There is not a formal automated test suite yet. For now, validation is done with a production build and a quick manual smoke test.

Build the app:

```bash
npm run build
```

Optional preview of the production build:

```bash
npm run preview
```

Manual smoke test checklist:

* the app loads without errors
* the default project loads and the source image is visible on the canvas
* the layout stays usable when resizing the window
* choosing a local image updates the canvas and side panel metadata
* loading a `.tilejam.json` file updates the current project state
* saving the project writes back to the opened file in supported browsers
* browsers without file-system write access fall back to save-as or download behavior

## Next Steps

The next roadmap item is Ticket 2: tile grid support with configurable tile sizes and grid overlay rendering.
