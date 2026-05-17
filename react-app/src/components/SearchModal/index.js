import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import './SearchModal.css';

const RECENT_KEY = 'shmedium_recent_searches';
const MAX_RECENT = 8;

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function hlText(text, q) {
  if (!text) return '';
  const escaped = escHtml(text);
  if (!q) return escaped;
  const terms = [...new Set(q.trim().split(/\s+/).filter(Boolean))]
    .sort((a, b) => b.length - a.length);
  if (!terms.length) return escaped;
  const pattern = new RegExp(
    '(' + terms.map((t) => escHtml(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')',
    'gi'
  );
  return escaped.replace(pattern, '<mark>$1</mark>');
}

function loadRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
  catch { return []; }
}

function saveRecent(q) {
  const prev = loadRecent().filter((r) => r !== q);
  localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)));
}

function clearRecent() {
  localStorage.removeItem(RECENT_KEY);
}

export default function SearchModal({ onClose }) {
  const history = useHistory();
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const listRef  = useRef(null);

  const [query, setQuery]           = useState('');
  const [suggestions, setSuggestions] = useState({ stories: [], authors: [], tags: [] });
  const [loading, setLoading]       = useState(false);
  const [recent, setRecent]         = useState(loadRecent);
  const [trending, setTrending]     = useState([]);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);

  // Auto-focus on mount + fetch trending
  useEffect(() => {
    inputRef.current?.focus();
    fetch('/api/search/popular')
      .then((r) => r.ok ? r.json() : { queries: [] })
      .then((d) => setTrending((d.queries || []).map((q) => q.query).slice(0, 6)));
  }, []);

  // Escape to close
  useEffect(() => {
    const handle = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  // Debounced fetch
  const debouncedFetch = useCallback((q) => {
    clearTimeout(timerRef.current);
    if (!q || q.length < 2) {
      setSuggestions({ stories: [], authors: [], tags: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          setSuggestions(await res.json());
        }
      } finally {
        setLoading(false);
      }
    }, 250);
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setHighlightedIdx(-1);
    debouncedFetch(val);
  };

  const commitSearch = (q) => {
    if (!q || !q.trim()) return;
    saveRecent(q.trim());
    setRecent(loadRecent());
    onClose();
    history.push(`/search?q=${encodeURIComponent(q.trim())}&type=stories`);
  };

  // Build flat list for keyboard nav
  const hasSuggestions =
    suggestions.stories.length > 0 ||
    suggestions.authors.length > 0 ||
    suggestions.tags.length > 0;

  const flatItems = hasSuggestions
    ? [
        ...suggestions.stories.map((s) => ({ ...s, _kind: 'story'  })),
        ...suggestions.authors.map((a) => ({ ...a, _kind: 'author' })),
        ...suggestions.tags.map((t)    => ({ ...t, _kind: 'tag'    })),
      ]
    : [];

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIdx < 0 || !listRef.current) return;
    const el = listRef.current.querySelector('[data-highlighted="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIdx]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIdx >= 0 && flatItems[highlightedIdx]) {
        const item = flatItems[highlightedIdx];
        if (item._kind === 'story')  commitSearch(item.title);
        else if (item._kind === 'author') commitSearch(item.name);
        else commitSearch(item.tag);
      } else {
        commitSearch(query);
      }
    }
  };

  return (
    <div className="sm-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sm-panel" role="dialog" aria-modal="true" aria-label="Search">
        {/* Input row */}
        <div className="sm-input-row">
          <svg className="sm-search-icon" viewBox="0 0 20 20" fill="none">
            <circle cx="8.5" cy="8.5" r="5.75" stroke="#999" strokeWidth="1.5"/>
            <path d="M13 13l3.5 3.5" stroke="#999" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            className="sm-input"
            type="search"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Search stories, authors, tags…"
            autoComplete="off"
          />
          {loading && <div className="sm-spinner" />}
          <button className="sm-close-btn" onClick={onClose} aria-label="Close search">✕</button>
        </div>

        {/* Body */}
        <div className="sm-body" ref={listRef}>

          {/* Recent searches (shown when input is blank) */}
          {!query && recent.length > 0 && (
            <div className="sm-section">
              <div className="sm-section-header">
                <span className="sm-section-label">Recent</span>
                <button
                  className="sm-clear-btn"
                  onClick={() => { clearRecent(); setRecent([]); }}
                >
                  Clear
                </button>
              </div>
              {recent.map((r) => (
                <div
                  key={r}
                  className="sm-item"
                  onMouseDown={() => commitSearch(r)}
                >
                  <svg className="sm-recent-icon" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="#bbb" strokeWidth="1.2"/>
                    <path d="M8 5v3l2 1.5" stroke="#bbb" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  <span className="sm-item-title">{r}</span>
                </div>
              ))}
            </div>
          )}

          {/* Trending searches (shown when blank + no recents) */}
          {!query && recent.length === 0 && trending.length > 0 && (
            <div className="sm-section">
              <div className="sm-section-label">Trending</div>
              <div className="sm-tags-row">
                {trending.map((t) => (
                  <span
                    key={t}
                    className="sm-tag"
                    onMouseDown={() => commitSearch(t)}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {hasSuggestions && (
            <>
              {suggestions.stories.length > 0 && (
                <div className="sm-section">
                  <div className="sm-section-label">Stories</div>
                  {suggestions.stories.map((s) => {
                    const idx = flatItems.findIndex((x) => x._kind === 'story' && x.id === s.id);
                    return (
                      <div
                        key={s.id}
                        className={`sm-item${idx === highlightedIdx ? ' sm-highlighted' : ''}`}
                        data-highlighted={idx === highlightedIdx ? 'true' : undefined}
                        onMouseDown={() => commitSearch(s.title)}
                      >
                        <span className="sm-item-title" dangerouslySetInnerHTML={{ __html: hlText(s.title, query) }} />
                        <span className="sm-item-meta">{s.authorName}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {suggestions.authors.length > 0 && (
                <div className="sm-section">
                  <div className="sm-section-label">Authors</div>
                  {suggestions.authors.map((a) => {
                    const idx = flatItems.findIndex((x) => x._kind === 'author' && x.id === a.id);
                    return (
                      <div
                        key={a.id}
                        className={`sm-item${idx === highlightedIdx ? ' sm-highlighted' : ''}`}
                        data-highlighted={idx === highlightedIdx ? 'true' : undefined}
                        onMouseDown={() => commitSearch(a.name)}
                      >
                        <span className="sm-item-title" dangerouslySetInnerHTML={{ __html: hlText(a.name, query) }} />
                        <span className="sm-item-meta">@{a.username}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {suggestions.tags.length > 0 && (
                <div className="sm-section">
                  <div className="sm-section-label">Tags</div>
                  <div className="sm-tags-row">
                    {suggestions.tags.map((t) => {
                      const idx = flatItems.findIndex((x) => x._kind === 'tag' && x.id === t.id);
                      return (
                        <span
                          key={t.id}
                          className={`sm-tag${idx === highlightedIdx ? ' sm-highlighted' : ''}`}
                          data-highlighted={idx === highlightedIdx ? 'true' : undefined}
                          onMouseDown={() => commitSearch(t.tag)}
                          dangerouslySetInnerHTML={{ __html: hlText(t.tag, query) }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* See all footer */}
              <div className="sm-footer" onMouseDown={() => commitSearch(query)}>
                See all results for "<strong>{query}</strong>" →
              </div>
            </>
          )}

          {/* No results hint */}
          {query.length >= 2 && !loading && !hasSuggestions && (
            <div className="sm-empty">
              No results for "<strong>{query}</strong>".
              <button className="sm-see-all-btn" onMouseDown={() => commitSearch(query)}>
                Search all of Shmedium →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
