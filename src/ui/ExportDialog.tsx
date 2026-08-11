/**
 * Saves the viewport as an image or document.
 *
 * The engineer picks a pane — or all four at once — a format and a resolution, and gets a file.
 * The capture itself lives in `exportImage`; this is only the chooser and the progress and error
 * feedback around it.
 */

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import DownloadIcon from '@mui/icons-material/Download';
import Snackbar from '@mui/material/Snackbar';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { VIEW_NAMES } from '../core/viewport';
import {
  EXPORT_FORMATS,
  exportViewport,
  outputSize,
  type ExportFormat,
  type ExportTarget,
} from './exportImage';

const PANE_OPTIONS: Array<{ value: ExportTarget; label: string }> = [
  { value: 'ALL', label: 'All views' },
  ...VIEW_NAMES.map((name) => ({ value: name as ExportTarget, label: name })),
];

const SCALES = [1, 2, 3, 4];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

export default function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [target, setTarget] = useState<ExportTarget>('ALL');
  const [format, setFormat] = useState<ExportFormat>('png');
  const [scale, setScale] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recomputed on every open and every choice, since the viewport can be resized between exports.
  const dims = open ? outputSize(target, scale) : null;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await exportViewport(format, target, scale);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The export failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
        <DialogTitle>Export image</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <Field label="Which pane">
              <ToggleButtonGroup
                exclusive
                size="small"
                value={target}
                onChange={(_, v) => v && setTarget(v)}
                sx={{ flexWrap: 'wrap' }}
              >
                {PANE_OPTIONS.map((o) => (
                  <ToggleButton key={o.value} value={o.value} sx={{ textTransform: 'none', px: 1.5 }}>
                    {o.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Field>

            <Field label="Format">
              <ToggleButtonGroup
                exclusive
                size="small"
                value={format}
                onChange={(_, v) => v && setFormat(v)}
              >
                {EXPORT_FORMATS.map((f) => (
                  <ToggleButton key={f.value} value={f.value} sx={{ textTransform: 'none', px: 2 }}>
                    {f.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Field>

            <Field label="Resolution">
              <ToggleButtonGroup
                exclusive
                size="small"
                value={scale}
                onChange={(_, v) => v && setScale(v)}
              >
                {SCALES.map((s) => (
                  <ToggleButton key={s} value={s} sx={{ textTransform: 'none', px: 2 }}>
                    {s}×
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
                {dims
                  ? `${dims.width} × ${dims.height} px — the pixel size of the saved file. Higher is sharper but larger.`
                  : 'A multiplier over the on-screen size — higher is sharper but a larger file.'}
              </Typography>
            </Field>

            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {target === 'ALL'
                ? 'Captures all four panes, including labels and dimensions.'
                : `Captures the ${target} pane only.`}
              {format === 'svg' && ' SVG is fully vector — every shape stays editable in Figma or Illustrator.'}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={run}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
          >
            {busy ? 'Exporting…' : 'Export'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(error)}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setError(null)} variant="filled">
          {error}
        </Alert>
      </Snackbar>
    </>
  );
}
