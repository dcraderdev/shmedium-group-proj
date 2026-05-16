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
    const params = new URLSearchParams({ text: shareText, url });
    window.open(`https://twitter.com/intent/tweet?${params}`, '_blank', 'noopener');
  };

  const openLinkedIn = () => {
    const params = new URLSearchParams({ url, title: story.title, summary: shareText });
    window.open(`https://www.linkedin.com/shareArticle?mini=true&${params}`, '_blank', 'noopener');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  const openEmail = () => {
    const subject = encodeURIComponent(story.title);
    const body = encodeURIComponent(`${shareText}\n\n${url}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <>
      {/* Desktop floating sidebar */}
      <div className={`share-sidebar${visible ? ' share-sidebar--visible' : ''}`}>
        <p className="share-label">Share</p>
        <button className="share-btn share-btn--twitter" onClick={openTwitter} title="Share on Twitter">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L2.25 2.25h6.672l4.261 5.633zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </button>
        <button className="share-btn share-btn--linkedin" onClick={openLinkedIn} title="Share on LinkedIn">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        </button>
        <button className="share-btn share-btn--copy" onClick={copyLink} title={copied ? 'Copied!' : 'Copy link'}>
          {copied ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
          )}
        </button>
        <button className="share-btn share-btn--email" onClick={openEmail} title="Share via email">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </button>
      </div>

      {/* Mobile bottom share row — always visible at article top */}
      <div className="share-inline">
        <span className="share-label">Share:</span>
        <button className="share-btn share-btn--twitter" onClick={openTwitter}>Twitter</button>
        <button className="share-btn share-btn--linkedin" onClick={openLinkedIn}>LinkedIn</button>
        <button className="share-btn share-btn--copy" onClick={copyLink}>{copied ? 'Copied!' : 'Copy link'}</button>
        <button className="share-btn share-btn--email" onClick={openEmail}>Email</button>
      </div>
    </>
  );
};

export default ShareButtons;
