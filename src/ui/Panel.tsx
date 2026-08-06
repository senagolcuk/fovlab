import type { ReactNode } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Typography from '@mui/material/Typography';
import { MONO } from '../theme';

/** A collapsible sidebar section. */
export function Panel({
  title,
  children,
  defaultExpanded = true,
  action,
}: {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  action?: ReactNode;
}) {
  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      square
      sx={{
        bgcolor: 'transparent',
        '&:before': { display: 'none' },
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 48 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', pr: 1 }}>
          <Typography
            variant="subtitle2"
            sx={{ textTransform: 'uppercase', color: 'text.secondary', flexGrow: 1 }}
          >
            {title}
          </Typography>
          {action}
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0, pb: 2 }}>{children}</AccordionDetails>
    </Accordion>
  );
}

/** A label / monospaced-value row, for numbers that are read rather than typed. */
export function Readout({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography sx={{ fontFamily: MONO, fontSize: 12.5, color: color ?? 'text.primary' }}>
        {value}
      </Typography>
    </Box>
  );
}
