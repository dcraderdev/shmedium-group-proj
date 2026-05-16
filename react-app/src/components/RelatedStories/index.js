import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import './RelatedStories.css';

const StoryCard = ({ story }) => {
  const history = useHistory();
  const author = story.authorInfo;

  return (
    <button
      className="related-card"
      onClick={() => history.push(`/story/${story.id}`)}
    >
      <div className="related-card-meta">
        {author?.profileImage && (
          <img src={author.profileImage} alt={author.firstName} className="related-card-avatar" />
        )}
        <span className="related-card-author">
          {author?.firstName} {author?.lastName}
        </span>
      </div>
      <h4 className="related-card-title">{story.title}</h4>
      <p className="related-card-intro">{story.slicedIntro}</p>
      <span className="related-card-time">{story.timeToRead} min read</span>
    </button>
  );
};

const RelatedStories = ({ storyId, authorName }) => {
  const [related, setRelated] = useState(null);

  useEffect(() => {
    if (!storyId) return;
    fetch(`/api/story/${storyId}/related`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setRelated(data))
      .catch(() => {});
  }, [storyId]);

  if (!related) return null;
  if (!related.byAuthor.length && !related.byTag.length) return null;

  return (
    <div className="related-stories">
      {related.byAuthor.length > 0 && (
        <section className="related-rail">
          <h3 className="related-rail-heading">More from {authorName}</h3>
          <div className="related-rail-cards">
            {related.byAuthor.map((s) => (
              <StoryCard key={s.id} story={s} />
            ))}
          </div>
        </section>
      )}

      {related.byTag.length > 0 && (
        <section className="related-rail">
          <h3 className="related-rail-heading">Related stories</h3>
          <div className="related-rail-cards">
            {related.byTag.map((s) => (
              <StoryCard key={s.id} story={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default RelatedStories;
