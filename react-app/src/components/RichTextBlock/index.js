import React, { useRef, useEffect, useState } from 'react';
import './RichTextBlock.css';

export default function RichTextBlock({ initialContent, onChange, placeholder }) {
  const editorRef = useRef(null);
  const [toolbar, setToolbar] = useState(null); // { top, left } | null

  // Populate content once on mount — never re-run (would clobber cursor)
  useEffect(() => {
    if (editorRef.current && initialContent) {
      editorRef.current.innerHTML = initialContent;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const exec = (cmd, value = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    if (onChange) onChange(editorRef.current?.innerHTML || '');
  };

  const handleKeyDown = (e) => {
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'b') { e.preventDefault(); exec('bold'); }
      if (e.key === 'i') { e.preventDefault(); exec('italic'); }
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      exec('insertHTML', '&nbsp;&nbsp;&nbsp;&nbsp;');
    }
  };

  const handleInput = () => {
    if (onChange) onChange(editorRef.current?.innerHTML || '');
  };

  // Floating toolbar — appears above any non-collapsed selection inside this editor
  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setToolbar(null);
        return;
      }
      if (!editorRef.current?.contains(sel.anchorNode)) {
        setToolbar(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const editorRect = editorRef.current.getBoundingClientRect();
      setToolbar({
        top: rect.top - editorRect.top - 48,
        left: rect.left - editorRect.left + rect.width / 2,
      });
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  return (
    <div className="rtb-wrapper">
      {toolbar && (
        <div
          className="rtb-toolbar"
          style={{ top: toolbar.top, left: toolbar.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button type="button" onClick={() => exec('bold')} title="Bold (⌘B)"><b>B</b></button>
          <button type="button" onClick={() => exec('italic')} title="Italic (⌘I)"><i>I</i></button>
          <button type="button" onClick={() => exec('formatBlock', 'h2')} title="Heading 2">H2</button>
          <button type="button" onClick={() => exec('formatBlock', 'h3')} title="Heading 3">H3</button>
          <button type="button" onClick={() => exec('formatBlock', 'blockquote')} title="Blockquote">❝</button>
          <button type="button" onClick={() => exec('formatBlock', 'p')} title="Normal text">¶</button>
        </div>
      )}
      <div
        ref={editorRef}
        className="rtb-editor"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder || 'Tell your story…'}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
      />
    </div>
  );
}
