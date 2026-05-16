import React, { useState, useEffect } from 'react';
import './AuthorFollowCTA.css';

const AuthorFollowCTA = ({ author, user, following, onFollow, followedCount }) => {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    const onScroll = () => {
      const total =
        document.documentElement.scrollHeight - document.documentElement.clientHeight;
      setVisible(total > 0 && window.scrollY / total > 0.3);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [dismissed]);

  // Reset dismissed state when story changes
  useEffect(() => {
    setDismissed(false);
    setVisible(false);
  }, [author?.id]);

  if (!author || !user || user.id === author.id) return null;
  if (!visible || dismissed) return null;

  const authorName = `${author.firstName} ${author.lastName}`;

  return (
    <div className="author-cta" role="complementary" aria-label="Follow author">
      <button
        className="author-cta-dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        ✕
      </button>

      <div className="author-cta-body">
        {author.profileImage && (
          <img src={author.profileImage} alt={authorName} className="author-cta-avatar" />
        )}
        <div className="author-cta-info">
          {followedCount > 0 && (
            <p className="author-cta-context">
              Following {followedCount} author{followedCount !== 1 ? 's' : ''}.
            </p>
          )}
          <p className="author-cta-name">{authorName}</p>
          <p className="author-cta-followers">
            {(author.numFollowers || 0).toLocaleString()} follower
            {author.numFollowers !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <button
        className={`author-cta-follow${following ? ' author-cta-follow--following' : ''}`}
        onClick={onFollow}
      >
        {following ? `Following ${author.firstName}` : `Follow ${author.firstName}`}
      </button>
    </div>
  );
};

export default AuthorFollowCTA;
