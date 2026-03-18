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
* TileGrid
* TilePlacement
* Selection
* Transform
* Export
* Project

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
* grid
* tile assignments
* transforms

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

`.tilejam.json` is the editable source of truth.

It must match `docs/FORMATS.md`.

Notes:

* checked-in sample or default projects may live in `frontend/public/`
* browser file overwrite behavior is an IO concern, not a project-format concern

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
