/**
 * Fullscreen toggle for the app bar.
 *
 * The Fullscreen API is as close as script can get to F11 — the page fills the screen and the
 * browser chrome goes away — but it is the page asking, not the browser, so it only works from a
 * user gesture and the button has to track state through `fullscreenchange` rather than assuming
 * its own click won. Safari still needs the `webkit` spellings.
 */

import { useCallback, useEffect, useState } from 'react';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

interface VendorDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
}

interface VendorElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
}

const doc = () => document as VendorDocument;
const root = () => document.documentElement as VendorElement;

function isFullscreen(): boolean {
  const d = doc();
  return Boolean(d.fullscreenElement ?? d.webkitFullscreenElement);
}

function supported(): boolean {
  const el = root();
  return Boolean(el.requestFullscreen ?? el.webkitRequestFullscreen);
}

export default function FullscreenButton() {
  const [full, setFull] = useState(false);

  useEffect(() => {
    const sync = () => setFull(isFullscreen());
    sync();
    // Covers Escape and the browser's own exit, not just this button.
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  const toggle = useCallback(() => {
    const d = doc();
    const el = root();
    // A rejected request is a refusal, not a crash: some browsers block it outside a gesture.
    if (isFullscreen()) {
      void (d.exitFullscreen ?? d.webkitExitFullscreen)?.call(d)?.catch(() => {});
    } else {
      void (el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el)?.catch(() => {});
    }
  }, []);

  if (!supported()) return null;

  return (
    <Tooltip title={full ? 'Leave fullscreen' : 'Fullscreen'}>
      <IconButton size="small" onClick={toggle} aria-label="Toggle fullscreen">
        {full ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}
