import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import './StoryTileTwo.css';
import * as sessionActions from '../../store/session';

const StoryTileTwo = ({ story, titleHtml, hideIntro, featured }) => {
  const history = useHistory();
  const dispatch = useDispatch();
  const [date, setDate] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [thumbnailVariants, setThumbnailVariants] = useState(null);
  const [name, setName] = useState('');

  useEffect(() => {
    if (!story) return;

    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const d = new Date(story.createdAt);
    setDate(`${months[d.getMonth()]} ${d.getDate()}`);

    if (story.images && story.images.length) {
      setThumbnail(story.images[0].url);
      setThumbnailVariants(story.images[0].variants || null);
    } else {
      setThumbnail('https://miro.medium.com/v2/resize:fit:1200/1*jfdwtvU6V6g99q3G7gq7dQ.png');
      setThumbnailVariants(null);
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

  const navToTag = (tag) => {
    dispatch(sessionActions.search(tag));
    dispatch(sessionActions.setFeed(tag));
    dispatch(sessionActions.setSubFeed('taggedStories'));
    history.push('/home');
  };

  if (!story) return null;

  const tags = story.tags ? story.tags.slice(0, 2) : [];

  if (featured) {
    return (
      <article className="st2-card st2-featured" onClick={() => history.push(`/story/${story.id}`)}>
        <div className="st2-featured-image-wrap">
          {thumbnailVariants ? (
            <picture>
              <source
                type="image/webp"
                srcSet={`${thumbnailVariants.thumbnail.webp} 400w, ${thumbnailVariants.card.webp} 800w`}
                sizes="(max-width: 600px) 400px, 800px"
              />
              <img
                src={thumbnailVariants.card.jpeg}
                srcSet={`${thumbnailVariants.thumbnail.jpeg} 400w, ${thumbnailVariants.card.jpeg} 800w`}
                sizes="(max-width: 600px) 400px, 800px"
                alt="story thumbnail"
                loading="lazy"
                decoding="async"
              />
            </picture>
          ) : (
            <img src={thumbnail} alt="story thumbnail" loading="lazy" decoding="async" />
          )}
        </div>

        <div className="st2-body">
          <div className="st2-byline" onClick={(e) => { e.stopPropagation(); navToFeed(name, 'authors'); }}>
            {story.authorInfo?.profileImage && (
              <img
                className="st2-avatar"
                src={story.authorInfo.profileImage}
                alt="author"
                loading="lazy"
                decoding="async"
              />
            )}
            <span className="st2-author-name">{name}</span>
            <span className="st2-dot" aria-hidden="true">·</span>
            <span className="st2-meta">{story.timeToRead} min read</span>
            <span className="st2-dot" aria-hidden="true">·</span>
            <span className="st2-meta">{date}</span>
          </div>

          <h2 className="st2-title st2-title-featured">
            {titleHtml
              ? <span dangerouslySetInnerHTML={{ __html: titleHtml }} />
              : story.title}
          </h2>

          {!hideIntro && story.slicedIntro && (
            <p className="st2-excerpt">{story.slicedIntro}</p>
          )}

          {tags.length > 0 && (
            <div className="st2-tags" onClick={(e) => e.stopPropagation()}>
              {tags.map((t) => (
                <button key={t.id} className="st2-tag-pill" onClick={() => navToTag(t.tag)}>
                  {t.tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="st2-card" onClick={() => history.push(`/story/${story.id}`)}>
      <div className="st2-body">
        <div className="st2-byline" onClick={(e) => { e.stopPropagation(); navToFeed(name, 'authors'); }}>
          {story.authorInfo?.profileImage && (
            <img
              className="st2-avatar"
              src={story.authorInfo.profileImage}
              alt="author"
              loading="lazy"
              decoding="async"
            />
          )}
          <span className="st2-author-name">{name}</span>
          <span className="st2-dot" aria-hidden="true">·</span>
          <span className="st2-meta">{story.timeToRead} min read</span>
          <span className="st2-dot" aria-hidden="true">·</span>
          <span className="st2-meta">{date}</span>
        </div>

        <h2 className="st2-title">
          {titleHtml
            ? <span dangerouslySetInnerHTML={{ __html: titleHtml }} />
            : story.title}
        </h2>

        {!hideIntro && story.slicedIntro && (
          <p className="st2-excerpt">{story.slicedIntro}</p>
        )}

        {tags.length > 0 && (
          <div className="st2-tags" onClick={(e) => e.stopPropagation()}>
            {tags.map((t) => (
              <button key={t.id} className="st2-tag-pill" onClick={() => navToTag(t.tag)}>
                {t.tag}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="st2-thumb-wrap" onClick={(e) => e.stopPropagation()}>
        {thumbnailVariants ? (
          <picture>
            <source
              type="image/webp"
              srcSet={`${thumbnailVariants.thumbnail.webp} 400w, ${thumbnailVariants.card.webp} 800w`}
              sizes="160px"
            />
            <img
              src={thumbnailVariants.card.jpeg}
              srcSet={`${thumbnailVariants.thumbnail.jpeg} 400w, ${thumbnailVariants.card.jpeg} 800w`}
              sizes="160px"
              alt="story thumbnail"
              loading="lazy"
              decoding="async"
              onClick={() => history.push(`/story/${story.id}`)}
            />
          </picture>
        ) : (
          <img
            src={thumbnail}
            alt="story thumbnail"
            loading="lazy"
            decoding="async"
            onClick={() => history.push(`/story/${story.id}`)}
          />
        )}
      </div>
    </article>
  );
};

export default StoryTileTwo;
