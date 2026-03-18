# PRODUCT.md

## Overview

Tilejam is a tool for converting messy or AI-generated tilesheets into clean, grid-aligned output tilesets.

---

## Workflow

1. create or open project
2. load source tilesheet
3. set source grid spacing
4. create or configure target/output image size and tile grid
5. select one or more source tiles
6. assign the selection to a target/output tile
7. select a placed output tile
8. repair target/output tile content in the editor panel
9. move placed tiles between output cells when needed
10. save project or export tileset

---

## Core Features

* editor panel for tile and project editing
* mouse and keyboard input for editing
* responsive layout support
* source tilesheet → target tilesheet workflow
* source grid spacing controls
* target/output tilesheet configuration
* grid-based editing
* per-tile transforms
* per-tile seam-repair controls in the editor panel
* moving placed tiles between output cells
* per-tile visual correction controls
* project JSON load/save
* seamless tiling support
* PNG export
* TSJ export

---

## Output

* `tileset.png`
* `tileset.tsj`
* `.tilejam.json`

---

## Rules

* tiles must align to grid
* source selection must align to the source grid
* target/output tiles must align to the output grid
* copied source content is centered into the target tile before further transforms
* seam repair is done through explicit tile parameters, not hidden edits
* tile movement between output cells must stay deterministic
* output must be production-ready
* behavior must be explicit
* no hidden state
* project data must stay editable and serializable

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
