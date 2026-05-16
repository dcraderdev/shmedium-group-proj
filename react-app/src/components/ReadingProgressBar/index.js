import React, { useState, useEffect } from 'react';
import './ReadingProgressBar.css';

const ReadingProgressBar = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const scrolled = document.documentElement.scrollTop;
      const total =
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight;
      setProgress(total > 0 ? (scrolled / total) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="reading-progress-track">
      <div className="reading-progress-fill" style={{ width: `${progress}%` }} />
    </div>
  );
};

export default ReadingProgressBar;
