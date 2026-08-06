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
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      const store = useStore.getState();
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
          if (store.dragMode !== 'off') store.setDragMode('off');
          else store.select(null);
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
