import { useState, useEffect } from 'react';
import './StickyAuthorBar.css';

const StickyAuthorBar = ({ author, user, following, onFollow, claps, onClap }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setVisible(false);
  }, [author?.id]);

  if (!author) return null;

  const isOwn = user && user.id === author.id;

  return (
    <div className={`sticky-author-bar${visible ? ' sticky-author-bar--visible' : ''}`}>
      {author.profileImage && (
        <img
          className="sticky-author-avatar"
          src={author.profileImage}
          alt={author.firstName}
          loading="lazy"
        />
      )}
      <span className="sticky-author-name">
        {author.firstName} {author.lastName}
      </span>

      {user && !isOwn && (
        <button
          className={`sticky-author-follow${following ? ' sticky-author-follow--following' : ''}`}
          onClick={onFollow}
        >
          {following ? 'Following' : 'Follow'}
        </button>
      )}

      {!isOwn && (
        <div className="sticky-author-claps">
          <button className="sticky-clap-btn" onClick={onClap} disabled={!user}>
            👏 {claps ?? 0}
          </button>
        </div>
      )}
    </div>
  );
};

export default StickyAuthorBar;
