# FORMATS.md

## Overview

Tilejam uses:

* project format → editing
* tileset PNG → working and final output
* TSJ → standard metadata
* TMJ → scene format

---

## Project Format (`.tilejam.json`)

Editable project state around the current working tilesheet.

```json
{
  "version": 1,
  "sourceImage": "source.png",
  "workingImage": "working.png",
  "sceneFile": "level1.tmj",
  "sourceTileWidth": 32,
  "sourceTileHeight": 32,

  "tileWidth": 32,
  "tileHeight": 32,
  "outputWidth": 1024,
  "outputHeight": 1024
}
```

### Rules

* fully serializable
* no hidden state
* `sourceImage` is a string reference, not embedded image data
* `workingImage` is an optional string reference to the current working/output PNG
* `sceneFile` is an optional string reference to the current TMJ scene file
* `sourceTileWidth` / `sourceTileHeight` define the source tilesheet grid
* `tileWidth` / `tileHeight` define the target/output tilesheet grid
* `outputWidth` / `outputHeight` define the target/output image size
* opening the project should rebuild editable output cells from `workingImage`
* project JSON should not duplicate baked working-sheet tile placement data
* if `workingImage` is missing or cannot be resolved, the project cannot fully restore tilesheet editing until the PNG is relinked
* project JSON should reference TMJ scene files instead of embedding full scene data

---

## Tileset PNG

Working and export artifact.

* strict grid
* tile size fixed
* no overlap
* optional extrusion

Working/output PNG may also be loaded back into Tilejam.

When loaded for editing:

* it is sliced into output-grid tiles
* each output cell becomes an editable tile
* the loaded PNG becomes the source reference for those reconstructed tiles
* reconstructed output tiles are the editable working state for that session

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

## TMJ Scene (`scene.tmj`)

Standard Tiled JSON map.

```json
{
  "type": "map",
  "version": "1.10",
  "tiledversion": "1.10.2",
  "orientation": "orthogonal",
  "renderorder": "right-down",
  "width": 32,
  "height": 32,
  "tilewidth": 32,
  "tileheight": 32,
  "infinite": false,
  "layers": [
    {
      "id": 1,
      "name": "ground",
      "type": "tilelayer",
      "width": 32,
      "height": 32,
      "visible": true,
      "opacity": 1,
      "offsetx": 0,
      "offsety": 0,
      "parallaxx": 1,
      "parallaxy": 1,
      "data": [1, 0, 0, 2]
    }
  ],
  "tilesets": [
    {
      "firstgid": 1,
      "source": "tileset.tsj"
    }
  ]
}
```

### Rules

* scene editing uses TMJ as the interoperable scene format
* scene width / height are stored in tile units
* scene tile size must match the selected tilesheet tile size
* scene layer data uses Tiled global tile IDs
* Tilejam v1 should start with orthogonal tile layers
* scene tile layers may include `offsetx`, `offsety`, `parallaxx`, and `parallaxy`
* Tilejam scene state maps those TMJ fields to `offsetX`, `offsetY`, `parallaxX`, and `parallaxY`
* the active tilesheet is used as the palette/source for scene editing
* loading TMJ must restore editable scene grid content
* saving TMJ must preserve deterministic tile placement

---

## Mapping Rules

* tile id = `col + row * columns`
* output columns / rows are derived from output image size and target tile size
* working-sheet tile geometry is reconstructed from the loaded working PNG and output grid
* transforms and visual corrections are baked into PNG
* metadata exported to TSJ must come from the current reconstructed working tiles
* scene tile placement maps selected tilesheet tile IDs into TMJ layer data
* TMJ `firstgid` + local tilesheet tile id determine stored scene cell values

---

## Design Rules

* project = editable project state
* PNG = visual truth
* TSJ = interoperability
* TMJ = scene interoperability

`sourceImage` may be stored as a relative path or app-served path.

---

## Versioning

* start with `"version": 1`
* extend without breaking old projects
