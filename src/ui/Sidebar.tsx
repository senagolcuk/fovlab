import Box from '@mui/material/Box';
import NavigationPanel from './NavigationPanel';
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
      <NavigationPanel />
    </Box>
  );
}
