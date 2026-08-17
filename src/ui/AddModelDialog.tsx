/**
 * Defines a new sensor model — a catalogue entry, not a mounted sensor.
 *
 * `Add sensor` puts an instance on the vehicle; this adds a *type* that any number of instances
 * can then point at, so correcting a figure here reaches all of them. The model is saved to this
 * browser and written into an exported layout, because a file whose sensors reference a model the
 * reader does not have would silently draw the default 90°×60° 10 m.
 */

import { useEffect, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { SUGGESTED_KINDS } from '../core/catalog';
import { FOV_MIN, RANGE_MIN } from '../core/frustum';
import type { SensorSpec } from '../core/types';
import { useStore } from '../store/useStore';
import NumberField from './NumberField';

/** Angles a datasheet could state, up to a full turn. Past 180° is allowed and flagged. */
const ANGLE_MAX = 360;

export default function AddModelDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const addModel = useStore((s) => s.addModel);

  const [manufacturer, setManufacturer] = useState('Custom');
  const [model, setModel] = useState('');
  const [kind, setKind] = useState('camera');
  const [hfov, setHfov] = useState(90);
  const [vfov, setVfov] = useState(60);
  const [range, setRange] = useState(20);
  const [datasheetUrl, setDatasheetUrl] = useState('');

  // A fresh dialog each time, so yesterday's half-typed model does not come back.
  useEffect(() => {
    if (!open) return;
    setManufacturer('Custom');
    setModel('');
    setKind('camera');
    setHfov(90);
    setVfov(60);
    setRange(20);
    setDatasheetUrl('');
  }, [open]);

  const trimmedModel = model.trim();
  const trimmedKind = kind.trim();
  const canSave =
    trimmedModel !== '' && trimmedKind !== '' && manufacturer.trim() !== '' && range >= RANGE_MIN;

  const save = () => {
    if (!canSave) return;
    const draft: Omit<SensorSpec, 'id'> = {
      kind: trimmedKind,
      manufacturer: manufacturer.trim(),
      model: trimmedModel,
      hfov,
      vfov,
      range,
      // A URL is the project's own marker for "checked against the datasheet". Typed-in figures
      // stay unverified so they never sit alongside datasheet numbers as if they were equal.
      verified: datasheetUrl.trim() !== '',
    };
    if (datasheetUrl.trim() !== '') draft.datasheetUrl = datasheetUrl.trim();
    const id = addModel(draft);
    onCreated?.(id);
    onClose();
  };

  const wide = hfov >= 180 || vfov >= 180;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add model</DialogTitle>
      <DialogContent>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
          A sensor type, not a mounted sensor. Pick it from the Model list afterwards.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Surround camera 190°"
            autoFocus
            fullWidth
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Manufacturer"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              fullWidth
            />
            <Autocomplete
              freeSolo
              options={SUGGESTED_KINDS}
              value={kind}
              onInputChange={(_, v) => setKind(v)}
              renderInput={(params) => <TextField {...params} label="Kind" />}
              size="small"
              fullWidth
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <NumberField
              label="HFOV"
              unit="°"
              step={1}
              value={hfov}
              min={FOV_MIN}
              max={ANGLE_MAX}
              onChange={setHfov}
            />
            <NumberField
              label="VFOV"
              unit="°"
              step={1}
              value={vfov}
              min={FOV_MIN}
              max={ANGLE_MAX}
              onChange={setVfov}
            />
            <NumberField
              label="Range"
              unit="m"
              step={1}
              value={range}
              min={RANGE_MIN}
              max={1000}
              onChange={setRange}
            />
          </Box>

          {wide && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Drawn at the figure you typed, swept by angle: no flat image rectangle subtends 180°
              or more, so the far edge is radial whichever range mode is set.
            </Typography>
          )}

          <TextField
            label="Datasheet URL"
            value={datasheetUrl}
            onChange={(e) => setDatasheetUrl(e.target.value)}
            placeholder="Leave empty if the figures are not from a datasheet"
            helperText={
              datasheetUrl.trim() === ''
                ? 'Without one the model is marked Unverified.'
                : 'Marks the model verified.'
            }
            fullWidth
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!canSave} onClick={save}>
          Add model
        </Button>
      </DialogActions>
    </Dialog>
  );
}
