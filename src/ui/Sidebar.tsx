import Box from '@mui/material/Box';
import { useStore } from '../store/useStore';
import CoverageReport from './CoverageReport';
import DisplayPanel from './DisplayPanel';
import ShortcutsPanel from './ShortcutsPanel';
import SensorList from './SensorList';
import VehiclePanel from './VehiclePanel';

export default function Sidebar() {
  const width = useStore((s) => s.sidebarWidth);

  return (
    <Box
      component="aside"
      sx={{
        width,
        flexShrink: 0,
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        // Off-white behind the cards, so each panel reads as a raised surface.
        bgcolor: 'background.default',
        px: 1.5,
        pt: 1.5,
        pb: 3,
      }}
    >
      <VehiclePanel />
      <DisplayPanel />
      <SensorList />
      <CoverageReport />
      <ShortcutsPanel />
    </Box>
  );
}
