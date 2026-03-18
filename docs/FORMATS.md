# FORMATS.md

## Overview

Tilejam uses:

* project format → editing
* tileset PNG → final output
* TSJ → standard metadata

---

## Project Format (`.tilejam.json`)

Editable source of truth.

```json
{
  "version": 1,
  "sourceImage": "source.png",
  "sourceTileWidth": 32,
  "sourceTileHeight": 32,

  "tileWidth": 32,
  "tileHeight": 32,
  "outputWidth": 1024,
  "outputHeight": 1024,

  "tiles": [
    {
      "id": 0,
      "destCol": 0,
      "destRow": 0,

      "sourceRect": { "x": 100, "y": 50, "w": 36, "h": 34 },

      "offsetX": -2,
      "offsetY": 1,
      "scaleX": 1,
      "scaleY": 1,
      "flipX": false,
      "flipY": false,

      "name": "tile_name",
      "tags": ["tag1", "tag2"],
      "collision": "none"
    }
  ]
}
```

### Rules

* fully serializable
* no hidden state
* defines full output
* transforms applied at export
* `sourceImage` is a string reference, not embedded image data
* `sourceTileWidth` / `sourceTileHeight` define the source tilesheet grid
* `tileWidth` / `tileHeight` define the target/output tilesheet grid
* `outputWidth` / `outputHeight` define the target/output image size
* `sourceRect` must align to the source grid

---

## Tileset PNG

Generated from project.

* strict grid
* tile size fixed
* no overlap
* optional extrusion

---

## TSJ Export (`tileset.tsj`)

Standard Tiled tileset.

```json
{
  "name": "tileset",
  "tilewidth": 32,
  "tileheight": 32,
  "tilecount": 8,
  "columns": 4,

  "image": "tileset.png",
  "imagewidth": 128,
  "imageheight": 64,

  "margin": 0,
  "spacing": 0,

  "tiles": [
    {
      "id": 0,
      "properties": [
        { "name": "name", "type": "string", "value": "tile_name" },
        { "name": "tags", "type": "string", "value": "tag1,tag2" },
        { "name": "collision", "type": "string", "value": "none" }
      ]
    }
  ]
}
```

---

## Mapping Rules

* tile id = `col + row * columns`
* output columns / rows are derived from output image size and target tile size
* sourceRect not included in export
* transforms baked into PNG
* metadata → TSJ properties
* copied source content is centered in the target tile before transforms

---

## Design Rules

* project = editable
* PNG = visual truth
* TSJ = interoperability

`sourceImage` may be stored as a relative path or app-served path.

---

## Versioning

* start with `"version": 1`
* extend without breaking old projects
