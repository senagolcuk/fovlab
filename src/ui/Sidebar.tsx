import Box from '@mui/material/Box';
import CoverageReport from './CoverageReport';
import DisplayPanel from './DisplayPanel';
import NavigationPanel from './NavigationPanel';
import SensorList from './SensorList';
import VehiclePanel from './VehiclePanel';

export const SIDEBAR_WIDTH = 360;

export default function Sidebar() {
  return (
    <Box
      component="aside"
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
      }}
    >
      <VehiclePanel />
      <SensorList />
      <DisplayPanel />
      <CoverageReport />
      <NavigationPanel />
    </Box>
  );
}
