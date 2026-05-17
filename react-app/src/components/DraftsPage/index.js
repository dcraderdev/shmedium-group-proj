import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import * as storyActions from '../../store/story';
import './DraftsPage.css';

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMins  = Math.floor((now - d) / 60000);
  const diffHours = Math.floor((now - d) / 3600000);
  const diffDays  = Math.floor((now - d) / 86400000);
  if (diffMins  <  1) return 'Just now';
  if (diffMins  < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays  <  7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DraftsPage() {
  const dispatch = useDispatch();
  const history  = useHistory();
  const user     = useSelector((state) => state.session.user);
  const drafts   = useSelector((state) => state.story.drafts);

  const [loading,       setLoading]       = useState(true);
  const [deleting,      setDeleting]      = useState(null);  // id being deleted
  const [confirmDelete, setConfirmDelete] = useState(null);  // id awaiting confirm

  useEffect(() => {
    if (!user) { history.push('/home'); return; }
    (async () => {
      setLoading(true);
      await dispatch(storyActions.getDrafts());
      setLoading(false);
    })();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEdit = (draft) => history.push(`/create/${draft.id}/edit`);

  const handleDeleteConfirm = async (draft) => {
    setDeleting(draft.id);
    setConfirmDelete(null);
    await dispatch(storyActions.deleteDraft(draft.id));
    setDeleting(null);
  };

  const handleNew = async () => {
    const result = await dispatch(storyActions.createDraft());
    if (result?.id) history.push(`/create/${result.id}/edit`);
  };

  return (
    <div className="drafts-root">
      <div className="drafts-header">
        <div>
          <h1 className="drafts-title">Your drafts</h1>
          {!loading && drafts.length > 0 && (
            <p className="drafts-subtitle">{drafts.length} unpublished {drafts.length === 1 ? 'story' : 'stories'}</p>
          )}
        </div>
        <button className="drafts-new-btn" onClick={handleNew}>
          + New story
        </button>
      </div>

      {loading ? (
        <div className="drafts-loading">
          {[1, 2, 3].map((i) => <div key={i} className="draft-skeleton" />)}
        </div>
      ) : drafts.length === 0 ? (
        <div className="drafts-empty">
          <div className="drafts-empty-icon">✏️</div>
          <p className="drafts-empty-heading">No drafts yet</p>
          <p className="drafts-empty-sub">
            Stories you're working on will appear here. Start writing whenever inspiration strikes.
          </p>
          <button className="drafts-start-btn" onClick={handleNew}>
            Start writing
          </button>
        </div>
      ) : (
        <ul className="drafts-list">
          {drafts.map((draft) => (
            <li
              key={draft.id}
              className={`draft-card ${confirmDelete === draft.id ? 'confirming' : ''}`}
            >
              <div className="draft-card-body" onClick={() => {
                if (confirmDelete === draft.id) return;
                handleEdit(draft);
              }}>
                <div className="draft-card-left">
                  <h2 className="draft-card-title">
                    {draft.title || <span className="draft-untitled">Untitled</span>}
                  </h2>
                  {draft.slicedIntro && (
                    <p className="draft-card-intro">
                      {draft.slicedIntro.replace(/<[^>]+>/g, '').slice(0, 120)}
                    </p>
                  )}
                  <div className="draft-card-meta">
                    <span className="draft-meta-tag">Draft</span>
                    <span className="draft-meta-dot">·</span>
                    <span className="draft-meta-date">Edited {fmtDate(draft.updatedAt)}</span>
                    {draft.wordCount > 0 && (
                      <>
                        <span className="draft-meta-dot">·</span>
                        <span className="draft-meta-words">{draft.wordCount.toLocaleString()} words</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="draft-card-actions">
                {confirmDelete === draft.id ? (
                  <div className="draft-confirm-row">
                    <span className="draft-confirm-text">Delete this draft?</span>
                    <button
                      className="draft-action-btn draft-confirm-yes"
                      onClick={() => handleDeleteConfirm(draft)}
                      disabled={deleting === draft.id}
                    >
                      {deleting === draft.id ? '…' : 'Delete'}
                    </button>
                    <button
                      className="draft-action-btn draft-confirm-no"
                      onClick={() => setConfirmDelete(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      className="draft-action-btn draft-edit-btn"
                      onClick={() => handleEdit(draft)}
                    >
                      Edit
                    </button>
                    <button
                      className="draft-action-btn draft-delete-btn"
                      onClick={() => setConfirmDelete(draft.id)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
