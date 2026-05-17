import React, { useContext } from 'react';
import './StoryTileFourSkeleton.css';
import { WindowContext } from '../../context/WindowContext';

const StoryTileFourSkeleton = () => {
  const { windowSize } = useContext(WindowContext);
  const isMobileView = windowSize <= 750;

  return (
    <div className={`story-tile-4-skeleton ${isMobileView ? 'small' : ''}`}>
      <div className="skt4-content">
        <div className="skt4-author-row">
          <div className="skt4-avatar shimmer" />
          <div className="skt4-author-name shimmer" />
        </div>
        <div className="skt4-title shimmer" />
        <div className="skt4-title-short shimmer" />
        {!isMobileView && <div className="skt4-body shimmer" />}
        <div className="skt4-meta shimmer" />
      </div>
      <div className={`skt4-image shimmer ${isMobileView ? 'small' : ''}`} />
    </div>
  );
};

export default StoryTileFourSkeleton;
