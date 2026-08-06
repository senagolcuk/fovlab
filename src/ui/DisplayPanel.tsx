import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { useStore, type DisplayOptions } from '../store/useStore';
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

  return (
    <Panel title="Display">
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

      <Box sx={{ mt: 1.5 }}>
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

      <Box sx={{ mt: 1 }}>
        <ZoomControls variant="row" />
      </Box>
    </Panel>
  );
}
