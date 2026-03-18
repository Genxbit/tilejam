# ITERATIONS.md

This roadmap follows:

* `docs/PRODUCT.md`
* `docs/TECH_WORKFLOW.md`
* `docs/FORMATS.md`

Keep tickets small. Keep the app runnable.

---

## Ticket 1: Scaffold + layout + image loading

**Status**
Completed

**Goal**
Create app shell, responsive layout, and load source image.

**Prompt**
Set up frontend app with canvas, basic panels, and load/render an image.

**Deliverables**

* project scaffold
* responsive layout (canvas + panel area)
* canvas setup
* image load + render
* foundational `.tilejam.json` load/save path for architecture

**Validation**

* app runs
* layout resizes without breaking
* image visible

---

## Ticket 2: Tile grid

**Goal**
Add grid system.

**Prompt**
Implement tile grid with configurable size.

**Deliverables**

* tile size (8 / 16 / 32)
* grid overlay
* tile indexing

**Validation**

* grid aligns correctly

---

## Ticket 3: Selection + placement (mouse)

**Goal**
Move data from source → tiles.

**Prompt**
Implement mouse selection and assign to grid tiles.

**Deliverables**

* rectangle selection (mouse)
* assign selection to tile
* render tile content

**Validation**

* tile shows selected region
* mouse interactions are correct

---

## Ticket 4: Transform + editor panel (mouse + keyboard)

**Goal**
Adjust tile content.

**Prompt**
Add per-tile transforms and editor panel controls.

**Deliverables**

* move / nudge (keyboard)
* scale X / Y
* flip
* editor panel for tile properties
* keyboard shortcuts for editing

**Validation**

* transforms apply correctly
* keyboard input works
* panel updates state

---

## Ticket 5: Export

**Goal**
Generate usable output.

**Prompt**
Export tileset PNG and TSJ.

**Deliverables**

* PNG export
* TSJ export

**Validation**

* PNG correct
* TSJ loads in Tiled

---

## Ticket 6: Project save/load

**Goal**
Harden project persistence.

**Prompt**
Complete save/load behavior for full editor state.

**Deliverables**

* save project for all editable fields
* load project for all editable fields
* restore full editor session state needed for editing workflow

**Validation**

* project restores state correctly
