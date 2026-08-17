import type { ReactNode } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Typography from '@mui/material/Typography';
import { CARD_SHADOW, HEADER_TINT, MONO } from '../theme';

/**
 * A collapsible sidebar section, drawn as its own card.
 *
 * The sections used to run together as one column split by hairlines, which left it hard to see
 * where one ended and the next began. Each is now a bordered card on the off-white sidebar, with
 * a tinted header, so the boundary is a shape rather than a line.
 */
export function Panel({
  title,
  children,
  defaultExpanded = true,
  action,
  onExpandedChange,
}: {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  action?: ReactNode;
  /** Fires when the section opens or closes, for sections that reset state on open. */
  onExpandedChange?: (expanded: boolean) => void;
}) {
  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      onChange={(_, expanded) => onExpandedChange?.(expanded)}
      disableGutters
      square
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        // The header tint would otherwise square off the rounded corners.
        overflow: 'hidden',
        boxShadow: CARD_SHADOW,
        mb: 1.5,
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ color: 'secondary.main' }} />}
        sx={{
          minHeight: 44,
          bgcolor: HEADER_TINT,
          '&.Mui-expanded': { minHeight: 44, borderBottom: 1, borderColor: 'divider' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', pr: 1 }}>
          <Typography
            variant="subtitle2"
            sx={{
              textTransform: 'uppercase',
              color: 'secondary.main',
              fontWeight: 600,
              letterSpacing: 0.8,
              flexGrow: 1,
            }}
          >
            {title}
          </Typography>
          {action}
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 2, pb: 2 }}>{children}</AccordionDetails>
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
      <Typography
        sx={{ fontFamily: MONO, fontSize: 12.5, color: color ?? 'text.primary', textAlign: 'right' }}
      >
        {value}
      </Typography>
    </Box>
  );
}
