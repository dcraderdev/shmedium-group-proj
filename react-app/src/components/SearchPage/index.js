import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useHistory } from 'react-router-dom';
import './SearchPage.css';
import StoryTileTwo from '../StoryTileTwo';
import AuthorTile from '../AuthorTile';

// ── Pagination helper ─────────────────────────────────────────────────────────

function pagesToShow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current]);
  for (let d = 1; d <= 2; d++) {
    if (current - d >= 1) pages.add(current - d);
    if (current + d <= total) pages.add(current + d);
  }
  return [...pages].sort((a, b) => a - b);
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-author-row">
        <div className="skeleton-avatar" />
        <div className="skeleton-line short" />
      </div>
      <div className="skeleton-line long" style={{ marginBottom: 8 }} />
      <div className="skeleton-line medium" />
      <div className="skeleton-line short" style={{ marginTop: 12 }} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const SearchPage = () => {
  const location = useLocation();
  const history = useHistory();
  const params = new URLSearchParams(location.search);
  const query = params.get('q') || '';
  const type = params.get('type') || 'stories';
  const page = Math.max(1, parseInt(params.get('page') || '1', 10));

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [popular, setPopular] = useState([]);
  const listRef = useRef(null);

  // Fetch popular searches when there is no query
  useEffect(() => {
    if (query) return;
    fetch('/api/search/popular')
      .then((r) => r.ok ? r.json() : { queries: [] })
      .then((d) => setPopular(d.queries || []));
  }, [query]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (!query) { setResults(null); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    const url = `/api/search?q=${encodeURIComponent(query)}&type=${type}&page=${page}`;
    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setResults(data))
      .catch((err) => { if (err.name !== 'AbortError') console.error(err); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [query, type, page]);

  // Keyboard navigation in the result list
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const rows = () => el.querySelectorAll('[data-result-row]');
    const handle = (e) => {
      const all = rows();
      const idx = Array.from(all).indexOf(document.activeElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        (all[idx + 1] || all[0])?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        (all[idx - 1] || all[all.length - 1])?.focus();
      }
    };
    el.addEventListener('keydown', handle);
    return () => el.removeEventListener('keydown', handle);
  }, [results, type]);

  const setType = (t) =>
    history.push(`/search?q=${encodeURIComponent(query)}&type=${t}&page=1`);

  const setPage = (p) => {
    history.push(`/search?q=${encodeURIComponent(query)}&type=${type}&page=${p}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Derived values ──────────────────────────────────────────────────────────

  const totalStories = results?.totalStories ?? 0;
  const totalAuthors = results?.totalAuthors ?? 0;
  const totalTags    = results?.totalTags ?? 0;           // distinct matching tags
  const totalTagged  = results?.totalTaggedStories ?? 0;  // stories bearing those tags

  // The "active" total drives the count label + pagination.
  // For the Tags tab we paginate over tagged stories, not the tag chips themselves.
  const activeTotal =
    type === 'stories' ? totalStories :
    type === 'authors' ? totalAuthors :
    totalTagged;

  const perPage    = results?.perPage ?? 20;
  const totalPages = Math.ceil(activeTotal / perPage);

  const storyItems      = results?.stories      ?? [];
  const authorItems     = results?.authors      ?? [];
  const tagItems        = results?.tags         ?? [];
  const taggedItems     = results?.taggedStories ?? [];

  const relatedTags = tagItems.slice(0, 5);

  const isEmpty = !loading && results && activeTotal === 0 &&
    !(type === 'tags' && tagItems.length > 0); // tags tab: chips alone are enough

  // ── No-query landing ────────────────────────────────────────────────────────

  if (!query) {
    return (
      <div className="search-page">
        <header className="search-header">
          <h1 className="search-query-title">Search Shmedium</h1>
          <p className="search-count">Find stories, authors, and topics.</p>
        </header>
        {popular.length > 0 && (
          <section className="popular-section">
            <p className="popular-label">Trending searches</p>
            <div className="popular-chips">
              {popular.map((p) => (
                <button
                  key={p.query}
                  className="popular-chip"
                  onClick={() =>
                    history.push(`/search?q=${encodeURIComponent(p.query)}&type=stories`)
                  }
                >
                  {p.query}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // ── Results page ────────────────────────────────────────────────────────────

  return (
    <div className="search-page">
      <header className="search-header">
        <h1 className="search-query-title">"{query}"</h1>
        <p className="search-count">
          {loading
            ? 'Searching…'
            : type === 'tags'
              ? totalTagged > 0
                ? `${totalTagged.toLocaleString()} tagged ${totalTagged === 1 ? 'story' : 'stories'} found`
                : totalTags > 0
                  ? `${totalTags.toLocaleString()} matching ${totalTags === 1 ? 'tag' : 'tags'}`
                  : 'No results'
              : activeTotal === 0
                ? 'No results'
                : `${activeTotal.toLocaleString()} ${activeTotal === 1 ? (type === 'stories' ? 'story' : 'author') : type} found`}
        </p>
      </header>

      <nav className="search-filter-pills" aria-label="Filter results by type">
        {[
          { key: 'stories', label: 'Stories', count: totalStories },
          { key: 'authors', label: 'Authors', count: totalAuthors },
          { key: 'tags',    label: 'Tags',    count: totalTags },
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

      {/* Loading skeleton */}
      {loading && (
        <div>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && isEmpty && (
        <div className="search-empty" role="status">
          <p className="empty-message">No {type} found for "{query}".</p>
          {type !== 'stories' && totalStories > 0 && (
            <p className="empty-hint">
              There {totalStories === 1 ? 'is' : 'are'} {totalStories.toLocaleString()}{' '}
              matching{' '}
              <button className="try-link" onClick={() => setType('stories')}>
                {totalStories === 1 ? 'story' : 'stories'}
              </button>
              .
            </p>
          )}
          {type === 'stories' && totalTags > 0 && (
            <p className="empty-hint">
              Try browsing by{' '}
              <button className="try-link" onClick={() => setType('tags')}>
                tags
              </button>
              {' '}— {totalTags} matching.
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

      {/* Results */}
      {!loading && results && (
        <div ref={listRef} className="search-results">

          {/* Stories tab */}
          {type === 'stories' && storyItems.map((story) => (
            <div
              key={story.id}
              className="search-story-item search-result-row"
              tabIndex={0}
              data-result-row
            >
              <StoryTileTwo
                story={story}
                titleHtml={story.titleHighlighted || null}
                hideIntro={!!story.snippet}
              />
              {story.snippet && (
                <div
                  className="search-snippet"
                  dangerouslySetInnerHTML={{ __html: story.snippet }}
                />
              )}
            </div>
          ))}

          {/* Authors tab */}
          {type === 'authors' && authorItems.map((author) => (
            <div
              key={author.id}
              className="search-result-row"
              tabIndex={0}
              data-result-row
            >
              <AuthorTile author={author} />
            </div>
          ))}

          {/* Tags tab: chips then tagged stories */}
          {type === 'tags' && (
            <>
              {tagItems.length > 0 && (
                <div className="search-tags-block">
                  <p className="tags-section-header">Matching tags</p>
                  <div className="search-tags-chips">
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
              {taggedItems.length > 0 && (
                <>
                  <p className="tags-section-header" style={{ marginBottom: 12 }}>
                    Stories with these tags
                  </p>
                  {taggedItems.map((story) => (
                    <div
                      key={story.id}
                      className="search-story-item search-result-row"
                      tabIndex={0}
                      data-result-row
                    >
                      <StoryTileTwo
                        story={story}
                        titleHtml={story.titleHighlighted || null}
                        hideIntro={!!story.snippet}
                      />
                      {story.snippet && (
                        <div
                          className="search-snippet"
                          dangerouslySetInnerHTML={{ __html: story.snippet }}
                        />
                      )}
                    </div>
                  ))}
                </>
              )}
              {tagItems.length === 0 && taggedItems.length === 0 && (
                <div className="search-empty" role="status">
                  <p className="empty-message">No tags found for "{query}".</p>
                  {totalStories > 0 && (
                    <p className="empty-hint">
                      <button className="try-link" onClick={() => setType('stories')}>
                        Browse stories
                      </button>{' '}
                      instead — {totalStories.toLocaleString()} found.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Pagination */}
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
              acc.push(
                <span key={`ell-${p}`} style={{ padding: '0 4px', color: '#999' }}>
                  …
                </span>
              );
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
