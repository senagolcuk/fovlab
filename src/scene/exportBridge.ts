/**
 * A hand-off point between the R3F canvas and the image exporter.
 *
 * The exporter lives in the UI layer and cannot reach into the render loop. This singleton lets a
 * component *inside* the canvas publish the renderer and its pixel-ratio control, so the exporter
 * can raise the resolution, read the panes back at that resolution, and put it back — without the
 * two sides importing each other.
 */

import type { Camera, Scene, WebGLRenderer } from 'three';
import type { ViewName } from '../core/viewport';

export interface SceneHandle {
  gl: WebGLRenderer;
  /** Sets the renderer pixel ratio; the panes re-render into a buffer that many times CSS size. */
  setDpr: (dpr: number) => void;
  /** The pixel ratio in force right now, so the exporter can restore it. */
  getDpr: () => number;
}

let handle: SceneHandle | null = null;

export function setSceneHandle(next: SceneHandle | null): void {
  handle = next;
}

export function getSceneHandle(): SceneHandle {
  if (!handle) throw new Error('The viewport is not ready to export yet.');
  return handle;
}

/**
 * Each pane draws into its own virtual scene with its own camera. The vector (SVG) exporter needs
 * both to re-render that pane's geometry as editable shapes, so every pane publishes them here.
 */
export interface PaneScene {
  scene: Scene;
  camera: Camera;
}

const paneScenes = new Map<ViewName, PaneScene>();

export function registerPaneScene(name: ViewName, entry: PaneScene | null): void {
  if (entry) paneScenes.set(name, entry);
  else paneScenes.delete(name);
}

export function getPaneScene(name: ViewName): PaneScene | undefined {
  return paneScenes.get(name);
}
