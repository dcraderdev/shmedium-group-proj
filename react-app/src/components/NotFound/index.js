import React from 'react';
import { useHistory } from 'react-router-dom';
import './NotFound.css';

const NotFound = () => {
  const history = useHistory();

  return (
    <div className="notfound-root">
      <div className="notfound-inner">
        <p className="notfound-number">404</p>
        <h1 className="notfound-title">Page not found</h1>
        <p className="notfound-body">
          The story you're looking for may have been moved, deleted, or never existed.
          Try heading back to explore more ideas.
        </p>
        <div className="notfound-actions">
          <button className="notfound-btn-primary" onClick={() => history.push('/')}>
            Go home
          </button>
          <button className="notfound-btn-secondary" onClick={() => history.push('/home')}>
            Browse stories
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
