/**
 * Confirms a keyboard delete.
 *
 * Delete is easy to hit by accident while a drag mode is on, so the first one asks. The checkbox
 * turns the prompt off for good, per person rather than per layout.
 */

import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import { useStore } from '../store/useStore';

export default function DeletePrompt() {
  const pendingId = useStore((s) => s.pendingDeleteId);
  const sensor = useStore((s) => s.sensors.find((x) => x.id === s.pendingDeleteId) ?? null);
  const confirm = useStore((s) => s.confirmPendingDelete);
  const cancel = useStore((s) => s.cancelPendingDelete);

  const [dontAsk, setDontAsk] = useState(false);

  // The tick is a decision about this prompt, not a standing one until it is confirmed.
  useEffect(() => {
    if (pendingId) setDontAsk(false);
  }, [pendingId]);

  return (
    <Dialog open={Boolean(pendingId)} onClose={cancel}>
      <DialogTitle>Are you sure you want to delete {sensor?.name ?? 'this sensor'}?</DialogTitle>
      <DialogContent>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={dontAsk}
              onChange={(e) => setDontAsk(e.target.checked)}
            />
          }
          label="Don't ask again"
          slotProps={{ typography: { variant: 'body2' } }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={cancel}>Cancel</Button>
        <Button color="error" variant="contained" onClick={() => confirm(dontAsk)}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
