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

  "tileWidth": 32,
  "tileHeight": 32,
  "columns": 4,
  "rows": 2,

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
* sourceRect not included in export
* transforms baked into PNG
* metadata → TSJ properties

---

## Design Rules

* project = editable
* PNG = visual truth
* TSJ = interoperability

---

## Versioning

* start with `"version": 1`
* extend without breaking old projects
