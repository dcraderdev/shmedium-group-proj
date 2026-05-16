import React, { useState, useEffect, useRef } from 'react';
import './TableOfContents.css';

const TableOfContents = ({ items, contentRef }) => {
  const [activeId, setActiveId] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const observerRef = useRef(null);

  useEffect(() => {
    if (!items.length) return;

    // Track which headings are currently in the viewport band
    const visibleSet = new Set();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) visibleSet.add(e.target.id);
          else visibleSet.delete(e.target.id);
        });
        // Pick the first item (document order) that's currently visible
        const first = items.find(({ id }) => visibleSet.has(id));
        if (first) setActiveId(first.id);
      },
      { rootMargin: '-10% 0px -80% 0px', threshold: 0 }
    );

    items.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current.observe(el);
    });

    return () => {
      observerRef.current && observerRef.current.disconnect();
      visibleSet.clear();
    };
  }, [items]);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setMobileOpen(false);
  };

  if (!items.length) return null;

  return (
    <>
      {/* Desktop right rail */}
      <nav className="toc-rail" aria-label="Table of contents">
        <p className="toc-heading">In this article</p>
        <ul className="toc-list">
          {items.map((item) => (
            <li
              key={item.id}
              className={`toc-item toc-level-${item.level}${activeId === item.id ? ' toc-active' : ''}`}
            >
              <button className="toc-link" onClick={() => scrollTo(item.id)}>
                {item.text}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile drawer toggle */}
      <div className="toc-mobile">
        <button
          className="toc-mobile-toggle"
          onClick={() => setMobileOpen((o) => !o)}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? '▲ Hide contents' : '▼ Jump to section'}
        </button>
        {mobileOpen && (
          <ul className="toc-mobile-list">
            {items.map((item) => (
              <li key={item.id} className={`toc-item toc-level-${item.level}`}>
                <button className="toc-link" onClick={() => scrollTo(item.id)}>
                  {item.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
};

export default TableOfContents;
