import type { ProjectState, SceneMapState, UnresolvedResource } from "../types/project";
import { getSourceImageForRef } from "./sourceImageSystem";

export function updateUnresolvedResources(
  state: ProjectState,
  scope: "project" | "scene",
  resources: UnresolvedResource[],
): void {
  state.session.unresolvedResources = resources;
  state.session.unresolvedResourceScope = resources.length > 0 ? scope : null;
}

export function clearUnresolvedResources(state: ProjectState): void {
  state.session.unresolvedResources = [];
  state.session.unresolvedResourceScope = null;
}

export function refreshUnresolvedResourcesForCurrentScope(state: ProjectState): void {
  if (state.session.unresolvedResourceScope === "project") {
    updateUnresolvedResources(state, "project", collectProjectUnresolvedResources(state));
    return;
  }

  if (state.session.unresolvedResourceScope === "scene" && state.project.scene) {
    updateUnresolvedResources(state, "scene", collectSceneUnresolvedResources(state, state.project.scene));
    return;
  }

  clearUnresolvedResources(state);
}

export function collectProjectUnresolvedResources(state: ProjectState): UnresolvedResource[] {
  const resources: UnresolvedResource[] = [];

  if (state.project.sourceImage && !state.sourceImageAsset.image) {
    resources.push({
      id: `source-image:${state.project.sourceImage}`,
      role: "source-image",
      label: "Source image",
      path: state.project.sourceImage,
    });
  }

  if (state.project.workingImage && state.project.tiles.length === 0) {
    resources.push({
      id: `working-image:${state.project.workingImage}`,
      role: "working-image",
      label: "Working tilesheet",
      path: state.project.workingImage,
    });
  }

  if (state.project.sceneFile && !state.project.scene) {
    resources.push({
      id: `scene-file:${state.project.sceneFile}`,
      role: "scene-file",
      label: "Scene file",
      path: state.project.sceneFile,
    });
  }

  if (state.project.scene) {
    resources.push(...collectUnresolvedSceneImageLayerResources(state, state.project.scene));
  }

  return resources;
}

export function collectSceneUnresolvedResources(
  state: ProjectState,
  scene: SceneMapState,
): UnresolvedResource[] {
  const resources: UnresolvedResource[] = [];
  const expectedWorkingImage = scene.tilesetSource.replace(/\.tsj$/i, ".png");
  const currentWorkingImage = state.session.workingImageFileName ?? state.project.workingImage;

  if (!(currentWorkingImage === expectedWorkingImage && state.project.tiles.length > 0)) {
    resources.push({
      id: `working-image:${expectedWorkingImage}`,
      role: "working-image",
      label: "Scene tilesheet",
      path: expectedWorkingImage,
    });
  }

  resources.push(...collectUnresolvedSceneImageLayerResources(state, scene));
  return resources;
}

export function collectUnresolvedSceneImageLayerResources(
  state: ProjectState,
  scene: SceneMapState,
): UnresolvedResource[] {
  return scene.layers
    .filter((layer): layer is Extract<SceneMapState["layers"][number], { type: "imagelayer" }> =>
      layer.type === "imagelayer" && Boolean(layer.image))
    .filter((layer) => !getSourceImageForRef(state, layer.image))
    .map((layer) => ({
      id: `scene-image-layer:${layer.id}:${layer.image}`,
      role: "scene-image-layer" as const,
      label: `Image layer: ${layer.name}`,
      path: layer.image,
      layerId: layer.id,
    }));
}

export function findUnresolvedResource(state: ProjectState, id: string): UnresolvedResource | undefined {
  return state.session.unresolvedResources.find((entry) => entry.id === id);
}

export function isChromiumBrowser(): boolean {
  const userAgent = navigator.userAgent;
  return /(Chrome|Chromium|CriOS|Edg|EdgiOS)/.test(userAgent) && !/(Firefox|FxiOS)/.test(userAgent);
}

export function getResourceChooserLabel(resource: UnresolvedResource): string {
  switch (resource.role) {
    case "source-image":
      return "Choose Source";
    case "working-image":
      return "Choose Tilesheet";
    case "scene-file":
      return "Choose Scene";
    case "scene-image-layer":
      return "Choose Image";
  }
}

export function getResourceAccept(resource: UnresolvedResource): string {
  switch (resource.role) {
    case "scene-file":
      return ".tmj,application/json";
    case "source-image":
    case "working-image":
    case "scene-image-layer":
      return "image/*";
  }
}
