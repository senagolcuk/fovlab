import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_VIEWS,
  ELEVATION_LIMIT,
  ISO_DISTANCE_LIMITS,
  ZOOM_LIMITS,
  useStore,
} from '../useStore';

beforeEach(() => {
  useStore.setState({ views: structuredClone(DEFAULT_VIEWS), linkZoom: true });
});

describe('zoomBy', () => {
  it('scales every pane when zoom is linked', () => {
    useStore.getState().zoomBy(2, 'TOP');
    const v = useStore.getState().views;
    expect(v.TOP.zoom).toBe(DEFAULT_VIEWS.TOP.zoom * 2);
    expect(v.FRONT.zoom).toBe(DEFAULT_VIEWS.FRONT.zoom * 2);
    expect(v.LEFT.zoom).toBe(DEFAULT_VIEWS.LEFT.zoom * 2);
    // Zooming in on a perspective pane means moving closer.
    expect(v.ISO.distance).toBe(DEFAULT_VIEWS.ISO.distance / 2);
  });

  it('scales only the originating pane when zoom is unlinked', () => {
    useStore.setState({ linkZoom: false });
    useStore.getState().zoomBy(2, 'TOP');
    const v = useStore.getState().views;
    expect(v.TOP.zoom).toBe(DEFAULT_VIEWS.TOP.zoom * 2);
    expect(v.FRONT.zoom).toBe(DEFAULT_VIEWS.FRONT.zoom);
    expect(v.ISO.distance).toBe(DEFAULT_VIEWS.ISO.distance);
  });

  it('scales every pane when no pane originated the gesture, even unlinked', () => {
    useStore.setState({ linkZoom: false });
    useStore.getState().zoomBy(2);
    const v = useStore.getState().views;
    expect(v.FRONT.zoom).toBe(DEFAULT_VIEWS.FRONT.zoom * 2);
  });

  it('clamps rather than running away', () => {
    for (let i = 0; i < 200; i++) useStore.getState().zoomBy(2);
    expect(useStore.getState().views.TOP.zoom).toBe(ZOOM_LIMITS[1]);
    expect(useStore.getState().views.ISO.distance).toBe(ISO_DISTANCE_LIMITS[0]);

    for (let i = 0; i < 400; i++) useStore.getState().zoomBy(0.5);
    expect(useStore.getState().views.TOP.zoom).toBe(ZOOM_LIMITS[0]);
    expect(useStore.getState().views.ISO.distance).toBe(ISO_DISTANCE_LIMITS[1]);
  });
});

describe('setIsoView', () => {
  it('clamps elevation so the orbit never flips over the pole', () => {
    useStore.getState().setIsoView({ elevation: 120 });
    expect(useStore.getState().views.ISO.elevation).toBe(ELEVATION_LIMIT);
    useStore.getState().setIsoView({ elevation: -120 });
    expect(useStore.getState().views.ISO.elevation).toBe(-ELEVATION_LIMIT);
  });

  it('leaves azimuth free to wrap', () => {
    useStore.getState().setIsoView({ azimuth: 4000 });
    expect(useStore.getState().views.ISO.azimuth).toBe(4000);
  });
});

describe('requestFit', () => {
  it('bumps the nonce so the stage refits', () => {
    const before = useStore.getState().fitNonce;
    useStore.getState().requestFit();
    expect(useStore.getState().fitNonce).toBe(before + 1);
  });
});
