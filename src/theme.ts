/** Material 3 light, violet primary. Roboto for the interface, Roboto Mono for every number. */

import { createTheme } from '@mui/material/styles';

export const MONO = "'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#6750A4', light: '#EADDFF', dark: '#4F378B', contrastText: '#FFFFFF' },
    secondary: { main: '#625B71', light: '#E8DEF8', dark: '#4A4458', contrastText: '#FFFFFF' },
    error: { main: '#B3261E', light: '#F9DEDC', dark: '#8C1D18', contrastText: '#FFFFFF' },
    warning: { main: '#8C5000', light: '#FFDDB3' },
    success: { main: '#3F6B2B' },
    background: { default: '#FEF7FF', paper: '#FFFFFF' },
    text: { primary: '#1D1B20', secondary: '#49454F' },
    divider: '#CAC4D0',
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
