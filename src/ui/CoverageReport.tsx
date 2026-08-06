import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import { BLIND_RADIUS } from '../core/coverage';
import type { BlindSector } from '../core/types';
import { useStore } from '../store/useStore';
import { Panel, Readout } from './Panel';
import { MONO } from '../theme';

/** Where a bearing points, in words. 0 is forward, + is left. */
function bearingName(deg: number): string {
  const a = ((((deg + 180) % 360) + 360) % 360) - 180;
  if (Math.abs(a) <= 22.5) return 'front';
  if (a > 22.5 && a < 67.5) return 'front left';
  if (a >= 67.5 && a <= 112.5) return 'left';
  if (a > 112.5 && a < 157.5) return 'rear left';
  if (Math.abs(a) >= 157.5) return 'rear';
  if (a < -22.5 && a > -67.5) return 'front right';
  if (a <= -67.5 && a >= -112.5) return 'right';
  return 'rear right';
}

function describe(run: BlindSector): string {
  const mid = (run.startDeg + run.endDeg) / 2;
  return bearingName(mid);
}

export default function CoverageReport() {
  const report = useStore((s) => s.blindReport);
  const stale = useStore((s) => s.blindReportStale);
  const sensorCount = useStore((s) => s.sensors.filter((x) => x.visible).length);
  const display = useStore((s) => s.display);
  const setDisplay = useStore((s) => s.setDisplay);

  return (
    <Panel
      title="Coverage"
      action={stale ? <CircularProgress size={12} thickness={6} /> : undefined}
    >
      {sensorCount === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Add a sensor to see where the coverage stops.
        </Typography>
      ) : !report ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Measuring…
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Readout
            label={`Azimuth covered within ${BLIND_RADIUS} m`}
            value={`${Math.round((1 - report.blindFraction) * 100)}%`}
            color={report.blindFraction === 0 ? 'success.main' : undefined}
          />

          {report.blind.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'success.main' }}>
              No gaps within {BLIND_RADIUS} m of the vehicle.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {report.blind.length} gap{report.blind.length === 1 ? '' : 's'} within{' '}
                {BLIND_RADIUS} m
              </Typography>
              {report.blind.map((run) => (
                <Box
                  key={`${run.startDeg},${run.endDeg}`}
                  sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}
                >
                  <Typography sx={{ fontFamily: MONO, fontSize: 12.5, color: 'error.main' }}>
                    {run.startDeg.toFixed(0)}° … {run.endDeg.toFixed(0)}°
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {describe(run)} · {(run.endDeg - run.startDeg).toFixed(0)}° wide
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={display.blindSectors}
                onChange={(e) => setDisplay({ blindSectors: e.target.checked })}
              />
            }
            label="Shade the gaps in TOP"
            slotProps={{ typography: { variant: 'body2' } }}
          />
        </Box>
      )}
    </Panel>
  );
}
