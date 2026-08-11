import Box from '@mui/material/Box';
import { Panel, Readout } from './Panel';

/** Where a key differs on macOS, both spellings are given, separated by a slash. */
const KEYS: Array<[string, string]> = [
  ['Scroll', 'Zoom'],
  ['Middle-drag', 'Pan, in any pane'],
  ['Drag in ISO', 'Orbit'],
  ['Shift + drag in ISO', 'Pan'],
  ['Double-click a pane', 'Fit that pane'],
  ['+  /  −', 'Zoom in / out'],
  ['F', 'Fit all views'],
  ['Delete / Backspace', 'Removes the selected sensor, while a drag mode is on'],
  ['Ctrl / Cmd + Z', 'Undo'],
  ['Ctrl / Cmd + Y', 'Redo'],
  ['Alt / Option while dragging', 'Ignore the 15 cm snap to the body'],
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
