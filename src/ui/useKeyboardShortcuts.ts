/**
 * Global keys. Ignored while a text field has focus, so typing `-6` into a pitch box does not
 * zoom the views out from under the cursor.
 */

import { useEffect } from 'react';
import { useStore } from '../store/useStore';

export const ZOOM_STEP = 1.25;

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Checked first so Ctrl+Z inside a number field still undoes the typing, not the layout.
      if (isTypingTarget(e.target)) return;

      const store = useStore.getState();

      // Ctrl on Windows and Linux, Cmd on macOS. Ctrl+Shift+Z redoes as well as Ctrl+Y, since
      // both are muscle memory depending on where someone came from.
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'z' && !e.shiftKey) store.undo();
        else if (key === 'y' || (key === 'z' && e.shiftKey)) store.redo();
        else return;
        e.preventDefault();
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case '+':
        case '=':
          store.zoomBy(ZOOM_STEP);
          break;
        case '-':
        case '_':
          store.zoomBy(1 / ZOOM_STEP);
          break;
        case 'f':
        case 'F':
          store.requestFit();
          break;
        case 'Escape':
          if (store.pendingDeleteId) store.cancelPendingDelete();
          else if (store.maximizedView) store.restoreLayout();
          else if (store.dragMode !== 'off') store.setDragMode('off');
          else store.select(null);
          break;
        // Mac keyboards label Backspace "delete" and mostly have no Delete key at all.
        case 'Delete':
        case 'Backspace':
          // Only while a drag mode is on: that is when a sensor is the thing being worked on,
          // rather than the layout as a whole.
          if (store.dragMode === 'off' || !store.selectedId || store.pendingDeleteId) return;
          store.requestDeleteSensor(store.selectedId);
          break;
        default:
          return;
      }
      e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
