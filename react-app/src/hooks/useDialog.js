import { useEffect } from 'react';

/**
 * Keyboard and focus behaviour for a modal dialog.
 *
 * Covers the three things the sign-in, sign-up, profile and story-options
 * modals were all missing:
 *
 *  - WCAG 2.1.2 (No Keyboard Trap) / 2.4.3 (Focus Order): focus moves into the
 *    dialog when it opens and cycles inside it, so Tab cannot wander into the
 *    page behind an open modal.
 *  - WCAG 2.1.1 (Keyboard): Escape closes it. Previously the only way out was a
 *    mouse click on the X or outside the panel.
 *  - WCAG 2.4.3: focus returns to whatever opened the dialog, so a keyboard
 *    user is put back where they were rather than at the top of the document.
 *
 * @param {object} ref       ref on the dialog element
 * @param {function} onClose called for Escape
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function useDialog(ref, onClose) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const previouslyFocused = document.activeElement;

    const focusable = () =>
      Array.from(node.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );

    // Move focus in. Prefer the first control; fall back to the dialog itself.
    const first = focusable()[0];
    if (first) {
      first.focus();
    } else {
      node.setAttribute('tabindex', '-1');
      node.focus();
    }

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (onClose) onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusable();
      if (!items.length) return;

      const firstItem = items[0];
      const lastItem = items[items.length - 1];

      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };

    node.addEventListener('keydown', onKeyDown);

    return () => {
      node.removeEventListener('keydown', onKeyDown);
      // Only restore if focus is still inside the dialog being torn down —
      // otherwise the user has already moved on deliberately.
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        if (!document.activeElement || node.contains(document.activeElement) || document.activeElement === document.body) {
          previouslyFocused.focus();
        }
      }
    };
  }, [ref, onClose]);
}
