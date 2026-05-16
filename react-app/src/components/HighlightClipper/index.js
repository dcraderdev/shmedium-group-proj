import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { clipHighlight, fetchHighlights } from '../../store/highlight';
import './HighlightClipper.css';

const HighlightClipper = ({ storyId, contentRef, user, contentVersion }) => {
  const dispatch = useDispatch();
  const highlights = useSelector((state) => state.highlight[storyId] || []);

  const [tooltip, setTooltip] = useState(null); // { x, y, text } — viewport coords for fixed pos
  const [feedback, setFeedback] = useState('');  // 'clipped' | 'already' | ''
  const tooltipRef = useRef(null);

  useEffect(() => {
    dispatch(fetchHighlights(storyId));
  }, [storyId, dispatch]);

  // Re-apply highlight marks whenever highlights data changes OR article content re-renders
  useEffect(() => {
    if (!contentRef?.current || !highlights.length) return;
    // Small delay so React finishes the DOM update
    const id = setTimeout(() => {
      if (contentRef.current) applyHighlightMarks(contentRef.current, highlights);
    }, 50);
    return () => clearTimeout(id);
  }, [highlights, contentRef, contentVersion]);

  const applyHighlightMarks = (container, highlightList) => {
    // Remove stale marks
    container.querySelectorAll('mark.clip-mark').forEach((m) => {
      if (m.parentNode) m.replaceWith(document.createTextNode(m.textContent));
    });

    if (!highlightList.length) return;

    highlightList.forEach(({ text, count }) => {
      if (!text) return;
      // Re-collect text nodes each iteration — DOM changes from prior pass
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
      const nodes = [];
      let n;
      while ((n = walker.nextNode())) nodes.push(n);

      for (const tn of nodes) {
        if (!tn.parentNode) continue; // already removed by a previous iteration
        const idx = tn.textContent.indexOf(text);
        if (idx === -1) continue;

        const before = tn.textContent.slice(0, idx);
        const after = tn.textContent.slice(idx + text.length);
        const mark = document.createElement('mark');
        mark.className = 'clip-mark';
        mark.dataset.count = count;
        mark.title = `${count} reader${count !== 1 ? 's' : ''} clipped this`;
        mark.textContent = text;

        const parent = tn.parentNode;
        parent.insertBefore(document.createTextNode(before), tn);
        parent.insertBefore(mark, tn);
        parent.insertBefore(document.createTextNode(after), tn);
        parent.removeChild(tn);
        break; // one mark per highlight per pass to avoid overlaps
      }
    });
  };

  const handleMouseUp = useCallback(() => {
    if (!user) return;
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || text.length < 5 || text.length > 1000) {
      setTooltip(null);
      return;
    }
    if (!contentRef?.current?.contains(sel.anchorNode)) {
      setTooltip(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    // Use viewport coords (position: fixed)
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 52,
      text,
    });
    setFeedback('');
  }, [user, contentRef]);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  // Dismiss on outside click or scroll
  useEffect(() => {
    const onDown = (e) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target)) {
        setTooltip(null);
      }
    };
    const onScroll = () => setTooltip(null);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const handleClip = async () => {
    if (!tooltip) return;
    const result = await dispatch(clipHighlight(storyId, tooltip.text));
    if (result.ok) {
      setFeedback('clipped');
    } else if (result.error === 'Already clipped') {
      setFeedback('already');
    }
    window.getSelection()?.removeAllRanges();
    setTimeout(() => setTooltip(null), 900);
  };

  return (
    <>
      {tooltip && (
        <div
          ref={tooltipRef}
          className={`clip-tooltip${feedback ? ` clip-tooltip--${feedback}` : ''}`}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {!feedback && (
            <button className="clip-tooltip-btn" onClick={handleClip}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
              </svg>
              Clip
            </button>
          )}
          {feedback === 'clipped' && <span className="clip-tooltip-fb">Clipped ✓</span>}
          {feedback === 'already' && <span className="clip-tooltip-fb">Already clipped</span>}
        </div>
      )}
    </>
  );
};

export default HighlightClipper;
