# PRODUCT.md

## Overview

Tilejam is a tool for converting messy or AI-generated images into clean, grid-aligned tilesets.

---

## Workflow

1. load source image
2. set tile size (8 / 16 / 32)
3. select source region
4. assign to tile
5. adjust (move, scale, flip)
6. export tileset

---

## Core Features

* editor panel for tile and project editing
* mouse and keyboard input for editing
* responsive layout support
* source → tile workflow
* grid-based editing
* per-tile transforms
* seamless tiling support
* PNG export
* TSJ export

---

## Output

* `tileset.png`
* `tileset.tsj`
* `project.tilejam.json`

---

## Rules

* tiles must align to grid
* output must be production-ready
* behavior must be explicit
* no hidden state

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
