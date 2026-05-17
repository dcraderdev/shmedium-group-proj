import React from 'react';
import './StoryTileTwoSkeleton.css';

const StoryTileTwoSkeleton = () => {
  return (
    <div className="story-tile-two-skeleton">
      <div className="skt2-content">
        <div className="skt2-author-row">
          <div className="skt2-avatar shimmer" />
          <div className="skt2-author-name shimmer" />
        </div>
        <div className="skt2-title shimmer" />
        <div className="skt2-title-short shimmer" />
        <div className="skt2-body shimmer" />
        <div className="skt2-body skt2-body--short shimmer" />
        <div className="skt2-meta shimmer" />
      </div>
      <div className="skt2-image shimmer" />
    </div>
  );
};

export default StoryTileTwoSkeleton;
