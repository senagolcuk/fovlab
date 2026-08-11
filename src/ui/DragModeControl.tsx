/**
 * The Off / Move / Rotate control.
 *
 * Laid out as three columns so the **buttons** land dead centre of the panel, with the label
 * hanging off their left. Centring the label and buttons together would push the buttons right
 * by half the label's width, which reads as crooked against the rows above and below.
 */

import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useStore } from '../store/useStore';

export default function DragModeControl() {
  const dragMode = useStore((s) => s.dragMode);
  const setDragMode = useStore((s) => s.setDragMode);

  return (
    <Box
      sx={{
        display: 'grid',
        // Equal outer columns put the middle one — the buttons — on the centre line.
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
      }}
    >
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', justifySelf: 'end', pr: 1 }}
      >
        Drag
      </Typography>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={dragMode}
        onChange={(_, v) => v && setDragMode(v)}
      >
        <ToggleButton value="off" sx={{ px: 1.5, py: 0.25 }}>
          Off
        </ToggleButton>
        <ToggleButton value="translate" sx={{ px: 1.5, py: 0.25 }}>
          Move
        </ToggleButton>
        <ToggleButton value="rotate" sx={{ px: 1.5, py: 0.25 }}>
          Rotate
        </ToggleButton>
      </ToggleButtonGroup>
      {/* Balances the label's column so the buttons stay centred. */}
      <span />
    </Box>
  );
}
