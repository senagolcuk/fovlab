/** Roboto for the interface, Roboto Mono for every number an engineer reads off the screen. */

import { createTheme } from '@mui/material/styles';

/**
 * Width of the little caption that labels a segmented control — Shape, Drag, Range. Shared so the
 * three option groups start on the same x even though they live in different panels.
 */
export const CONTROL_LABEL_WIDTH = 58;

/** The caption that labels a control. `text.secondary` alone reads as disabled next to the rows. */
export const CONTROL_LABEL_SX = {
  // Darker than the surrounding captions, but not bold — the weight read as shouting.
  color: 'text.primary',
  // Two-word labels have to stay on one line, or the column stops lining up.
  whiteSpace: 'nowrap',
} as const;

export const MONO = "'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

/**
 * The house palette. Six fixed colours, so anything added later picks from these rather than
 * inventing a neighbouring shade.
 */
export const PALETTE = {
  blue: '#1E79D3',
  slate: '#495F81',
  sky: '#B0CED7',
  orange: '#FFA52C',
  offWhite: '#F1F1F1',
  grey: '#BFBFBF',
} as const;

/** Panel headers: the sky at low alpha, so a header separates without becoming a second colour. */
export const HEADER_TINT = 'rgba(176, 206, 215, 0.38)';
/** Enough lift to read as a raised card on the off-white sidebar, not a drop shadow. */
export const CARD_SHADOW = '0 1px 3px rgba(73, 95, 129, 0.16)';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: PALETTE.blue, light: PALETTE.sky, dark: PALETTE.slate, contrastText: '#FFFFFF' },
    secondary: { main: PALETTE.slate, light: PALETTE.sky, dark: '#33455F', contrastText: '#FFFFFF' },
    error: { main: '#B3261E', light: '#F9DEDC', dark: '#8C1D18', contrastText: '#FFFFFF' },
    // Orange carries dark text: white on it is about 1.9:1, which is unreadable.
    warning: { main: PALETTE.orange, light: '#FFE3B8', dark: '#B36F00', contrastText: '#16202E' },
    success: { main: '#3F6B2B' },
    background: { default: PALETTE.offWhite, paper: '#FFFFFF' },
    text: { primary: '#16202E', secondary: PALETTE.slate },
    divider: PALETTE.grey,
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "Roboto, 'Helvetica Neue', Arial, sans-serif",
    h6: { fontSize: '1rem', fontWeight: 500, letterSpacing: 0.15 },
    subtitle2: { fontSize: '0.75rem', fontWeight: 500, letterSpacing: 0.5 },
    button: { textTransform: 'none', fontWeight: 500, letterSpacing: 0.1 },
    caption: { fontSize: '0.6875rem', letterSpacing: 0.4 },
  },
  components: {
    MuiTextField: { defaultProps: { size: 'small', variant: 'outlined' } },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiTooltip: { defaultProps: { enterDelay: 500 } },
    MuiCssBaseline: {
      styleOverrides: {
        'html, body, #root': { height: '100%', overflow: 'hidden' },
      },
    },
  },
});
