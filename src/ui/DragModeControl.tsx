/**
 * The Off / Move / Rotate control.
 *
 * The label sits in `CONTROL_LABEL_WIDTH`, the shared column that Shape and Range also use, so
 * all three option groups start on the same x.
 */

import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useStore } from '../store/useStore';
import { CONTROL_LABEL_SX, CONTROL_LABEL_WIDTH } from '../theme';

export default function DragModeControl() {
  const dragMode = useStore((s) => s.dragMode);
  const setDragMode = useStore((s) => s.setDragMode);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Typography
        variant="caption"
        sx={{ ...CONTROL_LABEL_SX, width: CONTROL_LABEL_WIDTH, flexShrink: 0 }}
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
    </Box>
  );
}
