# TECH_WORKFLOW.md

## Overview

Tilejam is a small, data-driven tile editor.

The app should stay:

* grid-based
* state-driven
* deterministic
* easy to extend

Use `docs/PRODUCT.md` as source of truth.
Use `docs/FORMATS.md` as source of truth for project and export formats.

---

## Tech

Frontend:

* TypeScript
* Vite
* Canvas (2D)

No backend required.

---

## File Structure

```text
docs/
  PRODUCT.md
  TECH_WORKFLOW.md
  ITERATIONS.md
  FORMATS.md

frontend/
  public/
  src/
    app/
    data/
    systems/
    rendering/
    ui/
    io/
    services/
    types/
```

---

## Workflow

1. follow `docs/PRODUCT.md`
2. follow `docs/FORMATS.md` for project and export shape
3. implement one ticket at a time
4. keep app runnable
5. validate result

---

## Domains

Define ownership early:

* SourceImage
* WorkingSheet
* TileGrid
* TilePlacement
* Selection
* Transform
* Export
* Project
* Scene

Keep behavior inside its domain.

---

## Architecture

* `app/` = orchestration only
* `systems/` = domain logic
* `data/` = state
* `rendering/` = draw only
* `ui/` = input + panels
* `io/` = save/load/export
* `public/` = bundled sample assets and default project files

Rules:

* less code is less to debug, test, and maintain
* prefer the smallest design that fits
* keep domain ownership explicit
* no logic in UI
* no cross-domain leakage
* prefer direct dependencies over callback plumbing
* callbacks only for top-level UI or app events
* shared rules belong in systems
* rendering stays separate from logic

Rule of thumb:

* what is this → `data/`
* how it behaves → `systems/`
* when it runs → `app/`
* how it looks → `rendering/`

---

## UI
* canvas workspace + editor panels
* mouse input for selection and placement
* keyboard input for shortcuts and nudging
* responsive layout

## Domain Patterns

**SourceImage**

* project stores source image reference as serializable data
* runtime-loaded image asset stays outside serializable project data
* region queries live in a system

**WorkingSheet**

* working/output PNG is a first-class artifact
* loading a working PNG must reconstruct editable output-grid tiles
* working PNG is visual truth for ongoing editing
* project JSON should avoid duplicating baked tile placement when that state can be reconstructed from the working PNG
* if the working PNG is missing, project load should surface that clearly and require relinking instead of silently restoring duplicate tile data

**Scene**

* scene editing is a parallel editor mode to tilesheet editing
* the current tilesheet is the palette/source for scene placement
* TMJ load/save lives in `io/`
* scene placement, selection, and editing logic live in scene systems
* scene state should not be mixed into tilesheet-only systems
* TMJ should be the source of truth for scene content
* project JSON should store at most a scene-file reference, not the embedded scene map

**TileGrid**

* owns size and indexing
* grid math is centralized

**TilePlacement**

* maps source → destination tile
* assignment logic lives in a system

**Selection**

* owns current selection state
* selection math stays out of UI components

**Transform**

* stored in tile placement state
* applied by system logic
* includes seam-repair parameters and visual correction settings
* editor panel is the primary editing surface for per-tile repair

**Export**

* built from project state only
* follows `docs/FORMATS.md`

**Project**

* full editable state
* fully serializable
* matches `docs/FORMATS.md`
* runtime-only browser state must stay separate from project data

---

## Data Model Rule

Serializable project state must fully describe:

* source image
* working image
* grid
* scene file reference
* any extra metadata that is not recoverable from the baked working PNG

No hidden state.

Allowed runtime-only state:

* decoded browser image objects
* transient UI status messages
* browser file handles or object URLs

Runtime-only state must not change export rules or project meaning.

---

## System Rules

* systems operate on explicit data
* UI calls systems
* avoid duplicated logic
* avoid callback chains
* prefer direct dependencies
* project parsing and serialization live in `io/`

---

## Rendering Rule

Rendering is derived.

Do not store rendered state.

---

## Export Rule

Export must be:

* deterministic
* based on project data only
* compatible with `docs/FORMATS.md`

Working-sheet save/load rules:

* saving working PNG is an IO/export concern
* loading working PNG must slice it into output-grid tiles for continued editing
* project load should rebuild working-sheet editing state from the saved working PNG
* undo/redo should stay short and session-local, not act as long-term persistence

Scene rules:

* TMJ load/save is an IO concern
* scene rendering stays derived from scene state
* scene editing should mirror the source/target editing model where helpful
* `.tilejam.json` should not duplicate TMJ layer data
* scene interoperability must follow `docs/FORMATS.md`

---

## Backend Readiness

No backend in v1.

Prepare for later:

* keep IO isolated in `io/`
* keep network logic out of systems
* keep project format transport-safe
* use `services/` for future backend modules
* backend must be additive, not required

---

## Project File

`.tilejam.json` is the editable project container around the PNG-first working-sheet workflow.

It must match `docs/FORMATS.md`.

Notes:

* checked-in sample or default projects may live in `frontend/public/`
* browser file overwrite behavior is an IO concern, not a project-format concern
* working/output PNG is a normal user-facing artifact alongside `.tilejam.json`
* `.tilejam.json` preserves richer editable state, metadata, and references than PNG alone

---

## Ticket Structure

* goal
* prompt
* deliverables
* validation

Keep tickets small.

---

## Done Criteria

* feature works
* app runs
* result validated
* matches `docs/PRODUCT.md` and `docs/FORMATS.md`

---

## Codex Prompt Template

Task
Implement the current ticket from `docs/ITERATIONS.md`.

Docs
`docs/PRODUCT.md`
`docs/TECH_WORKFLOW.md`
`docs/FORMATS.md`

Deliver
Expected systems, files, or behavior.

Validate
How the result should be verified.

If rules are missing, update `docs/PRODUCT.md` or `docs/FORMATS.md` first.
