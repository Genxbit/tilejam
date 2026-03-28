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

**Status**
Completed

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

---

## Ticket 8: PNG-first project persistence cleanup

**Status**
Completed

**Goal**
Align project save/load with the PNG-first working tilesheet model.

**Docs**

* `docs/PRODUCT.md`
* `docs/TECH_WORKFLOW.md`
* `docs/FORMATS.md`

**Prompt**
Update project persistence so the working tilesheet is rebuilt from the saved PNG instead of duplicating baked tile placement in `.tilejam.json`.

**Deliverables**

* project load rebuilds editable output tiles from `workingImage`
* project save stops duplicating baked working-sheet tile placement in `.tilejam.json`
* legacy project files with `tiles[]` remain readable for compatibility
* relative project asset references resolve correctly from the project location when possible
* project and tilesheet naming stay visible and consistent in the UI

**Validation**

* reopening a project restores the working tilesheet from the saved PNG
* `.tilejam.json` and working PNG no longer drift as separate competing truths
* matches architecture rules in `docs/TECH_WORKFLOW.md`

---

## Ticket 9: Scene reference cleanup

**Status**
Completed

**Goal**
Make TMJ the source of truth for scenes and remove embedded scene duplication from `.tilejam.json`.

**Docs**

* `docs/PRODUCT.md`
* `docs/TECH_WORKFLOW.md`
* `docs/FORMATS.md`

**Prompt**
Update project persistence so `.tilejam.json` stores only a scene-file reference, while TMJ remains the source of truth for scene content.

**Deliverables**

* add `sceneFile` reference to project persistence
* stop writing embedded `scene` map data into `.tilejam.json`
* project load can relink and open the referenced TMJ when available
* project save/load keeps scene filename visible and consistent in the UI

**Validation**

* `.tilejam.json` no longer contains embedded TMJ layer data
* reopening a project can restore the current scene from the referenced TMJ
* TMJ remains the only source of truth for scene content
* matches architecture rules in `docs/TECH_WORKFLOW.md`

---

## Ticket 10: Advanced tile repair tools

**Status**
Completed

**Goal**
Add precision tile-repair tools for aligning, fitting, cropping, and seam-checking AI-generated tiles.

**Docs**

* `docs/PRODUCT.md`
* `docs/TECH_WORKFLOW.md`
* `docs/FORMATS.md`

**Prompt**
Extend the tile editor with advanced repair tools for positioning, fitting, cropping, rotation, and seam preview.

**Deliverables**

* nudge image by 1px steps
* free offset inside tile for single-tile editing
* per-side crop: left, right, top, bottom
* clamp to tile bounds
* fit to tile: stretch
* fit to tile: preserve ratio
* anchor align: top, center, bottom, left, right
* edge snap to tile boundaries
* per-edge stretch
* flip X and Y
* rotate in 90 degree steps
* trim transparent bounds
* fill exposed area
* edge extend as a bake-once repair action
* repeat preview
* neighbor preview
* multi-select output tiles with Shift-click
* batch apply tile-repair edits to selected tiles
* group nudge/shift for multi-selection to preserve internal seams
* organize advanced repair tools into a smart tile editor layout with clear grouping and progressive disclosure

**Validation**

* all edits are visible in the tile preview and output sheet
* controls are serializable in project data where applicable
* seam-check previews help evaluate tiling correctness
* multi-select edits apply consistently across the whole selection
* group nudge preserves seams between selected tiles
* edge extend behaves as a one-shot repair action instead of a persistent live effect
* controls fit naturally in the tile editor panel and remain usable without excessive scrolling or confusion
* matches architecture rules in `docs/TECH_WORKFLOW.md`

---

## Ticket 11: UX shell + scene grid visibility

**Status**
Completed

**Goal**
Improve access to project actions and make scene validation easier.

**Docs**

* `docs/PRODUCT.md`
* `docs/TECH_WORKFLOW.md`
* `docs/FORMATS.md`

**Prompt**
Move project-level actions into a persistent top horizontal bar, and add a scene option to show or hide the grid overlay.

**Deliverables**

* move project actions from the right panel into a top horizontal bar that is always visible
* keep project actions easy to access regardless of active sidebar tab
* preserve the current editor-panel structure for tilesheet, tile, and scene editing
* add a scene editor checkbox to toggle scene grid visibility
* scene rendering respects the grid visibility setting without affecting scene data

**Validation**

* project actions remain available at all times in the top bar
* the new top bar fits naturally with the existing layout and does not reduce editor usability
* scene grid can be shown or hidden immediately while editing
* grid visibility toggle helps validate the scene appearance without changing saved scene content
* matches architecture rules in `docs/TECH_WORKFLOW.md`

---

## Ticket 12: Color replace

**Status**
Completed

**Goal**
Improve tile repair with color replacement tools.

**Docs**

* `docs/PRODUCT.md`
* `docs/TECH_WORKFLOW.md`
* `docs/FORMATS.md`

**Prompt**
Add tile color replacement tools to the tile editor.

**Deliverables**

* replace color in selected tile or selected tiles
* replacement target can be transparent or another chosen color
* tolerance control for approximate color matching
* preview and apply flow that fits naturally in the tile editor panel

**Validation**

* selected color can be replaced with transparent
* selected color can be replaced with another chosen color
* tolerance behaves predictably for near-match colors
* controls fit naturally in the existing tile editor UX
* matches architecture rules in `docs/TECH_WORKFLOW.md`

## Ticket 13: Seam repair

**Status**
Completed

**Goal**
Repair visible seams between adjacent tiles while preserving pixel-art sharpness.

**Docs**

* `docs/PRODUCT.md`
* `docs/TECH_WORKFLOW.md`
* `docs/FORMATS.md`

**Prompt**
Add seam-aware tile edge harmonization tools for adjacent output tiles.

**Deliverables**

* analyze color differences between touching edges of adjacent tiles
* support both horizontal and vertical seam repair
* apply color harmonization only in a small seam strip near the shared boundary
* support seam strip width control and directional falloff from the seam inward
* support choosing whether the seam should match toward the selected tile, the neighbor tile, or a balanced midpoint
* support repair strength control
* support seam preview and repair across all touching seam pairs inside a selected tile group
* preserve sharp edges and pixel structure without blur or global smoothing
* support palette-aware or quantized correction so repaired pixels stay crisp
* support repair modes for full color, luminance-only, or chroma-only adjustment
* preserve local contrast while aligning seam tones
* optionally continue local ramps or tones across the seam when helpful
* keep the result deterministic and repeatable
* provide preview before applying
* fit the seam-repair controls naturally into the tile editor UX

**Validation**

* horizontal seams can be previewed and repaired locally
* vertical seams can be previewed and repaired locally
* only the seam region or a small edge strip is modified
* seam strip width and directional falloff behave predictably
* reference-side matching and repair strength behave predictably
* multi-selection seam repair processes all touching seam pairs in the chosen direction deterministically
* the result preserves pixel-art sharpness and does not smear detail
* palette-aware or quantized correction keeps repaired pixels crisp
* full color, luminance-only, and chroma-only modes behave distinctly and predictably
* contrast is preserved near the seam rather than flattened
* no standard blur or full-image smoothing is used
* behavior is predictable and repeatable for the same tiles and settings
* matches architecture rules in `docs/TECH_WORKFLOW.md`

---

## Ticket 14: Scene editor selection + clipboard workflow

**Status**
Completed

**Goal**
Make scene editing more explicit and efficient with multi-selection, copy/paste, and visible edit actions.

**Docs**

* `docs/PRODUCT.md`
* `docs/TECH_WORKFLOW.md`
* `docs/FORMATS.md`

**Prompt**
Add scene multi-selection, grouped move/delete, explicit copy/paste from source and scene, visible scene edit actions, and keyboard undo/redo support.

**Deliverables**

* add rectangle multi-selection in the scene editor
* support moving a single selected scene cell or a selected scene-cell group
* support deleting a single selected scene cell or a selected scene-cell group
* support copying from source selection into the scene clipboard
* support copying from selected scene cells into the scene clipboard
* support explicit scene paste from the clipboard into the scene grid
* stop direct source-to-scene placement after one paste so repeated placement uses explicit paste
* add visible scene action buttons for copy, paste, delete, and move
* add keyboard undo/redo support

**Validation**

* scene rectangle selection highlights the full selected area
* single and multi scene move work by drag, panel controls, and keyboard where applicable
* single and multi scene delete work correctly
* source selection can be copied into the scene paste buffer
* scene selection can be copied and pasted within the scene
* scene paste is explicit and repeatable without hidden auto-stamping
* scene edit actions are visible in the scene editor pane
* undo and redo work from keyboard shortcuts
* matches architecture rules in `docs/TECH_WORKFLOW.md`

---

## Ticket 15: Tilesheet and scene selection workflow alignment

**Status**
Completed

**Goal**
Align tilesheet and scene editing around explicit selection, clipboard, and move behavior.

**Docs**

* `docs/PRODUCT.md`
* `docs/TECH_WORKFLOW.md`
* `docs/FORMATS.md`

**Prompt**
Align the tilesheet editor with the newer scene workflow by making source selection feed the paste buffer, keeping panel controls focused on content edits, and making drag-based movement preserve grouped selections.

**Deliverables**

* copy source selection into the tilesheet paste buffer automatically
* keep tilesheet copy/paste explicit and repeatable
* preserve grouped tile selection when starting drag inside the selected area
* make drag release move the whole selected tile patch instead of falling back to single-tile movement
* keep tile editor directional controls focused on shifting image content inside the selected tile or patch
* remove conflicting tile-position move buttons from the tile editor panel
* keep scene and tilesheet selection/copy/paste semantics more consistent

**Validation**

* source selection in tilesheet mode is immediately ready for explicit paste
* grouped tilesheet drag-move preserves the current selection and moves the whole patch
* tile editor nudge controls still shift image content instead of moving tile positions
* tilesheet and scene copy/paste workflows feel aligned and explicit
* no regressions are introduced in tilesheet or scene editing
* matches architecture rules in `docs/TECH_WORKFLOW.md`

---

## Ticket 16: Scene preview parallax interaction

**Status**
Completed

**Goal**
Make scene preview reflect configured layer parallax without destabilizing scene editing.

**Docs**

* `docs/PRODUCT.md`
* `docs/TECH_WORKFLOW.md`
* `docs/FORMATS.md`

**Prompt**
Add preview-only scene parallax driven by mouse movement over the scene view, while keeping edit-mode layer positioning stable and preserving valid parallax values like `0`.

**Deliverables**

* keep scene edit mode independent of layer parallax values
* add preview-only parallax response for scene layers based on mouse position over the scene view
* use each layer’s configured `parallaxX` and `parallaxY` in preview mode
* keep parallax behavior runtime-only in the editor and preserve TMJ data as the source of truth
* accept `0` as a valid value for `parallaxX` and `parallaxY`

**Validation**

* scene edit mode does not shift layers based on parallax values
* preview mode shows parallax movement when moving the mouse over the scene
* layers with different parallax values move distinctly in preview
* `0` is preserved as a valid parallax value in the editor UI and scene data
* matches architecture rules in `docs/TECH_WORKFLOW.md`

---

## Ticket 17: Scene image layers + TMJ layer types

**Status**
Completed

**Goal**
Extend scene/TMJ support beyond tile layers with explicit image-layer backgrounds.

**Docs**

* `docs/PRODUCT.md`
* `docs/TECH_WORKFLOW.md`
* `docs/FORMATS.md`

**Prompt**
Add TMJ scene support for `imagelayer` alongside the current default `tilelayer`, including image reference, preview rendering, and `repeatx` / `repeaty` background behavior.

**Deliverables**

* keep `tilelayer` as the default editable scene layer type
* add scene-layer data and TMJ IO support for `imagelayer`
* add `imagelayer` support in the scene editor panel
* add a layer type selector for `tilelayer` and `imagelayer`
* add an `Open image` action for the selected image layer in the scene editor panel
* show and edit the selected image-layer image path in the scene editor panel
* support shared layer opacity controls in the scene editor for all supported layer types
* support a single image reference for each image layer
* support `repeatx` and `repeaty` for background-style image layers
* preserve `offsetx`, `offsety`, `parallaxx`, and `parallaxy` for image layers
* keep tile-grid editing behavior scoped to `tilelayer`

**Validation**

* TMJ load/save preserves both `tilelayer` and `imagelayer` correctly
* `tilelayer` editing continues to work as before
* `imagelayer` can be created and edited from the scene editor panel
* image can be picked from the scene editor panel for an imagelayer
* chosen image path is visible in the scene editor and preserved in TMJ
* opacity works correctly for all supported layer types in the scene editor
* image layers can render a referenced background image in the scene editor
* `repeatx` and `repeaty` behave predictably in preview
* matches architecture rules in `docs/TECH_WORKFLOW.md`

---

## Ticket 18: Refactor grouped tile editing + tile editor UI

**Status**
Completed

**Goal**
Reduce complexity in grouped tile editing and the tile editor UI without changing behavior.

**Docs**

* `docs/PRODUCT.md`
* `docs/TECH_WORKFLOW.md`
* `docs/FORMATS.md`

**Prompt**
Refactor grouped tile bake/edit operations out of the app controller, and split the tile editor UI construction into smaller focused helpers while preserving current behavior.

**Deliverables**

* extract grouped tile bake operations from `frontend/src/app/createAppController.ts` into a dedicated system or helper module
* keep grouped nudge, flip, scale, color replace, seam repair, and related tile-bake behavior functionally unchanged
* reduce orchestration complexity in `frontend/src/app/createAppController.ts`
* split tile editor UI construction in `frontend/src/ui/createShell.ts` into smaller focused helpers
* preserve current tile editor layout, control behavior, and editor messaging
* keep runtime-only editor/session state separate from persisted project data

**Validation**

* grouped tile edit behavior matches current behavior before the refactor
* `frontend/src/app/createAppController.ts` has less grouped-edit implementation detail and remains focused on orchestration
* `frontend/src/ui/createShell.ts` is easier to navigate and the tile editor UI is split into clearer helper units
* no project format or workflow regressions are introduced
* matches architecture rules in `docs/TECH_WORKFLOW.md`

---

## Ticket 19: Layout preview workflow + drag interaction alignment

**Status**
Completed

**Goal**
Make tile layout editing preview-first, align drag interactions with selection and layout apply behavior, and keep the implementation consistent with the architecture rules.

**Docs**

* `docs/PRODUCT.md`
* `docs/TECH_WORKFLOW.md`
* `docs/FORMATS.md`

**Prompt**
Add non-destructive layout preview for tile and group edits, make drag-based movement use the same merged layout apply behavior, improve output-panel drag selection vs move interactions, and extract preview logic into dedicated systems.

**Deliverables**

* preview-first layout workflow for `Tile col`, `Tile row`, `Offset X/Y`, `Scale X/Y`, and `Flip X/Y`
* explicit `Apply Layout` / `Cancel` flow for layout edits
* whole-group layout preview rendered as a temporary overlay before apply
* group apply merges with overlapping tiles behind instead of erasing to black
* drag-release move uses the same merged layout apply behavior as the editor panel
* plain output drag creates or expands selection
* output tile move by mouse requires modifier drag
* live drag preview for moved tile groups before release
* output selection highlight follows previewed group movement correctly
* preview/drag lifecycle and selection/signature helpers extracted into dedicated systems

**Validation**

* single-tile and grouped layout edits preview before apply
* `Apply Layout` commits the visible preview result
* grouped layout apply preserves overlapping content behind the transformed result
* output drag selection and modifier-drag move no longer conflict
* dragged tile groups are visible while moving before release
* selection bounds stay correct after repeated layout applies and moves
* preview and drag logic live primarily in `systems/`, while `app/` stays focused on orchestration
* matches architecture rules in `docs/TECH_WORKFLOW.md`

---

## Ticket 20: Workspace navigation + panel hierarchy cleanup

**Status**
Completed

**Goal**
Make navigation clearer and reduce panel clutter by separating major workspaces from workspace-specific editing subtabs.

**Docs**

* `docs/PRODUCT.md`
* `docs/TECH_WORKFLOW.md`
* `docs/FORMATS.md`

**Prompt**
Restructure the editor navigation so top-level tabs represent major workspaces only, move tilesheet and scene editing into their own sub-tab hierarchies, and remove redundant panel copy that duplicates the top toolbar.

**Deliverables**

* top-level editor tabs focus on major contexts such as `Tilesheet` and `Scene`
* remove redundant tilesheet intro/header copy that repeats app identity or obvious workflow guidance already covered by the top toolbar
* add sub-tabs inside `Tilesheet` to separate sheet-level and tile-level workflows
* add sub-tabs inside `Scene` to separate scene/map-level, layer-level, and selection-level workflows where appropriate
* keep the navigation hierarchy consistent across both workspaces
* reduce vertical scrolling pressure by distributing controls into clearer workspace-specific sections
* preserve current editing behavior while improving discoverability and information hierarchy

**Validation**

* top-level tabs clearly represent workspace context rather than mixed tool scopes
* tilesheet editing feels easier to understand because sheet-level and tile-level controls are separated
* scene editing uses the same parent/sub-tab navigation pattern as tilesheet editing
* redundant header copy is removed from the normal editor flow
* panel navigation reduces scrolling and makes common tasks easier to find
* matches architecture rules in `docs/TECH_WORKFLOW.md`

---

## Ticket 21: Compact workspace tab UX + panel simplification

**Status**
Completed

**Goal**
Redesign the sidebar tab layouts so each workspace sub-tab has a compact, task-first structure with smarter grouping and fewer low-value panels.

**Docs**

* `docs/PRODUCT.md`
* `docs/TECH_WORKFLOW.md`
* `docs/FORMATS.md`

**Prompt**
Refine the `Tilesheet -> Sheet`, `Tilesheet -> Tile`, `Scene -> Map`, `Scene -> Layers`, and `Scene -> Selection` tabs so controls are regrouped around user intent, redundant framing is removed, and only panels with a clear purpose remain.

**Deliverables**

* redesign `Tilesheet -> Sheet` around:
  * `Files & Export`
  * `Sheet Setup`
  * `Sheet Actions`
  * compact `Status`
* redesign `Tilesheet -> Tile` around:
  * top-level selection action row
  * one strong `Layout` panel
  * `Tile Processing`
  * `Repair & Color`
  * compact `Preview & Properties`
* redesign `Scene -> Map` around:
  * `Scene Setup`
  * `Preview`
  * compact `Scene Status`
* redesign `Scene -> Layers` around:
  * `Layer Stack`
  * `Layer Settings`
  * conditional `Image Layer`
* redesign `Scene -> Selection` around:
  * `Selection Actions`
  * compact `Selection Status`
* merge or remove existing panels that do not create clarity, reduce risk, or support a distinct task
* reduce repeated helper copy and let grouping, ordering, and labels carry more of the UX
* keep the navigation hierarchy from Ticket 20 while improving compactness, scanability, and visual focus inside each tab
* keep all existing features available and supported after the layout redesign, even if they move to a different group or panel

**Validation**

* each sub-tab has a clear primary task and shorter scanning path
* important actions appear before low-frequency metadata or status
* redundant boxes, copy, or panel chrome are removed where they do not help
* panels are only used where they meaningfully separate workflows or conditional content
* the sidebar feels more compact without making controls harder to understand
* all current features remain supported and reachable after the redesign
* behavior is preserved while the layout and grouping become easier to learn
* matches architecture rules in `docs/TECH_WORKFLOW.md`

---

## Ticket 22: Amiga-inspired UI styling + tab row polish

**Status**
Completed

**Goal**
Upgrade the editor UI from a generic form layout into a more intentional tool surface with Amiga-inspired styling, clearer tab rows, and stronger visual hierarchy.

**Docs**

* `docs/PRODUCT.md`
* `docs/TECH_WORKFLOW.md`

**Prompt**
Restyle the shell, panels, tabs, buttons, and inputs so the editor feels more tactile and coherent. Use an Amiga-inspired visual language to improve hierarchy and make tab sets read as real tab rows rather than isolated controls.

**Deliverables**

* redesign top workspace tabs, workspace sub-tabs, and tile editor tabs as clearer connected tab rows
* replace overly generic button/input/panel styling with a more tactile Amiga-inspired control system
* improve active, hover, and pressed states so primary controls are easier to read
* strengthen section framing and spacing so important groups stand out without over-framing everything
* reduce the feeling that all controls are the same generic rounded element
* preserve all current features and layouts while improving the visual system

**Validation**

* top-level tabs and sub-tabs read as real tab rows rather than isolated buttons
* panels and controls have clearer hierarchy and more intentional styling
* the UI feels more compact, distinctive, and tool-like
* existing features remain supported and behavior stays unchanged
* matches architecture rules in `docs/TECH_WORKFLOW.md`
