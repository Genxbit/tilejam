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
* matches architecture rules in `docs/TECH_WORKFLOW.md`

---

## Ticket 2: Tile grid

**Status**
Completed

**Goal**
Add source and target grid system.

**Prompt**
Implement source grid spacing and target/output grid configuration.

**Deliverables**

* tile size (8 / 16 / 32 / 64)
* source grid spacing
* target/output grid size
* grid overlay
* tile indexing

**Validation**

* grid aligns correctly
* matches architecture rules in `docs/TECH_WORKFLOW.md`

---

## Ticket 3: Selection + placement (mouse)

**Status**
Completed

**Goal**
Move data from source tilesheet → target tilesheet.

**Prompt**
Implement source tile selection and assign the selected tiles to target/output tiles.

**Deliverables**

* zoom and pan in source and target grid for easy editing
* source selection snaps to source grid
* one or more source tiles can be selected
* assign selection to target/output tile
* copied content is centered in the target tile
* render tile content in target/output grid

**Validation**

* tile shows selected source tiles
* mouse interactions are correct
* matches architecture rules in `docs/TECH_WORKFLOW.md`

---

## Ticket 4: Transform + editor panel (mouse + keyboard)

**Status**
Completed

**Goal**
Repair and organize placed target/output tiles.

**Prompt**
Add output tile selection, full editor panel controls, seam-repair adjustments, and tile moving.

**Deliverables**

* select a placed output tile in the output grid
* editor panel shows selected tile parameters
* move selected tile to another output grid cell
* edit `offsetX` / `offsetY`
* edit `scaleX` / `scaleY`
* edit `flipX` / `flipY`
* edit color correction parameters
* edit filtering / sampling parameters
* edit `name`, `tags`, and `collision`
* minimal keyboard shortcuts only for moving selected tiles between output cells

**Validation**

* transforms apply correctly
* selected tile updates correctly
* panel edits are reflected in the output grid
* tile can be moved between output cells
* seam-repair adjustments are visible in the preview
* visual adjustments are serializable in project data
* keyboard input works for tile movement
* panel updates state
* matches architecture rules in `docs/TECH_WORKFLOW.md`

---

## Ticket 5: Export

**Status**
Completed

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
* matches architecture rules in `docs/TECH_WORKFLOW.md`

---

## Ticket 6: Project save/load

**Status**
Completed

**Goal**
Harden working-sheet persistence.

**Prompt**
Support loading and saving the current working/output tilesheet as a real editable PNG, while keeping project JSON for richer editor state.

**Deliverables**

* save current working/output tilesheet as PNG
* load current working/output PNG back into the editor
* slice loaded working PNG into editable output-grid tiles
* keep `.tilejam.json` save/load for richer editable project state
* keep undo/redo short and session-local

**Validation**

* working PNG can be reopened and edited tile-by-tile
* PNG load/save matches the output grid correctly
* `.tilejam.json` still restores richer editable state correctly
* matches architecture rules in `docs/TECH_WORKFLOW.md`

---

## Ticket 7: Scene editor + TMJ

**Goal**
Edit scenes using the current tilesheet.

**Docs**

* `docs/PRODUCT.md`
* `docs/TECH_WORKFLOW.md`
* `docs/FORMATS.md`

**Prompt**
Add scene editing with TMJ load/save using the selected/current tilesheet as the palette/source.

**Deliverables**

* scene editor view
* open TMJ
* save TMJ
* scene grid configuration
* place tiles from the current tilesheet into the scene
* select, move, and erase scene tiles
* basic scene layer support

**Validation**

* TMJ opens correctly
* TMJ saves correctly
* scene placement uses the current tilesheet tile IDs correctly
* scene editing stays grid-aligned and deterministic
* matches architecture rules in `docs/TECH_WORKFLOW.md`
