/**
 * A numeric input that an engineer can type into without the value fighting back.
 *
 * The text is held locally so intermediate states — `-`, `1.`, an empty box — survive, while
 * every parseable keystroke commits straight through so the 3D view tracks the typing.
 */

import { useEffect, useRef, useState } from 'react';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import { MONO } from '../theme';

export interface NumberFieldProps {
  label: string;
  value: number;
  onChange(value: number): void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  disabled?: boolean;
  helperText?: string;
  /** Renders the value greyed to show it still comes from the catalogue spec. */
  inherited?: boolean;
  fullWidth?: boolean;
}

function format(v: number): string {
  if (!Number.isFinite(v)) return '0';
  return String(Math.round(v * 1e6) / 1e6);
}

export default function NumberField({
  label,
  value,
  onChange,
  step = 0.01,
  min,
  max,
  unit,
  disabled,
  helperText,
  inherited,
  fullWidth = true,
}: NumberFieldProps) {
  const [text, setText] = useState(() => format(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(format(value));
  }, [value]);

  const commit = (raw: string) => {
    const parsed = Number(raw);
    if (raw.trim() === '' || Number.isNaN(parsed)) return;
    let v = parsed;
    if (min !== undefined && v < min) v = min;
    if (max !== undefined && v > max) v = max;
    if (v !== value) onChange(v);
  };

  return (
    <TextField
      label={label}
      value={text}
      disabled={disabled}
      fullWidth={fullWidth}
      helperText={helperText}
      type="number"
      inputProps={{ step, min, max }}
      InputProps={{
        endAdornment: unit ? (
          <InputAdornment position="end">
            <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>{unit}</span>
          </InputAdornment>
        ) : undefined,
        sx: {
          fontFamily: MONO,
          fontSize: 14,
          color: inherited ? 'text.secondary' : 'text.primary',
        },
      }}
      onFocus={(e) => {
        focused.current = true;
        e.target.select();
      }}
      // A focused number input treats the wheel as a spinner in every browser, so scrolling the
      // sidebar past one silently edits it. Dropping focus first lets the scroll through and
      // leaves the value alone — the default action reads the focus state after this handler.
      onWheel={(e) => {
        if (focused.current) (e.target as HTMLElement).blur();
      }}
      onBlur={() => {
        focused.current = false;
        commit(text);
        setText(format(value));
      }}
      onChange={(e) => {
        setText(e.target.value);
        commit(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
