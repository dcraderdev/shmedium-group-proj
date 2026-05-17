import React, { useEffect, useContext, useState, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';

import './StoryFeed.css';
import { WindowContext } from '../../context/WindowContext';
import * as sessionActions from '../../store/session';
import * as storyActions from '../../store/story';
import StoryTileTwo from '../StoryTileTwo';
import AuthorTile from '../AuthorTile';
import StoryTileFourSkeleton from '../StoryTileFourSkeleton';
import StoryTileTwoSkeleton from '../StoryTileTwoSkeleton';
import magnifyGlass from '../../public/magnify-glass.svg';

const BATCH = 10;

const EMPTY_MESSAGES = {
  following: {
    title: 'No stories from people you follow yet',
    body: "Follow authors you love and their latest stories will appear here.",
    cta: 'Discover authors',
    ctaFeed: 'for you',
  },
  'by you': {
    title: "You haven't published anything yet",
    body: "Every great writer starts somewhere. Write your first story — it's free.",
    cta: 'Start writing',
    ctaRoute: '/write',
  },
  default: {
    title: 'Nothing here yet',
    body: 'Try a different topic, or check back soon for new stories.',
    cta: 'Browse all stories',
    ctaFeed: 'for you',
  },
};

const StoryFeed = () => {
  const dispatch = useDispatch();
  const history = useHistory();
  const stories = useSelector((state) => state.story.stories);
  const userStories = useSelector((state) => state.session.userStories);
  const loaded = useSelector((state) => state.story.loaded);
  const subscribedStories = useSelector((state) => state.session.subscribedStories);
  const searchResults = useSelector((state) => state.session.search);
  const currentFeed = useSelector((state) => state.session.currentFeed);
  const subFeed = useSelector((state) => state.session.subFeed);

  const { searchInputRef } = useContext(WindowContext);

  const [feedContent, setFeedContent] = useState(null);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [displayCount, setDisplayCount] = useState(BATCH);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const sentinelRef = useRef(null);

  // Reset display count when feed changes
  useEffect(() => {
    setDisplayCount(BATCH);
  }, [currentFeed, subFeed]);

  // Build feedContent from redux state
  useEffect(() => {
    const updateFeedContent = () => {
      if (currentFeed === 'for you') {
        dispatch(sessionActions.setSubFeed(null));
        setFeedContent(stories);
      } else if (currentFeed === 'by you') {
        dispatch(sessionActions.setSubFeed(null));
        setFeedContent(userStories);
      } else if (currentFeed === 'following') {
        dispatch(sessionActions.setSubFeed(null));
        setFeedContent(subscribedStories);
      } else if (searchResults[currentFeed] && subFeed) {
        setFeedContent(searchResults[currentFeed][subFeed]);
      }
    };

    if (currentFeed && searchResults[currentFeed]) {
      setShowSubMenu(true);
    }

    if (currentFeed === 'for you' || currentFeed === 'by you' || currentFeed === 'following') {
      setShowSubMenu(false);
    }

    updateFeedContent();
  }, [currentFeed, subFeed, searchResults, stories, userStories, subscribedStories, dispatch]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !feedContent || displayCount >= feedContent.length || isLoadingMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setDisplayCount(c => c + BATCH);
            setIsLoadingMore(false);
          }, 450);
        }
      },
      { rootMargin: '200px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [feedContent, displayCount, isLoadingMore]);

  const handleSelectFeed = (feed) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    dispatch(sessionActions.setFeed(feed));
    dispatch(sessionActions.setSubFeed('stories'));
  };

  const handleSelectSubFeed = (sf) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    dispatch(sessionActions.setSubFeed(sf));
  };

  const handleRemoveSearch = (e, searchQuery) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch(sessionActions.setFeed('for you'));
    dispatch(sessionActions.removeSearch(searchQuery));
  };

  const emptyMeta = EMPTY_MESSAGES[currentFeed] || EMPTY_MESSAGES.default;
  const handleEmptyCta = () => {
    if (emptyMeta.ctaRoute) {
      history.push(emptyMeta.ctaRoute);
    } else if (emptyMeta.ctaFeed) {
      dispatch(sessionActions.setFeed(emptyMeta.ctaFeed));
      dispatch(sessionActions.setSubFeed('stories'));
    }
  };

  const isStoriesEmpty = loaded && subFeed !== 'authors' && currentFeed && feedContent && feedContent.length === 0;
  const hasStories = loaded && subFeed !== 'authors' && currentFeed && feedContent && feedContent.length > 0;
  const visibleContent = feedContent ? feedContent.slice(0, displayCount) : null;
  const hasMore = feedContent && displayCount < feedContent.length;

  return (
    <div className="storyfeed-container">


      <nav className="feed-nav flexcenter">
        <div className="feed-select-container">
          <div
            className="feed-select small memo-text flexcenter"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              searchInputRef.current.focus();
            }}
          >
            <div className="add-container flexcenter">
              <img src={magnifyGlass} alt="search" />
            </div>
          </div>

          <div
            className={`feed-select med memo-text flexcenter ${currentFeed === 'for you' ? 'selected' : ''}`}
            onClick={() => handleSelectFeed('for you')}
          >
            For you
          </div>

          <div
            className={`feed-select med memo-text flexcenter ${currentFeed === 'by you' ? 'selected' : ''}`}
            onClick={() => {
              handleSelectFeed('by you');
              dispatch(storyActions.getUserStories());
            }}
          >
            By you
          </div>

          <div
            className={`feed-select large memo-text flexcenter ${currentFeed === 'following' ? 'selected' : ''}`}
            onClick={() => {
              handleSelectFeed('following');
              dispatch(storyActions.getSubscribedStories());
            }}
          >
            Following
          </div>

          {searchResults && Object.keys(searchResults).map((searchQuery, i) => (
            <div key={i}>
              <div
                className={`feed-select dyna memo-text flexcenter ${currentFeed === searchQuery ? 'selected' : ''}`}
                onClick={() => handleSelectFeed(searchQuery)}
              >
                <div className="search-close-tab" onClick={(e) => handleRemoveSearch(e, searchQuery)}>×</div>
                {searchQuery}
              </div>
            </div>
          ))}
        </div>
      </nav>


      <div className={`feed-header ${showSubMenu ? 'extended' : 'hidden'}`}>
        <nav className="search-nav flexcenter">
          <div className="feed-select-container">
            <div
              className={`feed-select med memo-text flexcenter ${subFeed === 'stories' ? 'selected' : ''}`}
              onClick={() => handleSelectSubFeed('stories')}
            >
              Stories
            </div>
            <div
              className={`feed-select large memo-text flexcenter ${subFeed === 'authors' ? 'selected' : ''}`}
              onClick={() => handleSelectSubFeed('authors')}
            >
              Authors
            </div>
            <div
              className={`feed-select large memo-text flexcenter ${subFeed === 'taggedStories' ? 'selected' : ''}`}
              onClick={() => handleSelectSubFeed('taggedStories')}
            >
              Tags
            </div>
          </div>
        </nav>
      </div>

      {/* Loading skeletons */}
      {!loaded && (
        <div>
          {Array.from({ length: 6 }).map((_, i) => (
            <StoryTileFourSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Authors tab */}
      {loaded && subFeed === 'authors' && currentFeed && visibleContent &&
        visibleContent.map((author) => <AuthorTile key={author.id} author={author} />)
      }

      {/* Stories list with featured first card */}
      {hasStories && (
        <div className="feed-stories-list">
          {visibleContent[0] && (
            <>
              <div className="feed-section-label">Featured</div>
              <StoryTileTwo key={visibleContent[0].id || 0} story={visibleContent[0]} featured />
              {visibleContent.length > 1 && (
                <div className="feed-section-label feed-section-label--more">
                  More stories
                </div>
              )}
            </>
          )}
          {visibleContent.slice(1).map((story, i) => (
            <StoryTileTwo key={story.id || i + 1} story={story} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {isStoriesEmpty && (
        <div className="feed-empty-state">
          <div className="feed-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </div>
          <h3 className="feed-empty-title">{emptyMeta.title}</h3>
          <p className="feed-empty-body">{emptyMeta.body}</p>
          <button className="feed-empty-cta" onClick={handleEmptyCta}>
            {emptyMeta.cta}
          </button>
        </div>
      )}

      {/* Infinite scroll: loading skeletons */}
      {isLoadingMore && (
        <>
          <StoryTileTwoSkeleton />
          <StoryTileTwoSkeleton />
        </>
      )}

      {/* Sentinel triggers next batch */}
      {loaded && hasMore && !isLoadingMore && (
        <div ref={sentinelRef} style={{ height: 1, marginBottom: 40 }} />
      )}

    </div>
  );
};

export default StoryFeed;
