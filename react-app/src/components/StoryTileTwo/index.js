import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import './StoryTileTwo.css';
import * as sessionActions from '../../store/session';

const StoryTileTwo = ({ story, titleHtml, hideIntro, featured = false }) => {
  const history = useHistory();
  const dispatch = useDispatch();
  const [date, setDate] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [thumbnailVariants, setThumbnailVariants] = useState(null);
  const [name, setName] = useState('');

  useEffect(() => {
    if (!story) return;

    // Format date properly from ISO string
    if (story.createdAt) {
      try {
        const d = new Date(story.createdAt);
        setDate(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      } catch {
        setDate('');
      }
    }

    if (story.images && !story.images.length) {
      setThumbnail('https://miro.medium.com/v2/resize:fit:1200/1*jfdwtvU6V6g99q3G7gq7dQ.png');
      setThumbnailVariants(null);
    }
    if (story.images && story.images.length) {
      setThumbnail(story.images[0].url);
      setThumbnailVariants(story.images[0].variants || null);
    }

    if (story.authorInfo) {
      setName(`${story.authorInfo.firstName} ${story.authorInfo.lastName}`);
    }
  }, [story]);

  const navToFeed = (search, subFeed) => {
    dispatch(sessionActions.search(search));
    dispatch(sessionActions.setFeed(search));
    dispatch(sessionActions.setSubFeed(subFeed));
    history.push('/home');
  };

  const navToStory = () => history.push(`/story/${story.id}`);
  const navToAuthor = () => navToFeed(`${story?.authorInfo?.firstName} ${story?.authorInfo?.lastName}`, 'authors');
  const navToTag = (tag) => navToFeed(tag, 'taggedStories');

  const tags = story?.tags?.slice(0, 3) || [];

  return (
    <article className={`story-tile-style2 fade-in${featured ? ' featured' : ''}`}>

      {/* ── Content column ── */}
      <div className="style2-content">

        {/* Byline row */}
        <div className="style2-author-container" onClick={navToAuthor}>
          <div className="style2-profile-image">
            {story?.authorInfo?.profileImage && (
              <img
                src={story.authorInfo.profileImage}
                alt={`${name} profile`}
                loading="lazy"
                decoding="async"
              />
            )}
          </div>
          <span className="style2-author-name">{name}</span>
          {story?.timeToRead && (
            <>
              <span className="style2-byline-dot">·</span>
              <span className="style2-read-time">{story.timeToRead} min read</span>
            </>
          )}
          {date && (
            <>
              <span className="style2-byline-dot">·</span>
              <span className="style2-date">{date}</span>
            </>
          )}
        </div>

        {/* Title */}
        <div className="style2-story-title-container" onClick={navToStory}>
          {titleHtml ? (
            <h2
              className="style2-story-title"
              dangerouslySetInnerHTML={{ __html: titleHtml }}
            />
          ) : (
            <h2 className="style2-story-title">{story?.title}</h2>
          )}
        </div>

        {/* Excerpt — always visible */}
        {!hideIntro && story?.slicedIntro && (
          <p className="style2-header-content" onClick={navToStory}>
            {story.slicedIntro}
          </p>
        )}

        {/* Tag pills */}
        {tags.length > 0 && (
          <div className="style2-tags">
            {tags.map((t) => (
              <button
                key={t.id}
                className="style2-tag"
                onClick={(e) => { e.stopPropagation(); navToTag(t.tag); }}
              >
                {t.tag}
              </button>
            ))}
          </div>
        )}

        {/* Footer meta row */}
        <div className="style2-meta-row">
          {story?.commentCount > 0 && (
            <span className="style2-comment-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              {story.commentCount}
            </span>
          )}
        </div>

      </div>

      {/* ── Thumbnail column ── */}
      <div className="style2-story-image" onClick={navToStory} aria-hidden="true">
        {thumbnailVariants ? (
          <picture>
            <source
              type="image/webp"
              srcSet={`${thumbnailVariants.thumbnail.webp} 400w, ${thumbnailVariants.card.webp} 800w`}
              sizes="(max-width: 640px) 100vw, (max-width: 700px) 140px, 200px"
            />
            <img
              src={thumbnailVariants.card.jpeg}
              srcSet={`${thumbnailVariants.thumbnail.jpeg} 400w, ${thumbnailVariants.card.jpeg} 800w`}
              sizes="(max-width: 640px) 100vw, (max-width: 700px) 140px, 200px"
              alt={story?.title || 'Story thumbnail'}
              loading="lazy"
              decoding="async"
            />
          </picture>
        ) : thumbnail ? (
          <img
            src={thumbnail}
            alt={story?.title || 'Story thumbnail'}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="style2-image-placeholder" />
        )}
      </div>

    </article>
  );
};

export default StoryTileTwo;
