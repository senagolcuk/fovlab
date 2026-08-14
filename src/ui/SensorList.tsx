import { useCallback, useEffect, useRef, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import DownloadIcon from '@mui/icons-material/Download';
import IconButton from '@mui/material/IconButton';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import Snackbar from '@mui/material/Snackbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import UploadIcon from '@mui/icons-material/Upload';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { describeFov, effectiveSpec } from '../core/catalog';
import { currentLayout, useStore } from '../store/useStore';
import { downloadLayout, readLayoutFile } from '../store/persist';
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
  const importLayout = useStore((s) => s.importLayout);
  const clearSensors = useStore((s) => s.clearSensors);
  const requestFit = useStore((s) => s.requestFit);
  const select = useStore((s) => s.select);
  const fileRef = useRef<HTMLInputElement>(null);

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
  const [confirmReset, setConfirmReset] = useState(false);

  const list = ids ? ids.split(',') : [];

  const reset = () => {
    clearSensors();
    requestFit();
    setConfirmReset(false);
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      importLayout(await readLayoutFile(file));
      requestFit();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file could not be read.');
    }
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
            No sensors yet — add one to begin.
          </Typography>
        ) : (
          list.map((id) => (
            <SensorRow key={id} id={id} expanded={id === expandedId} onToggle={toggleRow} />
          ))
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 0.5, mt: 1.5, flexWrap: 'wrap' }}>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => addSensor()}>
          Add sensor
        </Button>
        <Button
          size="small"
          startIcon={<ContentCopyIcon />}
          disabled={!selectedId}
          onClick={() => selectedId && duplicateSensor(selectedId)}
        >
          Duplicate
        </Button>
        <Button
          size="small"
          startIcon={<DownloadIcon />}
          onClick={() => downloadLayout(currentLayout())}
        >
          Export
        </Button>
        <Button size="small" startIcon={<UploadIcon />} onClick={() => fileRef.current?.click()}>
          Import
        </Button>
        <Button
          size="small"
          color="error"
          startIcon={<RestartAltIcon />}
          // Nothing to lose when the list is already empty, so skip straight to the refit.
          onClick={() => (list.length === 0 ? reset() : setConfirmReset(true))}
        >
          Reset
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void onImport(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
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
