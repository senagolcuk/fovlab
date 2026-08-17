import { useCallback, useEffect, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import Snackbar from '@mui/material/Snackbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { describeFov, effectiveSpec } from '../core/catalog';
import { useStore } from '../store/useStore';
import { Panel } from './Panel';
import SensorEditor from './SensorEditor';
import { MONO } from '../theme';

function SensorRow({
  id,
  expanded,
  onToggle,
}: {
  id: string;
  expanded: boolean;
  onToggle: (id: string) => void;
}) {
  const sensor = useStore((s) => s.sensors.find((x) => x.id === id))!;
  const catalog = useStore((s) => s.catalog);
  const selectedId = useStore((s) => s.selectedId);
  const updateSensor = useStore((s) => s.updateSensor);

  const selected = selectedId === sensor.id;
  const summary = describeFov(effectiveSpec(sensor, catalog));

  return (
    <Box
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: selected ? 'primary.light' : 'transparent',
      }}
    >
      <Box
        onClick={() => onToggle(sensor.id)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1,
          py: 0.75,
          cursor: 'pointer',
          opacity: sensor.visible ? 1 : 0.5,
        }}
      >
        <Box
          sx={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            bgcolor: sensor.color,
            flexShrink: 0,
          }}
        />
        {/* The name takes the slack and truncates; the summary keeps its width beside the eye. */}
        <Typography
          variant="body2"
          noWrap
          sx={{ flexGrow: 1, minWidth: 0, fontWeight: selected ? 600 : 400 }}
        >
          {sensor.name}
        </Typography>
        <Typography
          sx={{
            fontFamily: MONO,
            fontSize: 11,
            color: 'text.secondary',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {summary}
        </Typography>
        <Tooltip title={sensor.visible ? 'Hide' : 'Show'}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              updateSensor(sensor.id, { visible: !sensor.visible });
            }}
          >
            {sensor.visible ? (
              <VisibilityIcon fontSize="small" />
            ) : (
              <VisibilityOffIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ px: 1, pb: 1, bgcolor: 'background.paper' }}>
          <SensorEditor sensor={sensor} />
        </Box>
      </Collapse>
    </Box>
  );
}

export default function SensorList() {
  const ids = useStore((s) => s.sensors.map((x) => x.id).join(','));
  const selectedId = useStore((s) => s.selectedId);
  const addSensor = useStore((s) => s.addSensor);
  const duplicateSensor = useStore((s) => s.duplicateSensor);
  const clearSensors = useStore((s) => s.clearSensors);
  const requestFit = useStore((s) => s.requestFit);
  const select = useStore((s) => s.select);

  /**
   * Which row is open, tracked here rather than read off the selection.
   *
   * The two used to be the same thing, so opening the section reopened the last sensor's editor
   * and buried the list under it. They still move together in the direction that matters: picking
   * a sensor in a viewport opens its row, because that is the one you went looking for.
   */
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId) setExpandedId(selectedId);
  }, [selectedId]);

  const toggleRow = useCallback(
    (id: string) => {
      // Collapsing leaves the sensor selected: the gizmo and Delete still have something to act on.
      setExpandedId((current) => (current === id ? null : id));
      select(id);
    },
    [select],
  );
  const [error, setError] = useState<string | null>(null);
  const requestDeleteSensor = useStore((s) => s.requestDeleteSensor);
  const [confirmReset, setConfirmReset] = useState(false);

  const list = ids ? ids.split(',') : [];

  const reset = () => {
    clearSensors();
    requestFit();
    setConfirmReset(false);
  };

  return (
    <Panel
      title="Sensors"
      defaultExpanded={false}
      // Opening the section is a request to see the list, not to carry on editing whichever
      // sensor happened to be selected. Every row starts closed; the selection itself is left
      // alone, so the gizmo and Duplicate still act on what they did before.
      onExpandedChange={(open) => open && setExpandedId(null)}
    >
      <Box sx={{ mx: -2 }}>
        {list.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', px: 2, py: 1 }}>
            No sensors yet. Add one to begin.
          </Typography>
        ) : (
          list.map((id) => (
            <SensorRow key={id} id={id} expanded={id === expandedId} onToggle={toggleRow} />
          ))
        )}
      </Box>

      {/*
        One labelled action and three marks. Add is the thing you come here to do, so it keeps its
        word; the other three are recognisable as shapes and were spending a row and a half of a
        340 px panel on saying so. Each carries a tooltip, and the two that destroy something are
        the two in red.
      */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5 }}>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => addSensor()}>
          Add
        </Button>

        {/*
          The span is not decoration. A disabled button emits no pointer events, so a tooltip
          attached straight to it says nothing in the one state where a mark most needs explaining:
          before anything is selected.
        */}
        <Tooltip title="Duplicate the selected sensor">
          <span>
            <IconButton
              size="small"
              disabled={!selectedId}
              onClick={() => selectedId && duplicateSensor(selectedId)}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Remove every sensor">
          <IconButton
            size="small"
            color="error"
            // Nothing to lose when the list is already empty, so skip straight to the refit.
            onClick={() => (list.length === 0 ? reset() : setConfirmReset(true))}
          >
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Delete the selected sensor">
          <span>
            <IconButton
              size="small"
              color="error"
              disabled={!selectedId}
              // Through the prompt, so it honours the same "don't ask again" the editor's does.
              onClick={() => selectedId && requestDeleteSensor(selectedId)}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Dialog open={confirmReset} onClose={() => setConfirmReset(false)}>
        <DialogTitle>Remove all sensors?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`This deletes ${list.length} sensor${list.length === 1 ? '' : 's'} and refits the four views. The vehicle dimensions stay as they are.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={reset}>
            Remove all
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(error)}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        message={error ?? ''}
      />
    </Panel>
  );
}
