# PRODUCT.md

## Overview

Tilejam is a tool for converting messy or AI-generated images into clean, grid-aligned tilesets.

---

## Workflow

1. create or open project
2. load source image
3. set tile size (8 / 16 / 32 / 64)
4. select source region
5. assign to tile
6. adjust (move, scale, flip)
7. save project or export tileset

---

## Core Features

* editor panel for tile and project editing
* mouse and keyboard input for editing
* responsive layout support
* source → tile workflow
* grid-based editing
* per-tile transforms
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
