import { useEffect, useState, useContext, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  addCommentClap,
  postComment,
  editComment,
  deleteComment,
  removeCommentClap,
  postReply,
} from '../../store/story';
import './Comments.css';
import { WindowContext } from '../../context/WindowContext';
import { ModalContext } from '../../context/ModalContext';

const EDIT_WINDOW_MS = 5 * 60 * 1000;

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function canEdit(createdAt) {
  return Date.now() - new Date(createdAt).getTime() < EDIT_WINDOW_MS;
}

function CommentClaps({ comment, userId, onClap, onUnclap }) {
  const [clapped, setClapped] = useState(false);
  const isOwn = userId && userId === comment.userId;

  const handleClap = async () => {
    if (clapped) {
      setClapped(false);
      await onUnclap(comment.id);
    } else {
      setClapped(true);
      await onClap(comment.id);
    }
  };

  if (!userId || isOwn) {
    return (
      <span className="cmt-clap-count">
        <span className="cmt-clap-icon">👏</span>
        {comment.clapCount || 0}
      </span>
    );
  }

  return (
    <button className={`cmt-clap-btn ${clapped ? 'clapped' : ''}`} onClick={handleClap}>
      <span className="cmt-clap-icon">👏</span>
      <span>{comment.clapCount || 0}</span>
    </button>
  );
}

function CommentInput({ onSubmit, placeholder, initialValue = '', submitLabel = 'Post', onCancel }) {
  const [text, setText] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    await onSubmit(text.trim());
    setSubmitting(false);
    setText('');
  };

  return (
    <form className="cmt-input-form" onSubmit={handleSubmit}>
      <textarea
        className="cmt-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={3}
      />
      <div className="cmt-input-actions">
        {onCancel && (
          <button type="button" className="cmt-btn-cancel" onClick={onCancel}>Cancel</button>
        )}
        <button type="submit" className="cmt-btn-submit" disabled={submitting || !text.trim()}>
          {submitting ? '…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function ReplyThread({ replies, userId, storyId, onClap, onUnclap, onDelete }) {
  if (!replies || replies.length === 0) return null;
  return (
    <div className="cmt-replies">
      {replies.map((reply) => (
        <div key={reply.id} className="cmt-reply-tile">
          <div className="cmt-author-row">
            <img
              src={reply.author?.profileImage}
              alt={reply.author?.firstName}
              className="cmt-avatar cmt-avatar-sm"
              loading="lazy"
            />
            <div className="cmt-author-info">
              <span className="cmt-author-name">{reply.author?.firstName} {reply.author?.lastName}</span>
              <span className="cmt-time">{timeAgo(reply.createdAt)}</span>
            </div>
          </div>
          <div className="cmt-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]} className="cmt-markdown">{reply.content}</ReactMarkdown>
          </div>
          <div className="cmt-footer">
            <CommentClaps comment={reply} userId={userId} onClap={onClap} onUnclap={onUnclap} />
            {userId && userId === reply.userId && (
              <button className="cmt-btn-danger" onClick={() => onDelete(storyId, reply.id)}>Delete</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function CommentTile({ comment, userId, storyId, onClap, onUnclap, onEdit, onDelete, onReply }) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editExpired, setEditExpired] = useState(!canEdit(comment.createdAt));
  const isOwn = userId && userId === comment.userId;

  useEffect(() => {
    if (isOwn && !editExpired) {
      const remaining = EDIT_WINDOW_MS - (Date.now() - new Date(comment.createdAt).getTime());
      if (remaining <= 0) { setEditExpired(true); return; }
      const t = setTimeout(() => setEditExpired(true), remaining);
      return () => clearTimeout(t);
    }
  }, [isOwn, editExpired, comment.createdAt]);

  const handleEditSubmit = async (text) => {
    await onEdit(storyId, comment.id, text);
    setEditing(false);
  };

  const handleReplySubmit = async (text) => {
    await onReply(comment.id, text);
    setShowReplyForm(false);
  };

  return (
    <div className="cmt-tile">
      <div className="cmt-author-row">
        <img
          src={comment.author?.profileImage}
          alt={comment.author?.firstName}
          className="cmt-avatar"
          loading="lazy"
        />
        <div className="cmt-author-info">
          <span className="cmt-author-name">{comment.author?.firstName} {comment.author?.lastName}</span>
          <span className="cmt-time">{timeAgo(comment.createdAt)}</span>
        </div>
      </div>

      <div className="cmt-body">
        {editing ? (
          <CommentInput
            onSubmit={handleEditSubmit}
            initialValue={comment.content}
            submitLabel="Save"
            placeholder="Edit your comment…"
            onCancel={() => setEditing(false)}
          />
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} className="cmt-markdown">{comment.content}</ReactMarkdown>
        )}
      </div>

      {!editing && (
        <div className="cmt-footer">
          <CommentClaps comment={comment} userId={userId} onClap={onClap} onUnclap={onUnclap} />

          {userId && (
            <button
              className="cmt-btn-ghost"
              onClick={() => setShowReplyForm((v) => !v)}
            >
              Reply
            </button>
          )}

          {isOwn && !editExpired && !editing && (
            <button className="cmt-btn-ghost" onClick={() => setEditing(true)}>Edit</button>
          )}

          {isOwn && (
            <button className="cmt-btn-danger" onClick={() => onDelete(storyId, comment.id)}>Delete</button>
          )}
        </div>
      )}

      {showReplyForm && (
        <div className="cmt-reply-form-wrap">
          <CommentInput
            onSubmit={handleReplySubmit}
            placeholder="Write a reply…"
            submitLabel="Reply"
            onCancel={() => setShowReplyForm(false)}
          />
        </div>
      )}

      <ReplyThread
        replies={comment.replies || []}
        userId={userId}
        storyId={storyId}
        onClap={onClap}
        onUnclap={onUnclap}
        onDelete={onDelete}
      />
    </div>
  );
}

const Comments = ({ userId, storyId, authorInfo, setShowComments }) => {
  const dispatch = useDispatch();
  const story = useSelector((state) => state.story.currentStory);
  const { commentRef } = useContext(WindowContext);
  const { openModal } = useContext(ModalContext);

  const [comments, setComments] = useState([]);
  const [sort, setSort] = useState('newest');
  const [userHasCommented, setUserHasCommented] = useState(false);

  useEffect(() => {
    if (!story) return;
    const topLevel = story.comments || [];
    setUserHasCommented(!!topLevel.find((c) => c.userId === userId));

    let sorted = [...topLevel];
    if (sort === 'top') {
      sorted.sort((a, b) => (b.clapCount || 0) - (a.clapCount || 0));
    } else {
      sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    setComments(sorted);
  }, [story, userId, sort]);

  const handleSubmit = async (text) => {
    await dispatch(postComment(storyId, text));
    setTimeout(() => {
      commentRef?.current?.scrollIntoView({ behavior: 'smooth' });
    }, 400);
  };

  const handleEdit = useCallback((sid, commentId, text) => {
    return dispatch(editComment(sid, commentId, text));
  }, [dispatch]);

  const handleDelete = useCallback((sid, commentId) => {
    return dispatch(deleteComment(sid, commentId));
  }, [dispatch]);

  const handleClap = useCallback(async (commentId) => {
    const res = await dispatch(addCommentClap(commentId));
    if (res?.error) alert('Cannot clap this comment.');
  }, [dispatch]);

  const handleUnclap = useCallback(async (commentId) => {
    const res = await dispatch(removeCommentClap(commentId));
    if (res?.error) alert('No clap to remove.');
  }, [dispatch]);

  const handleReply = useCallback((parentId, text) => {
    return dispatch(postReply(parentId, text));
  }, [dispatch]);

  const totalCount = story?.commentCount || 0;

  return (
    <div className="cmt-root">
      <div className="cmt-header">
        <h2 className="cmt-title">Responses <span className="cmt-count">({totalCount})</span></h2>
        <div className="cmt-sort-bar">
          <button
            className={`cmt-sort-btn ${sort === 'newest' ? 'active' : ''}`}
            onClick={() => setSort('newest')}
          >
            Newest
          </button>
          <button
            className={`cmt-sort-btn ${sort === 'top' ? 'active' : ''}`}
            onClick={() => setSort('top')}
          >
            Top
          </button>
        </div>
      </div>

      {userId && userId !== authorInfo?.id && !userHasCommented && (
        <CommentInput
          onSubmit={handleSubmit}
          placeholder="What are your thoughts? (Markdown supported)"
        />
      )}

      {!userId && (
        <div className="cmt-signin-prompt">
          <span className="cmt-signin-link" onClick={() => { openModal('signin'); setShowComments(false); }}>
            Sign in
          </span>
          {' '}to leave a response
        </div>
      )}

      <div className="cmt-list">
        {comments.map((comment) => (
          <CommentTile
            key={comment.id}
            comment={comment}
            userId={userId}
            storyId={storyId}
            onClap={handleClap}
            onUnclap={handleUnclap}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onReply={handleReply}
          />
        ))}
        {comments.length === 0 && (
          <p className="cmt-empty">No responses yet. Be the first!</p>
        )}
      </div>

      <div ref={commentRef} />
    </div>
  );
};

export default Comments;
