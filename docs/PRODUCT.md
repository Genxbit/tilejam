# PRODUCT.md

## Overview

Tilejam is a tool for converting messy or AI-generated tilesheets into clean, grid-aligned output tilesets.

It also grows into a scene editor that uses the cleaned tilesheet as the palette for building maps.

---

## Workflow

1. create or open project
2. load source tilesheet
3. create a new working/output tilesheet or load an existing working/output PNG
4. set source grid spacing
5. configure target/output image size and tile grid
6. select one or more source tiles
7. assign the selection to a target/output tile
8. select a placed output tile
9. repair target/output tile content in the editor panel
10. move placed tiles between output cells when needed
11. save the working/output tilesheet as PNG
12. optionally save project JSON for references and grid settings
13. open the Scene editor
14. use the current tilesheet as the palette/source for scene placement
15. open or save scenes as TMJ

---

## Core Features

* editor panel for tile and project editing
* mouse and keyboard input for editing
* responsive layout support
* source tilesheet → target tilesheet workflow
* working/output tilesheet load/save as PNG
* source grid spacing controls
* target/output tilesheet configuration
* grid-based editing
* per-tile transforms
* per-tile seam-repair controls in the editor panel
* moving placed tiles between output cells
* per-tile visual correction controls
* project JSON load/save
* seamless tiling support
* TSJ export
* scene editing using the current tilesheet
* TMJ scene load/save

---

## Output

* working/output tilesheet PNG
* `tileset.png`
* `tileset.tsj`
* `scene.tmj`
* `.tilejam.json`

---

## Rules

* tiles must align to grid
* source selection must align to the source grid
* target/output tiles must align to the output grid
* copied source content is centered into the target tile before further transforms
* seam repair is done through explicit tile parameters, not hidden edits
* tile movement between output cells must stay deterministic
* working/output PNG must reopen as editable output-grid content, not only as a flat preview
* scene editing must use the current tilesheet as the palette/source
* scene placement must stay grid-aligned and deterministic
* output must be production-ready
* behavior must be explicit
* no hidden state
* project data must stay editable and serializable
* PNG is visual truth for the working/output sheet
* `.tilejam.json` should not duplicate baked working-sheet tile placement when the working PNG already exists
* a project without a resolvable working PNG cannot fully restore tilesheet editing until that PNG is relinked
* TMJ is the source of truth for scene content
* `.tilejam.json` should reference the current scene file instead of embedding the full scene map

---

## Design

* simple over flexible
* fast iteration
* deterministic output
* data-driven

---

## Non-Goals

* full image editor
* animation
