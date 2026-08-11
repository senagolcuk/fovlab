import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { gridExtents } from '../scene/GroundGrid';
import { GRID_SIZE_LIMITS, useStore, type DisplayOptions } from '../store/useStore';
import DragModeControl from './DragModeControl';
import NumberField from './NumberField';
import { Panel } from './Panel';
import ZoomControls from './ZoomControls';
import { MONO } from '../theme';

const TOGGLES: Array<[keyof DisplayOptions, string]> = [
  ['volume', 'Shaded volume'],
  ['edges', 'Wireframe edges'],
  ['ground', 'Ground footprint'],
  ['axis', 'Optical axis'],
];

export default function DisplayPanel() {
  const display = useStore((s) => s.display);
  const setDisplay = useStore((s) => s.setDisplay);
  const linkZoom = useStore((s) => s.linkZoom);
  const setLinkZoom = useStore((s) => s.setLinkZoom);
  const askBeforeDelete = useStore((s) => s.askBeforeDelete);
  const setAskBeforeDelete = useStore((s) => s.setAskBeforeDelete);

  const { fineHalf, majorStep, coarseHalf } = gridExtents(display.gridSize);

  return (
    <Panel title="Display">
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Box sx={{ width: 200, flexShrink: 0 }}>
          <NumberField
            label="Cell size"
            unit="m"
            step={0.1}
            value={display.gridSize}
            min={GRID_SIZE_LIMITS[0]}
            max={GRID_SIZE_LIMITS[1]}
            disabled={!display.grid}
            onChange={(gridSize) => setDisplay({ gridSize })}
          />
        </Box>
        <FormControlLabel
          // `auto` pushes it to the right wall; `mx: 0` drops the 11 px MUI pulls labels left by.
          sx={{ mx: 0, ml: 'auto' }}
          control={
            <Switch
              size="small"
              checked={display.grid}
              onChange={(e) => setDisplay({ grid: e.target.checked })}
            />
          }
          label="Grid"
          slotProps={{ typography: { variant: 'body2', fontSize: 13 } }}
        />
      </Box>

      <Typography
        sx={{ fontFamily: MONO, fontSize: 11, color: 'text.secondary', mt: 1, display: 'block' }}
      >
        {`fine to ${fineHalf.toFixed(2)} m · heavy line every ${majorStep.toFixed(2)} m · out to ${coarseHalf.toFixed(0)} m`}
      </Typography>

      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            FOV opacity
          </Typography>
          <Typography sx={{ fontFamily: MONO, fontSize: 12 }}>
            {Math.round(display.opacity * 100)}%
          </Typography>
        </Box>
        <Slider
          size="small"
          value={display.opacity}
          min={0.05}
          max={0.7}
          step={0.01}
          onChange={(_, v) => setDisplay({ opacity: v as number })}
        />
      </Box>

      <Box sx={{ mt: 2, mb: 2 }}>
        <DragModeControl />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        {TOGGLES.map(([key, label]) => (
          <FormControlLabel
            key={key}
            control={
              <Checkbox
                size="small"
                checked={display[key] as boolean}
                onChange={(e) => setDisplay({ [key]: e.target.checked })}
              />
            }
            label={label}
            slotProps={{ typography: { variant: 'body2' } }}
          />
        ))}
      </Box>

      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={linkZoom}
            onChange={(e) => setLinkZoom(e.target.checked)}
          />
        }
        label="Link zoom across views"
        slotProps={{ typography: { variant: 'body2' } }}
      />

      {/* The only way back once the delete prompt's "don't ask again" has been ticked. */}
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={askBeforeDelete}
            onChange={(e) => setAskBeforeDelete(e.target.checked)}
          />
        }
        label="Ask before deleting a sensor"
        slotProps={{ typography: { variant: 'body2' } }}
      />

      <Box sx={{ mt: 1 }}>
        <ZoomControls variant="row" />
      </Box>
    </Panel>
  );
}
