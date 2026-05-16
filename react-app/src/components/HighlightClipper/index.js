import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { clipHighlight, fetchHighlights } from '../../store/highlight';
import './HighlightClipper.css';

const HighlightClipper = ({ storyId, contentRef, user }) => {
  const dispatch = useDispatch();
  const highlights = useSelector((state) => state.highlight[storyId] || []);

  const [tooltip, setTooltip] = useState(null); // { x, y, text }
  const [clippedIds, setClippedIds] = useState({});
  const tooltipRef = useRef(null);

  useEffect(() => {
    dispatch(fetchHighlights(storyId));
  }, [storyId, dispatch]);

  // Apply background highlights to body text after content renders
  useEffect(() => {
    if (!contentRef?.current || !highlights.length) return;
    applyHighlightMarks(contentRef.current, highlights);
  }, [highlights, contentRef]);

  const applyHighlightMarks = (container, highlightList) => {
    // Remove old marks first
    container.querySelectorAll('mark.clip-mark').forEach((m) => {
      m.replaceWith(document.createTextNode(m.textContent));
    });

    if (!highlightList.length) return;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) textNodes.push(node);

    highlightList.forEach(({ text, count }) => {
      if (!text) return;
      textNodes.forEach((tn) => {
        const idx = tn.textContent.indexOf(text);
        if (idx === -1) return;
        const before = tn.textContent.slice(0, idx);
        const after = tn.textContent.slice(idx + text.length);
        const mark = document.createElement('mark');
        mark.className = 'clip-mark';
        mark.dataset.count = count;
        mark.textContent = text;
        const parent = tn.parentNode;
        parent.insertBefore(document.createTextNode(before), tn);
        parent.insertBefore(mark, tn);
        parent.insertBefore(document.createTextNode(after), tn);
        parent.removeChild(tn);
      });
    });
  };

  const handleMouseUp = useCallback(
    (e) => {
      if (!user) return;
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (!text || text.length < 5) {
        setTooltip(null);
        return;
      }
      if (!contentRef?.current?.contains(sel.anchorNode)) {
        setTooltip(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setTooltip({
        x: rect.left + rect.width / 2 + window.scrollX,
        y: rect.top + window.scrollY - 48,
        text,
      });
    },
    [user, contentRef]
  );

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  // Dismiss tooltip when clicking outside
  useEffect(() => {
    const onDown = (e) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target)) {
        setTooltip(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const handleClip = async () => {
    if (!tooltip) return;
    const result = await dispatch(clipHighlight(storyId, tooltip.text));
    if (result.ok) {
      setClippedIds((prev) => ({ ...prev, [tooltip.text]: result.id }));
    }
    setTooltip(null);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <>
      {tooltip && (
        <div
          ref={tooltipRef}
          className="clip-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <button className="clip-tooltip-btn" onClick={handleClip}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
            </svg>
            Clip
          </button>
        </div>
      )}
    </>
  );
};

export default HighlightClipper;
