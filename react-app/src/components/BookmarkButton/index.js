import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addBookmark, removeBookmark } from '../../store/bookmark';
import './BookmarkButton.css';

const BookmarkButton = ({ storyId, initialHasBookmarked, initialCount, user }) => {
  const dispatch = useDispatch();
  const bookmarkState = useSelector((state) => state.bookmark[storyId]);

  const hasBookmarked = bookmarkState ? bookmarkState.hasBookmarked : (initialHasBookmarked || false);
  const count = bookmarkState ? bookmarkState.bookmarkCount : (initialCount || 0);

  const handleClick = async () => {
    if (!user) return;
    if (hasBookmarked) {
      await dispatch(removeBookmark(storyId));
    } else {
      await dispatch(addBookmark(storyId));
    }
  };

  return (
    <button
      className={`bookmark-btn${hasBookmarked ? ' bookmark-btn--active' : ''}`}
      onClick={handleClick}
      title={hasBookmarked ? 'Remove bookmark' : 'Bookmark this story'}
      disabled={!user}
    >
      <svg
        viewBox="0 0 24 24"
        fill={hasBookmarked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        width="20"
        height="20"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
      </svg>
      {count > 0 && <span className="bookmark-count">{count}</span>}
    </button>
  );
};

export default BookmarkButton;
