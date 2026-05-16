import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useHistory } from 'react-router-dom';
import './SearchPage.css';
import StoryTileTwo from '../StoryTileTwo';
import AuthorTile from '../AuthorTile';

const MAX_PAGES_SHOWN = 7;

function pagesToShow(current, total) {
  if (total <= MAX_PAGES_SHOWN) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current]);
  for (let d = 1; d <= 2; d++) {
    if (current - d >= 1) pages.add(current - d);
    if (current + d <= total) pages.add(current + d);
  }
  return [...pages].sort((a, b) => a - b);
}

const SearchPage = () => {
  const location = useLocation();
  const history = useHistory();
  const params = new URLSearchParams(location.search);
  const query = params.get('q') || '';
  const type = params.get('type') || 'stories';
  const page = Math.max(1, parseInt(params.get('page') || '1', 10));

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  const fetchResults = useCallback(async () => {
    if (!query) return;
    setLoading(true);
    try {
      const url = `/api/search/?q=${encodeURIComponent(query)}&type=${type}&page=${page}`;
      const res = await fetch(url);
      const data = await res.json();
      setResults(data);
    } finally {
      setLoading(false);
    }
  }, [query, type, page]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchResults();
  }, [fetchResults]);

  // Keyboard navigation on the result list
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const rows = el.querySelectorAll('[data-result-row]');
    if (!rows.length) return;
    const handle = (e) => {
      const active = document.activeElement;
      const idx = Array.from(rows).indexOf(active);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = rows[idx + 1] || rows[0];
        next && next.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = rows[idx - 1] || rows[rows.length - 1];
        prev && prev.focus();
      }
    };
    el.addEventListener('keydown', handle);
    return () => el.removeEventListener('keydown', handle);
  }, [results, type]);

  const setType = (newType) =>
    history.push(`/search?q=${encodeURIComponent(query)}&type=${newType}&page=1`);

  const setPage = (p) => {
    history.push(`/search?q=${encodeURIComponent(query)}&type=${type}&page=${p}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!query) {
    return (
      <div className="search-page">
        <p className="empty-hint">Enter a search query to find stories, authors, or tags.</p>
      </div>
    );
  }

  const totalStories = results?.totalStories ?? 0;
  const totalAuthors = results?.totalAuthors ?? 0;
  const totalTags = results?.totalTags ?? 0;

  const activeTotal =
    type === 'stories' ? totalStories :
    type === 'authors' ? totalAuthors :
    totalTags;

  const perPage = results?.perPage ?? 20;
  const totalPages = Math.ceil(activeTotal / perPage);

  const storyItems = results?.stories ?? [];
  const authorItems = results?.authors ?? [];
  const tagItems = results?.tags ?? [];
  const taggedStoryItems = results?.taggedStories ?? [];

  const relatedTags = (results?.tags ?? []).slice(0, 5);
  const isEmpty = !loading && results && activeTotal === 0;

  return (
    <div className="search-page">
      <header className="search-header">
        <h1 className="search-query-title">"{query}"</h1>
        <p className="search-count">
          {loading
            ? 'Searching…'
            : `${activeTotal.toLocaleString()} ${type} found`}
        </p>
      </header>

      <nav className="search-filter-pills" aria-label="Filter results by type">
        {[
          { key: 'stories', label: 'Stories', count: totalStories },
          { key: 'authors', label: 'Authors', count: totalAuthors },
          { key: 'tags', label: 'Tags', count: totalTags },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            className={`filter-pill${type === key ? ' active' : ''}`}
            onClick={() => setType(key)}
            aria-pressed={type === key}
          >
            {label}
            {results && (
              <span className="pill-count">{count.toLocaleString()}</span>
            )}
          </button>
        ))}
      </nav>

      {loading && <div className="search-loading" role="status">Searching…</div>}

      {isEmpty && (
        <div className="search-empty" role="status">
          <p className="empty-message">No {type} found for "{query}".</p>
          {type !== 'stories' && (
            <p className="empty-hint">
              Try searching{' '}
              <button className="try-link" onClick={() => setType('stories')}>
                Stories
              </button>{' '}
              instead.
            </p>
          )}
          {type === 'stories' && totalTags > 0 && (
            <p className="empty-hint">
              Try the{' '}
              <button className="try-link" onClick={() => setType('tags')}>
                Tags
              </button>{' '}
              tab — there are {totalTags} matching tags.
            </p>
          )}
          {relatedTags.length > 0 && (
            <div className="related-tags">
              <p className="related-tags-label">Related tags to explore:</p>
              <div className="related-tags-list">
                {relatedTags.map((tag) => (
                  <button
                    key={tag.id}
                    className="related-tag-btn"
                    onClick={() =>
                      history.push(
                        `/search?q=${encodeURIComponent(tag.tag)}&type=stories`
                      )
                    }
                  >
                    {tag.tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && results && (
        <div ref={listRef} className="search-results">
          {type === 'stories' &&
            storyItems.map((story) => (
              <div
                key={story.id}
                className="search-story-item search-result-row"
                tabIndex={0}
                data-result-row
              >
                <StoryTileTwo story={story} />
                {story.snippet && (
                  <div
                    className="search-snippet"
                    dangerouslySetInnerHTML={{ __html: story.snippet }}
                  />
                )}
              </div>
            ))}

          {type === 'authors' &&
            authorItems.map((author) => (
              <div
                key={author.id}
                className="search-result-row"
                tabIndex={0}
                data-result-row
              >
                <AuthorTile author={author} />
              </div>
            ))}

          {type === 'tags' && (
            <>
              {tagItems.length > 0 && (
                <div className="search-tags-grid" style={{ marginBottom: 24 }}>
                  <p className="tags-section-header">Matching tags</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {tagItems.map((tag) => (
                      <button
                        key={tag.id}
                        className="search-tag-chip"
                        onClick={() =>
                          history.push(
                            `/search?q=${encodeURIComponent(tag.tag)}&type=stories`
                          )
                        }
                      >
                        {tag.tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {taggedStoryItems.map((story) => (
                <div
                  key={story.id}
                  className="search-story-item search-result-row"
                  tabIndex={0}
                  data-result-row
                >
                  <StoryTileTwo story={story} />
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {totalPages > 1 && !loading && (
        <nav className="search-pagination" aria-label="Pagination">
          <button
            className="page-btn"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            aria-label="Previous page"
          >
            ← Prev
          </button>

          {pagesToShow(page, totalPages).reduce((acc, p, i, arr) => {
            if (i > 0 && p - arr[i - 1] > 1) {
              acc.push(<span key={`ellipsis-${p}`} style={{ padding: '0 4px', color: '#999' }}>…</span>);
            }
            acc.push(
              <button
                key={p}
                className={`page-btn${p === page ? ' active' : ''}`}
                onClick={() => setPage(p)}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </button>
            );
            return acc;
          }, [])}

          <button
            className="page-btn"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            aria-label="Next page"
          >
            Next →
          </button>
        </nav>
      )}
    </div>
  );
};

export default SearchPage;
