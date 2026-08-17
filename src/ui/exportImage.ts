/**
 * Exports the viewport as an image or document.
 *
 * The naive route — screenshotting the DOM — can only ever capture the WebGL canvas at its
 * on-screen pixel size and then upscale, so every "high resolution" export came out soft. Instead
 * we raise the renderer's pixel ratio for the capture, read the panes straight off the WebGL
 * canvas at that true resolution, and composite the annotations (dimension lines, labels, pane
 * separators) on top ourselves. That keeps the 3D crisp at any multiplier and lets the fonts
 * render from the page rather than a detached SVG.
 *
 * SVG is a genuine vector file: the 3D is embedded as a high-resolution raster, but every
 * annotation is a real `<line>`/`<text>`, so the numbers stay sharp and editable at any zoom.
 */

import { jsPDF } from 'jspdf';
import { triggerDownload } from '../store/persist';
import { SVGRenderer } from 'three-stdlib';
import { viewportRects, VIEW_NAMES, type ViewName } from '../core/viewport';
import type { Rect } from '../core/types';
import { useStore } from '../store/useStore';
import { getPaneScene, getSceneHandle } from '../scene/exportBridge';
import { AXIS_HINTS } from '../scene/views';
import { BACKGROUND, STAGE_DOM_ID } from '../scene/Stage';
import { MONO, PALETTE } from '../theme';

export type ExportFormat = 'png' | 'jpeg' | 'svg' | 'pdf';
/** A single pane, or the whole four-up viewport. */
export type ExportTarget = ViewName | 'ALL';

export const EXPORT_FORMATS: Array<{ value: ExportFormat; label: string }> = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'svg', label: 'SVG' },
  { value: 'pdf', label: 'PDF' },
];

const LINE = PALETTE.slate;
const LABEL = PALETTE.slate;
const AXIS = 'rgba(0, 0, 0, 0.38)';
const SANS = 'Roboto, sans-serif';
const LABEL_PAD_X = 8;
const LABEL_PAD_Y = 6;
const LABEL_GAP = 8;

function stageHost(): HTMLElement {
  const host = document.getElementById(STAGE_DOM_ID);
  if (!host) throw new Error('The viewport is not on screen to export.');
  return host;
}

function rectsOf(host: HTMLElement): Record<ViewName, Rect> {
  return viewportRects(host.clientWidth, host.clientHeight);
}

function targetRect(target: ExportTarget, host: HTMLElement): Rect {
  if (target === 'ALL') return { x: 0, y: 0, width: host.clientWidth, height: host.clientHeight };
  return rectsOf(host)[target];
}

/** The ortho panes whose dimension lines fall inside this target. ISO has none. */
function dimensionPanes(target: ExportTarget): ViewName[] {
  const all: ViewName[] = ['TOP', 'FRONT', 'LEFT'];
  if (target === 'ALL') return all;
  return all.includes(target) ? [target] : [];
}

function labelPanes(target: ExportTarget): ViewName[] {
  return target === 'ALL' ? VIEW_NAMES : [target];
}

const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** Raise the renderer to `scale`× CSS resolution, let it settle, then hand back a restore fn. */
async function renderAtScale(scale: number): Promise<{ gl: HTMLCanvasElement; restore: () => void }> {
  const handle = getSceneHandle();
  const host = stageHost();
  const previous = handle.getDpr();
  handle.setDpr(scale);

  // setDpr resizes the drawing buffer through a React effect, then the panes redraw a frame later.
  // Wait for the buffer to actually reach the new size rather than guessing a frame count, then
  // give it one more frame to render into it.
  const wanted = host.clientWidth * scale;
  for (let i = 0; i < 10 && handle.gl.domElement.width < wanted - 1; i++) await raf();
  await raf();

  return {
    gl: handle.gl.domElement,
    restore: () => handle.setDpr(previous),
  };
}

/** A 2D canvas holding just the background and the 3D, cropped to `rect`, at `scale`× resolution. */
function draw3D(rect: Rect, scale: number, gl: HTMLCanvasElement, host: HTMLElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = Math.round(rect.width * scale);
  out.height = Math.round(rect.height * scale);
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('The browser could not open a drawing surface.');

  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, out.width, out.height);

  // The WebGL buffer is the whole viewport at its own pixel ratio; map CSS coords into it.
  const bx = gl.width / host.clientWidth;
  const by = gl.height / host.clientHeight;
  ctx.drawImage(
    gl,
    rect.x * bx,
    rect.y * by,
    rect.width * bx,
    rect.height * by,
    0,
    0,
    out.width,
    out.height,
  );
  return out;
}

function rotationAngle(transform: string | null): number {
  const match = transform?.match(/rotate\(\s*([-\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

function attrNum(el: Element, name: string, fallback = 0): number {
  const raw = el.getAttribute(name);
  const n = raw == null ? NaN : parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Paint one pane's dimension lines and numbers into the composite. */
async function drawDimensions(
  ctx: CanvasRenderingContext2D,
  target: ExportTarget,
  rect: Rect,
  scale: number,
  host: HTMLElement,
): Promise<void> {
  const rects = rectsOf(host);
  for (const name of dimensionPanes(target)) {
    const svg = document.querySelector<SVGSVGElement>(`svg[data-pane="${name}"]`);
    if (!svg) continue;
    const paneR = rects[name];
    const ax = paneR.x - rect.x;
    const ay = paneR.y - rect.y;

    // Lines and ticks: draw the pane's SVG (text stripped) as a crisp vector image.
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll('text').forEach((t) => t.remove());
    clone.setAttribute('width', String(paneR.width * scale));
    clone.setAttribute('height', String(paneR.height * scale));
    clone.setAttribute('viewBox', `0 0 ${paneR.width} ${paneR.height}`);
    const url =
      'data:image/svg+xml;charset=utf-8,' +
      encodeURIComponent(new XMLSerializer().serializeToString(clone));
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, ax * scale, ay * scale, paneR.width * scale, paneR.height * scale);
        resolve();
      };
      img.onerror = () => reject(new Error('A dimension layer failed to render.'));
      img.src = url;
    });

    // Numbers: redraw from the live SVG so they use the page's Roboto Mono, not a fallback.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `${11.5 * scale}px ${MONO}`;
    ctx.lineJoin = 'round';
    svg.querySelectorAll('text').forEach((t) => {
      const x = attrNum(t, 'x');
      const y = attrNum(t, 'y');
      const dy = attrNum(t, 'dy');
      ctx.save();
      ctx.translate((ax + x) * scale, (ay + y) * scale);
      ctx.rotate((rotationAngle(t.getAttribute('transform')) * Math.PI) / 180);
      ctx.strokeStyle = BACKGROUND;
      ctx.lineWidth = 3 * scale;
      ctx.strokeText(t.textContent ?? '', 0, dy * scale);
      ctx.fillStyle = LINE;
      ctx.fillText(t.textContent ?? '', 0, dy * scale);
      ctx.restore();
    });
  }
}

interface Segment {
  text: string;
  mono: boolean;
  bold: boolean;
  fill: string;
}

/** The three runs of a pane label: its name, its scale readout, and the axis hint. */
function labelSegments(name: ViewName, paneWidth: number): Segment[] {
  const s = useStore.getState();
  const view = s.views[name];
  const scaleText =
    name === 'ISO'
      ? `d = ${s.views.ISO.distance.toFixed(1)} m`
      : `${(paneWidth / (view as { zoom: number }).zoom).toFixed(1)} m across`;
  return [
    { text: name, mono: false, bold: true, fill: LABEL },
    { text: scaleText, mono: true, bold: false, fill: LABEL },
    { text: AXIS_HINTS[name], mono: true, bold: false, fill: AXIS },
  ];
}

function segmentFont(seg: Segment, sizePx: number): string {
  return seg.mono ? `${sizePx}px ${MONO}` : `${seg.bold ? '700 ' : ''}${sizePx}px ${SANS}`;
}

function drawLabels(
  ctx: CanvasRenderingContext2D,
  target: ExportTarget,
  rect: Rect,
  scale: number,
  host: HTMLElement,
): void {
  const rects = rectsOf(host);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (const name of labelPanes(target)) {
    const paneR = rects[name];
    let x = (paneR.x - rect.x + LABEL_PAD_X) * scale;
    const y = (paneR.y - rect.y + LABEL_PAD_Y) * scale;
    for (const seg of labelSegments(name, paneR.width)) {
      ctx.font = segmentFont(seg, 11 * scale);
      try {
        ctx.letterSpacing = seg.bold ? `${scale}px` : '0px';
      } catch {
        // Older engines ignore letter spacing; the label still reads fine without it.
      }
      ctx.fillStyle = seg.fill;
      ctx.fillText(seg.text, x, y);
      x += ctx.measureText(seg.text).width + LABEL_GAP * scale;
    }
  }
  try {
    ctx.letterSpacing = '0px';
  } catch {
    /* no-op */
  }
}

function drawSeparators(
  ctx: CanvasRenderingContext2D,
  scale: number,
  host: HTMLElement,
  outW: number,
  outH: number,
): void {
  const rects = rectsOf(host);
  ctx.strokeStyle = PALETTE.grey;
  ctx.lineWidth = Math.max(1, Math.round(scale));
  const vx = rects.FRONT.x * scale;
  ctx.beginPath();
  ctx.moveTo(vx, 0);
  ctx.lineTo(vx, outH);
  ctx.stroke();
  const hy = rects.LEFT.y * scale;
  ctx.beginPath();
  ctx.moveTo(0, hy);
  ctx.lineTo(outW, hy);
  ctx.stroke();
}

/** The full raster composite: 3D, then every annotation on top. */
async function composeRaster(
  target: ExportTarget,
  scale: number,
  gl: HTMLCanvasElement,
  host: HTMLElement,
): Promise<HTMLCanvasElement> {
  const rect = targetRect(target, host);
  const out = draw3D(rect, scale, gl, host);
  const ctx = out.getContext('2d')!;
  if (target === 'ALL') drawSeparators(ctx, scale, host, out.width, out.height);
  await drawDimensions(ctx, target, rect, scale, host);
  drawLabels(ctx, target, rect, scale, host);
  return out;
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Re-render one pane's scene as vector shapes, in coordinates centred on the pane. */
function paneVector(name: ViewName, width: number, height: number): string {
  const entry = getPaneScene(name);
  if (!entry) return '';
  const renderer = new SVGRenderer();
  renderer.setSize(width, height);
  // Keep straight edges straight once coordinates are rounded to the SVG.
  (renderer as unknown as { setPrecision?: (n: number) => void }).setPrecision?.(3);
  entry.camera.updateMatrixWorld();
  renderer.render(entry.scene, entry.camera);
  return renderer.domElement.innerHTML;
}

/** A fully vector SVG: each pane's geometry as editable shapes, plus the vector annotations. */
function buildVectorSvg(target: ExportTarget, rect: Rect, host: HTMLElement): string {
  const rects = rectsOf(host);
  const panes = target === 'ALL' ? VIEW_NAMES : [target as ViewName];
  const clips: string[] = [];
  const bodies: string[] = [];

  for (const name of panes) {
    const paneR = target === 'ALL' ? rects[name] : rect;
    const offX = paneR.x - rect.x;
    const offY = paneR.y - rect.y;
    const geometry = paneVector(name, paneR.width, paneR.height);
    const id = `clip-${name}`;
    // The outer group clips to the pane so nothing bleeds into a neighbour; the inner group moves
    // the pane-centred coordinates SVGRenderer emits to where the pane sits.
    clips.push(
      `<clipPath id="${id}"><rect x="${offX}" y="${offY}" width="${paneR.width}" height="${paneR.height}"/></clipPath>`,
    );
    bodies.push(
      `<g clip-path="url(#${id})"><g transform="translate(${offX + paneR.width / 2} ${offY + paneR.height / 2})">${geometry}</g></g>`,
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}" ` +
    `viewBox="0 0 ${rect.width} ${rect.height}">` +
    `<defs>${clips.join('')}</defs>` +
    `<rect width="${rect.width}" height="${rect.height}" fill="${BACKGROUND}"/>` +
    bodies.join('') +
    overlaySvg(target, rect, host) +
    `</svg>`
  );
}

/** Vector annotations for the SVG export, in CSS coordinates relative to the crop. */
function overlaySvg(target: ExportTarget, rect: Rect, host: HTMLElement): string {
  const rects = rectsOf(host);
  let out = '';

  if (target === 'ALL') {
    const vx = rects.FRONT.x;
    const hy = rects.LEFT.y;
    out +=
      `<line x1="${vx}" y1="0" x2="${vx}" y2="${rect.height}" stroke="${PALETTE.grey}"/>` +
      `<line x1="0" y1="${hy}" x2="${rect.width}" y2="${hy}" stroke="${PALETTE.grey}"/>`;
  }

  for (const name of dimensionPanes(target)) {
    const svg = document.querySelector<SVGSVGElement>(`svg[data-pane="${name}"]`);
    if (!svg) continue;
    const paneR = rects[name];
    const inner = Array.from(svg.childNodes)
      .map((n) => new XMLSerializer().serializeToString(n))
      .join('');
    out += `<g transform="translate(${paneR.x - rect.x} ${paneR.y - rect.y})">${inner}</g>`;
  }

  for (const name of labelPanes(target)) {
    const paneR = rects[name];
    const x = paneR.x - rect.x + LABEL_PAD_X;
    const y = paneR.y - rect.y + LABEL_PAD_Y + 10;
    // One text element with a tspan per run, so the browser advances between runs itself rather
    // than us measuring web-font widths off-screen (which came out too tight).
    const runs = labelSegments(name, paneR.width)
      .map((seg, i) => {
        const family = seg.mono ? MONO : SANS;
        const weight = seg.bold ? ' font-weight="700"' : '';
        const spacing = seg.bold ? ' letter-spacing="1"' : '';
        const dx = i === 0 ? '' : ` dx="${LABEL_GAP}"`;
        return `<tspan${dx} font-family="${esc(family)}"${weight}${spacing} fill="${seg.fill}">${esc(seg.text)}</tspan>`;
      })
      .join('');
    out += `<text x="${x}" y="${y}" font-size="11">${runs}</text>`;
  }
  return out;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('The browser could not encode the image.'))),
      type,
      quality,
    );
  });
}

function baseName(target: ExportTarget): string {
  return target === 'ALL' ? 'fovlab-all-views' : `fovlab-${target.toLowerCase()}`;
}

/** The pixel size a capture of `target` at `scale`× would produce — shown in the dialog. */
export function outputSize(target: ExportTarget, scale: number): { width: number; height: number } | null {
  const host = document.getElementById(STAGE_DOM_ID);
  if (!host || host.clientWidth === 0) return null;
  const rect = targetRect(target, host);
  return { width: Math.round(rect.width * scale), height: Math.round(rect.height * scale) };
}

/**
 * Capture `target` at `scale`× resolution and hand the user a file in `format`.
 */
export async function exportViewport(
  format: ExportFormat,
  target: ExportTarget,
  scale: number,
): Promise<void> {
  const host = stageHost();
  const rect = targetRect(target, host);
  const name = baseName(target);

  // SVG is resolution-independent vector, so it never touches the WebGL buffer or the pixel ratio.
  if (format === 'svg') {
    triggerDownload(new Blob([buildVectorSvg(target, rect, host)], { type: 'image/svg+xml' }), `${name}.svg`);
    return;
  }

  const { gl, restore } = await renderAtScale(scale);
  try {
    const canvas = await composeRaster(target, scale, gl, host);
    if (format === 'png') {
      triggerDownload(await canvasToBlob(canvas, 'image/png'), `${name}.png`);
    } else if (format === 'jpeg') {
      triggerDownload(await canvasToBlob(canvas, 'image/jpeg', 0.95), `${name}.jpg`);
    } else {
      const dataUrl = canvas.toDataURL('image/png');
      const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
      const pdf = new jsPDF({ orientation, unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(dataUrl, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${name}.pdf`);
    }
  } finally {
    restore();
  }
}
