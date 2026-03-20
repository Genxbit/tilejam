import type {
  ProjectState,
  SeamDirection,
  SeamRepairMode,
  SeamRepairReference,
  TilePlacement,
} from "../types/project";

export type SeamRepairPair = {
  primary: TilePlacement;
  neighbor: TilePlacement;
};

export type SeamRepairSettings = {
  direction: SeamDirection;
  stripWidth: number;
  falloff: number;
  mode: SeamRepairMode;
  reference: SeamRepairReference;
  strength: number;
  quantize: boolean;
  preserveContrast: boolean;
  continueRamp: boolean;
};

type Rgba = {
  r: number;
  g: number;
  b: number;
  a: number;
};

type Ycc = {
  y: number;
  cb: number;
  cr: number;
  a: number;
};

export function getSeamRepairSettings(state: ProjectState): SeamRepairSettings {
  return {
    direction: state.session.seamRepairDirection,
    stripWidth: Math.max(1, state.session.seamRepairStripWidth),
    falloff: Math.max(1, state.session.seamRepairFalloff),
    mode: state.session.seamRepairMode,
    reference: state.session.seamRepairReference,
    strength: clamp01(state.session.seamRepairStrength),
    quantize: state.session.seamRepairQuantize,
    preserveContrast: state.session.seamRepairPreserveContrast,
    continueRamp: state.session.seamRepairContinueRamp,
  };
}

export function getSeamRepairPair(state: ProjectState): SeamRepairPair | null {
  return getSeamRepairPairs(state)[0] ?? null;
}

export function getSeamRepairPairs(state: ProjectState): SeamRepairPair[] {
  const primary = state.project.tiles.find((tile) => tile.id === state.session.selectedOutputTileId)
    ?? (state.session.selectedOutputTileIds.length > 0
      ? state.project.tiles.find((tile) => tile.id === state.session.selectedOutputTileIds[0]) ?? null
      : null);

  if (!primary) {
    return [];
  }

  const delta = getDirectionDelta(state.session.seamRepairDirection);
  const selectedIds = new Set(
    state.session.selectedOutputTileIds.length > 0
      ? state.session.selectedOutputTileIds
      : state.session.selectedOutputTileId !== null
        ? [state.session.selectedOutputTileId]
        : [],
  );
  const selectedTiles = state.project.tiles.filter((tile) => selectedIds.has(tile.id));

  if (selectedTiles.length <= 1) {
    const neighbor = state.project.tiles.find((tile) =>
      tile.destCol === primary.destCol + delta.col && tile.destRow === primary.destRow + delta.row,
    ) ?? null;

    return neighbor ? [{ primary, neighbor }] : [];
  }

  const seenPairs = new Set<string>();

  return selectedTiles
    .slice()
    .sort((left, right) => left.destRow - right.destRow || left.destCol - right.destCol || left.id - right.id)
    .map((tile) => ({
      primary: tile,
      neighbor: state.project.tiles.find((candidate) =>
        candidate.destCol === tile.destCol + delta.col && candidate.destRow === tile.destRow + delta.row,
      ) ?? null,
    }))
    .filter((pair): pair is SeamRepairPair => pair.neighbor !== null)
    .filter((pair) => {
      const key = pair.primary.id < pair.neighbor.id
        ? `${pair.primary.id}:${pair.neighbor.id}`
        : `${pair.neighbor.id}:${pair.primary.id}`;

      if (seenPairs.has(key)) {
        return false;
      }

      seenPairs.add(key);
      return true;
    });
}

export function repairSeamPair(
  primarySourceCanvas: HTMLCanvasElement,
  neighborSourceCanvas: HTMLCanvasElement,
  settings: SeamRepairSettings,
): { primaryCanvas: HTMLCanvasElement; neighborCanvas: HTMLCanvasElement } | null {
  const width = primarySourceCanvas.width;
  const height = primarySourceCanvas.height;

  if (width !== neighborSourceCanvas.width || height !== neighborSourceCanvas.height || width < 1 || height < 1) {
    return null;
  }

  const primaryCanvas = cloneCanvas(primarySourceCanvas);
  const neighborCanvas = cloneCanvas(neighborSourceCanvas);
  const primaryContext = primaryCanvas.getContext("2d", { willReadFrequently: true });
  const neighborContext = neighborCanvas.getContext("2d", { willReadFrequently: true });

  if (!primaryContext || !neighborContext) {
    return null;
  }

  const primaryImageData = primaryContext.getImageData(0, 0, width, height);
  const neighborImageData = neighborContext.getImageData(0, 0, width, height);
  const primarySourceData = new Uint8ClampedArray(primaryImageData.data);
  const neighborSourceData = new Uint8ClampedArray(neighborImageData.data);
  const palette = settings.quantize ? collectPalette(primarySourceData, neighborSourceData) : [];
  const axisLength = isVerticalSeam(settings.direction) ? height : width;
  const primaryEdgeIndex = settings.direction === "right" ? width - 1 : settings.direction === "left" ? 0 : settings.direction === "bottom" ? height - 1 : 0;
  const neighborEdgeIndex = settings.direction === "right" ? 0 : settings.direction === "left" ? width - 1 : settings.direction === "bottom" ? 0 : height - 1;
  const profileRadius = Math.max(1, Math.min(2, settings.stripWidth));

  for (let axis = 0; axis < axisLength; axis += 1) {
    const primaryEdge = getSeamProfile(primarySourceData, width, height, settings.direction, primaryEdgeIndex, axis, profileRadius);
    const neighborEdge = getSeamProfile(neighborSourceData, width, height, oppositeDirection(settings.direction), neighborEdgeIndex, axis, profileRadius);

    if (!primaryEdge || !neighborEdge) {
      continue;
    }

    const primaryInner = getSeamProfile(
      primarySourceData,
      width,
      height,
      settings.direction,
      primaryEdgeIndex - getPrimaryInwardStep(settings.direction),
      axis,
      profileRadius,
    );
    const neighborInner = getSeamProfile(
      neighborSourceData,
      width,
      height,
      oppositeDirection(settings.direction),
      neighborEdgeIndex - getPrimaryInwardStep(oppositeDirection(settings.direction)),
      axis,
      profileRadius,
    );
    const target = buildTargetColor(primaryEdge, neighborEdge, primaryInner, neighborInner, settings);
    const primarySideWeight = getSideStrength(settings.reference, "primary");
    const neighborSideWeight = getSideStrength(settings.reference, "neighbor");

    for (let distance = 0; distance < settings.stripWidth; distance += 1) {
      const weight = getSeamWeight(distance, settings.stripWidth, settings.falloff) * settings.strength;
      const primaryIndex = primaryEdgeIndex - distance * getPrimaryInwardStep(settings.direction);
      const neighborIndex = neighborEdgeIndex - distance * getPrimaryInwardStep(oppositeDirection(settings.direction));
      const primaryOriginal = getSeamPixel(primarySourceData, width, height, settings.direction, primaryIndex, axis);
      const neighborOriginal = getSeamPixel(neighborSourceData, width, height, oppositeDirection(settings.direction), neighborIndex, axis);
      const primaryBand = getSeamProfile(primarySourceData, width, height, settings.direction, primaryIndex, axis, profileRadius) ?? primaryEdge;
      const neighborBand = getSeamProfile(neighborSourceData, width, height, oppositeDirection(settings.direction), neighborIndex, axis, profileRadius) ?? neighborEdge;

      if (primaryOriginal) {
        const adjusted = adjustSeamPixel(primaryOriginal, primaryBand, target, settings, weight * primarySideWeight);
        const nextColor = settings.quantize ? snapToPalette(adjusted, palette) : adjusted;
        setSeamPixel(primaryImageData.data, width, height, settings.direction, primaryIndex, axis, nextColor);
      }

      if (neighborOriginal) {
        const adjusted = adjustSeamPixel(neighborOriginal, neighborBand, target, settings, weight * neighborSideWeight);
        const nextColor = settings.quantize ? snapToPalette(adjusted, palette) : adjusted;
        setSeamPixel(neighborImageData.data, width, height, oppositeDirection(settings.direction), neighborIndex, axis, nextColor);
      }
    }
  }

  primaryContext.putImageData(primaryImageData, 0, 0);
  neighborContext.putImageData(neighborImageData, 0, 0);

  return { primaryCanvas, neighborCanvas };
}

function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");

  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0);
  }

  return canvas;
}

function collectPalette(...sources: Uint8ClampedArray[]): Rgba[] {
  const colors = new Map<string, Rgba>();

  for (const source of sources) {
    for (let index = 0; index < source.length; index += 4) {
      const alpha = source[index + 3];

      if (alpha < 1) {
        continue;
      }

      const color = {
        r: source[index],
        g: source[index + 1],
        b: source[index + 2],
        a: alpha,
      };
      colors.set(`${color.r},${color.g},${color.b},${color.a}`, color);
    }
  }

  return [...colors.values()];
}

function buildTargetColor(
  primaryEdge: Rgba,
  neighborEdge: Rgba,
  primaryInner: Rgba | null,
  neighborInner: Rgba | null,
  settings: SeamRepairSettings,
): Rgba {
  let base = resolveReferenceTarget(primaryEdge, neighborEdge, settings.reference);

  if (settings.continueRamp && primaryInner && neighborInner) {
    const primaryRamp = extrapolate(primaryEdge, primaryInner);
    const neighborRamp = extrapolate(neighborEdge, neighborInner);
    const rampTarget = resolveReferenceTarget(primaryRamp, neighborRamp, settings.reference);
    base = mixColor(base, rampTarget, 0.45);
  }

  return base;
}

function adjustSeamPixel(
  original: Rgba,
  edge: Rgba,
  target: Rgba,
  settings: SeamRepairSettings,
  weight: number,
): Rgba {
  if (settings.mode === "luminance") {
    return adjustLuminance(original, edge, target, settings.preserveContrast, weight);
  }

  if (settings.mode === "chroma") {
    return adjustChroma(original, edge, target, settings.preserveContrast, weight);
  }

  return adjustFullColor(original, edge, target, settings.preserveContrast, weight);
}

function adjustFullColor(
  original: Rgba,
  edge: Rgba,
  target: Rgba,
  preserveContrast: boolean,
  weight: number,
): Rgba {
  if (preserveContrast) {
    return clampColor({
      r: original.r + (target.r - edge.r) * weight,
      g: original.g + (target.g - edge.g) * weight,
      b: original.b + (target.b - edge.b) * weight,
      a: original.a,
    });
  }

  return clampColor({
    r: lerp(original.r, target.r, weight),
    g: lerp(original.g, target.g, weight),
    b: lerp(original.b, target.b, weight),
    a: original.a,
  });
}

function adjustLuminance(
  original: Rgba,
  edge: Rgba,
  target: Rgba,
  preserveContrast: boolean,
  weight: number,
): Rgba {
  const originalYcc = toYcc(original);
  const edgeYcc = toYcc(edge);
  const targetYcc = toYcc(target);
  const nextY = preserveContrast
    ? originalYcc.y + (targetYcc.y - edgeYcc.y) * weight
    : lerp(originalYcc.y, targetYcc.y, weight);

  return clampColor(fromYcc({
    y: nextY,
    cb: originalYcc.cb,
    cr: originalYcc.cr,
    a: originalYcc.a,
  }));
}

function adjustChroma(
  original: Rgba,
  edge: Rgba,
  target: Rgba,
  preserveContrast: boolean,
  weight: number,
): Rgba {
  const originalYcc = toYcc(original);
  const edgeYcc = toYcc(edge);
  const targetYcc = toYcc(target);
  const nextCb = preserveContrast
    ? originalYcc.cb + (targetYcc.cb - edgeYcc.cb) * weight
    : lerp(originalYcc.cb, targetYcc.cb, weight);
  const nextCr = preserveContrast
    ? originalYcc.cr + (targetYcc.cr - edgeYcc.cr) * weight
    : lerp(originalYcc.cr, targetYcc.cr, weight);

  return clampColor(fromYcc({
    y: originalYcc.y,
    cb: nextCb,
    cr: nextCr,
    a: originalYcc.a,
  }));
}

function snapToPalette(color: Rgba, palette: Rgba[]): Rgba {
  if (palette.length < 1) {
    return color;
  }

  let best = palette[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of palette) {
    const distance = getColorDistance(color, candidate);

    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}

function getSeamWeight(distance: number, stripWidth: number, falloff: number): number {
  const stripFactor = 1 - (distance / Math.max(1, stripWidth));
  const falloffFactor = 1 - (distance / Math.max(1, falloff));
  return clamp01(Math.max(stripFactor, 0) * Math.max(falloffFactor, 0));
}

function getSeamPixel(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  direction: SeamDirection,
  edgeIndex: number,
  axis: number,
): Rgba | null {
  const position = getSeamPosition(direction, edgeIndex, axis);

  if (!position || position.x < 0 || position.x >= width || position.y < 0 || position.y >= height) {
    return null;
  }

  const index = (position.y * width + position.x) * 4;
  return {
    r: data[index],
    g: data[index + 1],
    b: data[index + 2],
    a: data[index + 3],
  };
}

function getSeamProfile(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  direction: SeamDirection,
  edgeIndex: number,
  axis: number,
  radius: number,
): Rgba | null {
  let count = 0;
  let result = { r: 0, g: 0, b: 0, a: 0 };

  for (let axisOffset = -radius; axisOffset <= radius; axisOffset += 1) {
    const pixel = getSeamPixel(data, width, height, direction, edgeIndex, axis + axisOffset);

    if (!pixel || pixel.a < 1) {
      continue;
    }

    result = {
      r: result.r + pixel.r,
      g: result.g + pixel.g,
      b: result.b + pixel.b,
      a: result.a + pixel.a,
    };
    count += 1;
  }

  if (count < 1) {
    return null;
  }

  return {
    r: Math.round(result.r / count),
    g: Math.round(result.g / count),
    b: Math.round(result.b / count),
    a: Math.round(result.a / count),
  };
}

function setSeamPixel(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  direction: SeamDirection,
  edgeIndex: number,
  axis: number,
  color: Rgba,
): void {
  const position = getSeamPosition(direction, edgeIndex, axis);

  if (!position || position.x < 0 || position.x >= width || position.y < 0 || position.y >= height) {
    return;
  }

  const index = (position.y * width + position.x) * 4;
  data[index] = color.r;
  data[index + 1] = color.g;
  data[index + 2] = color.b;
  data[index + 3] = color.a;
}

function getSeamPosition(direction: SeamDirection, edgeIndex: number, axis: number): { x: number; y: number } | null {
  if (direction === "left" || direction === "right") {
    return { x: edgeIndex, y: axis };
  }

  if (direction === "top" || direction === "bottom") {
    return { x: axis, y: edgeIndex };
  }

  return null;
}

function getDirectionDelta(direction: SeamDirection): { col: number; row: number } {
  switch (direction) {
    case "left":
      return { col: -1, row: 0 };
    case "right":
      return { col: 1, row: 0 };
    case "top":
      return { col: 0, row: -1 };
    case "bottom":
      return { col: 0, row: 1 };
    default:
      return { col: 0, row: 0 };
  }
}

function getPrimaryInwardStep(direction: SeamDirection): number {
  return direction === "right" || direction === "bottom" ? 1 : -1;
}

function oppositeDirection(direction: SeamDirection): SeamDirection {
  switch (direction) {
    case "left":
      return "right";
    case "right":
      return "left";
    case "top":
      return "bottom";
    case "bottom":
      return "top";
    default:
      return "right";
  }
}

function isVerticalSeam(direction: SeamDirection): boolean {
  return direction === "left" || direction === "right";
}

function averageColor(left: Rgba, right: Rgba): Rgba {
  return {
    r: Math.round((left.r + right.r) / 2),
    g: Math.round((left.g + right.g) / 2),
    b: Math.round((left.b + right.b) / 2),
    a: Math.round((left.a + right.a) / 2),
  };
}

function mixColor(left: Rgba, right: Rgba, amount: number): Rgba {
  return clampColor({
    r: lerp(left.r, right.r, amount),
    g: lerp(left.g, right.g, amount),
    b: lerp(left.b, right.b, amount),
    a: lerp(left.a, right.a, amount),
  });
}

function resolveReferenceTarget(left: Rgba, right: Rgba, reference: SeamRepairReference): Rgba {
  switch (reference) {
    case "primary":
      return mixColor(right, left, 0.72);
    case "neighbor":
      return mixColor(left, right, 0.72);
    case "balanced":
    default:
      return averageColor(left, right);
  }
}

function getSideStrength(reference: SeamRepairReference, side: "primary" | "neighbor"): number {
  if (reference === "balanced") {
    return 1;
  }

  if (reference === "primary") {
    return side === "primary" ? 0.45 : 1;
  }

  return side === "neighbor" ? 0.45 : 1;
}

function extrapolate(edge: Rgba, inner: Rgba): Rgba {
  return clampColor({
    r: edge.r + (edge.r - inner.r),
    g: edge.g + (edge.g - inner.g),
    b: edge.b + (edge.b - inner.b),
    a: edge.a,
  });
}

function toYcc(color: Rgba): Ycc {
  const y = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
  const cb = color.b - y;
  const cr = color.r - y;
  return { y, cb, cr, a: color.a };
}

function fromYcc(color: Ycc): Rgba {
  const r = color.y + color.cr;
  const b = color.y + color.cb;
  const g = (color.y - 0.299 * r - 0.114 * b) / 0.587;
  return {
    r: Math.round(r),
    g: Math.round(g),
    b: Math.round(b),
    a: Math.round(color.a),
  };
}

function getColorDistance(left: Rgba, right: Rgba): number {
  const deltaR = left.r - right.r;
  const deltaG = left.g - right.g;
  const deltaB = left.b - right.b;
  return Math.sqrt((deltaR ** 2) + (deltaG ** 2) + (deltaB ** 2));
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function clampColor(color: Rgba): Rgba {
  return {
    r: clampChannel(color.r),
    g: clampChannel(color.g),
    b: clampChannel(color.b),
    a: clampChannel(color.a),
  };
}

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
