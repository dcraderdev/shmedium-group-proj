/**
 * Props that make a non-semantic element behave like a button for keyboard
 * users.
 *
 * The codebase drives a lot of navigation from `<div onClick={...}>` — close
 * buttons, "Create One", tag chips, feed tabs, story tiles. Those are invisible
 * to the keyboard: a div is not focusable and does not fire click on Enter or
 * Space, so none of it could be operated without a mouse (WCAG 2.1.1). axe does
 * not report them either, because without a role there is nothing it can tell
 * is meant to be a control.
 *
 * Prefer a real <button> or <a> in new code. This exists to retrofit the
 * existing ones without restructuring their layout and styling.
 *
 * Do not use it on an element that already contains a button or link — that
 * produces nested interactive content, which is its own failure.
 */
export function clickable(handler) {
  return {
    role: 'button',
    tabIndex: 0,
    onClick: handler,
    onKeyDown: (event) => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
        // Space scrolls the page by default; Enter submits forms.
        event.preventDefault();
        if (handler) handler(event);
      }
    },
  };
}

export default clickable;
