/**
 * The layout file, in and out.
 *
 * These used to sit under SENSORS, where `Export` wrote the vehicle, the range mode and the
 * user-defined models as well — a button that saves more than its panel is about. Up here it can
 * be called what it is, beside `Image`, so the two things the app writes out are told apart by
 * their names rather than by remembering which was which.
 */

import { useRef, useState } from 'react';
import Button from '@mui/material/Button';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import UploadIcon from '@mui/icons-material/Upload';
import { downloadLayout, readLayoutFile } from '../store/persist';
import { currentLayout, useStore } from '../store/useStore';

export default function LayoutMenu() {
  const importLayout = useStore((s) => s.importLayout);
  const requestFit = useStore((s) => s.requestFit);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      importLayout(await readLayoutFile(file));
      requestFit();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file could not be read.');
    }
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<DescriptionOutlinedIcon />}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        Layout
      </Button>

      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            downloadLayout(currentLayout());
          }}
        >
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Export layout"
            secondary="Vehicle, sensors and any models they use"
          />
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            fileRef.current?.click();
          }}
        >
          <ListItemIcon>
            <UploadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Import layout" secondary="Replaces what is on screen" />
        </MenuItem>
      </Menu>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          void onImport(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <Snackbar
        open={Boolean(error)}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        message={error ?? ''}
      />
    </>
  );
}
