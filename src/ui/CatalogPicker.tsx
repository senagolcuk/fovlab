/**
 * Model selection for one sensor instance.
 *
 * Picking a model links the instance to a catalogue spec; it never copies the numbers in. That
 * way a corrected datasheet value reaches every instance using it. `Customise` cuts the link and
 * freezes the current numbers into the instance.
 */

import { useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { effectiveSpec, findSpec } from '../core/catalog';
import type { SensorInstance, SensorSpec } from '../core/types';
import { useStore } from '../store/useStore';
import AddModelDialog from './AddModelDialog';

export default function CatalogPicker({ sensor }: { sensor: SensorInstance }) {
  const catalog = useStore((s) => s.catalog);
  const userModels = useStore((s) => s.userModels);
  const updateSensor = useStore((s) => s.updateSensor);
  const removeModel = useStore((s) => s.removeModel);
  const [adding, setAdding] = useState(false);

  const spec = findSpec(sensor.specId, catalog) ?? null;
  const overridden = Object.keys(sensor.override ?? {}).length > 0;
  /** Built-ins cannot be deleted — they ship with the app. */
  const isUserModel = spec !== null && userModels.some((m) => m.id === spec.id);

  const choose = (next: SensorSpec | null) => {
    if (!next) {
      // Back to fully custom, keeping whatever numbers are on screen right now.
      updateSensor(sensor.id, {
        specId: null,
        custom: effectiveSpec(sensor, catalog),
        override: undefined,
      });
      return;
    }
    updateSensor(sensor.id, { specId: next.id, custom: undefined, override: undefined });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Autocomplete
        options={catalog}
        value={spec}
        onChange={(_, next) => choose(next)}
        groupBy={(o) => o.manufacturer}
        getOptionLabel={(o) => `${o.manufacturer} ${o.model}`}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        renderInput={(params) => (
          <TextField {...params} label="Model" placeholder="Custom sensor" />
        )}
        renderOption={(props, option) => {
          const { key, ...rest } = props as typeof props & { key: string };
          return (
            <Box component="li" key={key} {...rest} sx={{ display: 'block !important' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ fontSize: 14 }}>{option.model}</Box>
                {!option.verified && (
                  <WarningAmberIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                )}
              </Box>
              <Box sx={{ fontSize: 12, color: 'text.secondary' }}>
                {option.kind} · {option.hfov}°×{option.vfov}° · {option.range} m
              </Box>
            </Box>
          );
        }}
        size="small"
        fullWidth
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setAdding(true)}>
          Add model
        </Button>
        {isUserModel && (
          <Button size="small" color="error" onClick={() => removeModel(spec.id)}>
            Delete model
          </Button>
        )}
      </Box>

      <AddModelDialog
        open={adding}
        onClose={() => setAdding(false)}
        // Point this sensor at the type that was just defined.
        onCreated={(id) => updateSensor(sensor.id, { specId: id, custom: undefined, override: undefined })}
      />

      {spec && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {!spec.verified && (
            <Tooltip title="These numbers have not been checked against a datasheet. Do not trust them.">
              <Chip
                size="small"
                color="warning"
                variant="outlined"
                icon={<WarningAmberIcon />}
                label="Unverified"
              />
            </Tooltip>
          )}
          {spec.datasheetUrl && (
            <Link
              href={spec.datasheetUrl}
              target="_blank"
              rel="noreferrer"
              variant="caption"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}
            >
              Datasheet <OpenInNewIcon sx={{ fontSize: 12 }} />
            </Link>
          )}
          {overridden && (
            <Chip
              size="small"
              variant="outlined"
              label="Overridden"
              onDelete={() => updateSensor(sensor.id, { override: undefined })}
            />
          )}
          <Button size="small" onClick={() => choose(null)}>
            Customise
          </Button>
        </Box>
      )}
    </Box>
  );
}
