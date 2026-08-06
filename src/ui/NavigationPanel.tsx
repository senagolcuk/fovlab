import Box from '@mui/material/Box';
import { Panel, Readout } from './Panel';

const KEYS: Array<[string, string]> = [
  ['Scroll', 'Zoom'],
  ['Drag empty space', 'Pan'],
  ['Drag in ISO', 'Orbit'],
  ['Shift + drag in ISO', 'Pan'],
  ['Double-click a pane', 'Fit that pane'],
  ['+  /  −', 'Zoom in / out'],
  ['F', 'Fit all views'],
  ['Alt while dragging', 'Suppress snap to body'],
];

export default function NavigationPanel() {
  return (
    <Panel title="Navigation" defaultExpanded={false}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {KEYS.map(([k, v]) => (
          <Readout key={k} label={k} value={v} />
        ))}
      </Box>
    </Panel>
  );
}
