import React, { useState, useEffect } from 'react';
import './ShareButtons.css';

const ShareButtons = ({ story }) => {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!story) return null;

  const url = window.location.href;
  const authorName = `${story.authorInfo?.firstName || ''} ${story.authorInfo?.lastName || ''}`.trim();
  const shareText = `"${story.title}" by ${authorName}`;

  const openTwitter = () => {
    const p = new URLSearchParams({ text: shareText, url });
    window.open(`https://twitter.com/intent/tweet?${p}`, '_blank', 'noopener,noreferrer');
  };

  const openLinkedIn = () => {
    const p = new URLSearchParams({ url, title: story.title, summary: shareText, mini: 'true' });
    window.open(`https://www.linkedin.com/shareArticle?${p}`, '_blank', 'noopener,noreferrer');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — silent fail */
    }
  };

  const openEmail = () => {
    window.location.href = `mailto:?subject=${encodeURIComponent(story.title)}&body=${encodeURIComponent(`${shareText}\n\n${url}`)}`;
  };

  const buttons = (inline = false) => (
    <>
      <button
        className={`share-btn share-btn--twitter${inline ? ' share-btn--inline' : ''}`}
        onClick={openTwitter}
        aria-label="Share on Twitter"
        title="Share on Twitter"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="17" height="17" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L2.25 2.25h6.672l4.261 5.633zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        {inline && <span>Twitter</span>}
      </button>

      <button
        className={`share-btn share-btn--linkedin${inline ? ' share-btn--inline' : ''}`}
        onClick={openLinkedIn}
        aria-label="Share on LinkedIn"
        title="Share on LinkedIn"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="17" height="17" aria-hidden="true">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
        {inline && <span>LinkedIn</span>}
      </button>

      <button
        className={`share-btn share-btn--copy${inline ? ' share-btn--inline' : ''}${copied ? ' share-btn--copied' : ''}`}
        onClick={copyLink}
        aria-label={copied ? 'Link copied' : 'Copy link'}
        title={copied ? 'Link copied!' : 'Copy link'}
      >
        {copied ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="17" height="17" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17" aria-hidden="true">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
          </svg>
        )}
        {inline && <span>{copied ? 'Copied!' : 'Copy link'}</span>}
      </button>

      <button
        className={`share-btn share-btn--email${inline ? ' share-btn--inline' : ''}`}
        onClick={openEmail}
        aria-label="Share via email"
        title="Share via email"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17" aria-hidden="true">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
        {inline && <span>Email</span>}
      </button>
    </>
  );

  return (
    <>
      {/* Desktop floating sidebar — position: fixed */}
      <div
        className={`share-sidebar${visible ? ' share-sidebar--visible' : ''}`}
        aria-label="Share article"
      >
        <p className="share-label">Share</p>
        {buttons(false)}
      </div>

      {/* Mobile inline strip */}
      <div className="share-inline" aria-label="Share article">
        <span className="share-label">Share</span>
        {buttons(true)}
      </div>
    </>
  );
};

export default ShareButtons;
