import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import RemoveIcon from '@mui/icons-material/Remove';
import Tooltip from '@mui/material/Tooltip';
import { useStore } from '../store/useStore';
import { ZOOM_STEP } from './useKeyboardShortcuts';

export default function ZoomControls({ variant }: { variant: 'floating' | 'row' }) {
  const zoomBy = useStore((s) => s.zoomBy);
  const requestFit = useStore((s) => s.requestFit);

  const buttons = (
    <>
      <Tooltip title="Zoom out  (−)">
        <IconButton size="small" onClick={() => zoomBy(1 / ZOOM_STEP)}>
          <RemoveIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Button size="small" onClick={requestFit}>
        Fit all views
      </Button>
      <Tooltip title="Zoom in  (+)">
        <IconButton size="small" onClick={() => zoomBy(ZOOM_STEP)}>
          <AddIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </>
  );

  if (variant === 'row') {
    return <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>{buttons}</Box>;
  }

  return (
    <Paper
      sx={{
        position: 'absolute',
        right: 16,
        bottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 0.5,
        border: 1,
        borderColor: 'divider',
        borderRadius: 999,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      }}
    >
      {buttons}
    </Paper>
  );
}
