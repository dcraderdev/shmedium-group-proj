import { useEffect, useState, useContext, useCallback, useRef } from 'react';
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

const EDIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/* ── helpers ─────────────────────────────────────────────────── */

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function msRemaining(createdAt) {
  return EDIT_WINDOW_MS - (Date.now() - new Date(createdAt).getTime());
}

/* ── CommentInput ────────────────────────────────────────────── */

function CommentInput({ onSubmit, placeholder, initialValue = '', submitLabel = 'Respond', onCancel, autoFocus }) {
  const [text, setText] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus();
  }, [autoFocus]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    await onSubmit(text.trim());
    setBusy(false);
    setText('');
  };

  return (
    <form className="cmt-input-form" onSubmit={handleSubmit}>
      <textarea
        ref={ref}
        className="cmt-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        rows={3}
      />
      <div className="cmt-input-hint">⌘↵ to submit</div>
      <div className="cmt-input-actions">
        {onCancel && (
          <button type="button" className="cmt-btn-cancel" onClick={onCancel}>Cancel</button>
        )}
        <button type="submit" className="cmt-btn-submit" disabled={busy || !text.trim()}>
          {busy ? '…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

/* ── ClapButton ──────────────────────────────────────────────── */

function ClapButton({ comment, userId }) {
  const dispatch = useDispatch();
  const [clapped, setClapped] = useState(false);
  const [count, setCount] = useState(comment.clapCount ?? 0);
  const [busy, setBusy] = useState(false);

  // reset when server data changes
  useEffect(() => {
    setCount(comment.clapCount ?? 0);
  }, [comment.clapCount]);

  const isOwn = userId && userId === comment.userId;

  if (!userId || isOwn) {
    return (
      <span className="cmt-clap-count">
        <span>👏</span> {count}
      </span>
    );
  }

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const wasClapped = clapped;
    setClapped(!wasClapped);
    setCount((c) => wasClapped ? c - 1 : c + 1);   // optimistic
    const res = wasClapped
      ? await dispatch(removeCommentClap(comment.id))
      : await dispatch(addCommentClap(comment.id));
    // server will correct state via setCurrentStoryAction
    setBusy(false);
    if (res?.error) {
      // revert optimistic
      setClapped(wasClapped);
      setCount((c) => wasClapped ? c + 1 : c - 1);
    }
  };

  return (
    <button className={`cmt-clap-btn ${clapped ? 'clapped' : ''}`} onClick={toggle} disabled={busy}>
      <span>👏</span> {count}
    </button>
  );
}

/* ── EditTimer ───────────────────────────────────────────────── */

function EditTimer({ createdAt }) {
  const [remaining, setRemaining] = useState(() => msRemaining(createdAt));

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setInterval(() => {
      setRemaining(msRemaining(createdAt));
    }, 10000); // update every 10s
    return () => clearInterval(t);
  }, [createdAt, remaining]);

  if (remaining <= 0) return null;
  const mins = Math.ceil(remaining / 60000);
  return <span className="cmt-edit-timer">{mins}m left to edit</span>;
}

/* ── ReplyThread ─────────────────────────────────────────────── */

function ReplyThread({ replies, userId, storyId, onClap, onDelete }) {
  if (!replies || replies.length === 0) return null;
  return (
    <div className="cmt-replies">
      {replies.map((reply) => (
        <div key={reply.id} className="cmt-reply-tile">
          <div className="cmt-author-row">
            <img
              className="cmt-avatar cmt-avatar-sm"
              src={reply.author?.profileImage}
              alt={reply.author?.firstName}
              loading="lazy"
            />
            <div className="cmt-author-info">
              <span className="cmt-author-name">
                {reply.author?.firstName} {reply.author?.lastName}
              </span>
              <span className="cmt-time">{timeAgo(reply.createdAt)}</span>
            </div>
          </div>
          <div className="cmt-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]} className="cmt-md">{reply.content}</ReactMarkdown>
          </div>
          <div className="cmt-footer">
            <ClapButton comment={reply} userId={userId} />
            {userId && userId === reply.userId && (
              <button className="cmt-btn-danger" onClick={() => onDelete(storyId, reply.id)}>
                Delete
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── CommentTile ─────────────────────────────────────────────── */

function CommentTile({ comment, userId, storyId, onDelete, onReply }) {
  const dispatch = useDispatch();
  const [showReply, setShowReply] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editExpired, setEditExpired] = useState(msRemaining(comment.createdAt) <= 0);
  const isOwn = userId && userId === comment.userId;

  // expire the edit button when window closes
  useEffect(() => {
    if (!isOwn || editExpired) return;
    const rem = msRemaining(comment.createdAt);
    if (rem <= 0) { setEditExpired(true); return; }
    const t = setTimeout(() => setEditExpired(true), rem);
    return () => clearTimeout(t);
  }, [isOwn, editExpired, comment.createdAt]);

  const handleEditSave = async (text) => {
    await dispatch(editComment(storyId, comment.id, text));
    setEditing(false);
  };

  const handleReplySubmit = async (text) => {
    await onReply(comment.id, text);
    setShowReply(false);
  };

  return (
    <div className="cmt-tile">
      {/* author row */}
      <div className="cmt-author-row">
        <img
          className="cmt-avatar"
          src={comment.author?.profileImage}
          alt={comment.author?.firstName}
          loading="lazy"
        />
        <div className="cmt-author-info">
          <span className="cmt-author-name">
            {comment.author?.firstName} {comment.author?.lastName}
          </span>
          <span className="cmt-time">{timeAgo(comment.createdAt)}</span>
        </div>
      </div>

      {/* body */}
      <div className="cmt-body">
        {editing ? (
          <CommentInput
            autoFocus
            initialValue={comment.content}
            onSubmit={handleEditSave}
            submitLabel="Save"
            placeholder="Edit your response…"
            onCancel={() => setEditing(false)}
          />
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} className="cmt-md">{comment.content}</ReactMarkdown>
        )}
      </div>

      {/* footer */}
      {!editing && (
        <div className="cmt-footer">
          <ClapButton comment={comment} userId={userId} />

          {userId && (
            <button className="cmt-btn-ghost" onClick={() => setShowReply((v) => !v)}>
              {showReply ? 'Cancel reply' : 'Reply'}
            </button>
          )}

          {isOwn && !editExpired && (
            <>
              <button className="cmt-btn-ghost" onClick={() => setEditing(true)}>Edit</button>
              <EditTimer createdAt={comment.createdAt} />
            </>
          )}

          {isOwn && (
            <button className="cmt-btn-danger" onClick={() => onDelete(storyId, comment.id)}>
              Delete
            </button>
          )}
        </div>
      )}

      {/* reply form */}
      {showReply && (
        <div className="cmt-reply-input-wrap">
          <CommentInput
            autoFocus
            onSubmit={handleReplySubmit}
            submitLabel="Reply"
            placeholder="Write a reply… (Markdown supported)"
            onCancel={() => setShowReply(false)}
          />
        </div>
      )}

      {/* replies */}
      <ReplyThread
        replies={comment.replies ?? []}
        userId={userId}
        storyId={storyId}
        onDelete={onDelete}
      />
    </div>
  );
}

/* ── Comments (root) ─────────────────────────────────────────── */

const Comments = ({ userId, storyId, authorInfo, setShowComments }) => {
  const dispatch = useDispatch();
  const story = useSelector((s) => s.story.currentStory);
  const { commentRef } = useContext(WindowContext);
  const { openModal } = useContext(ModalContext);

  const [comments, setComments] = useState([]);
  const [sort, setSort] = useState('newest');
  const [userHasCommented, setUserHasCommented] = useState(false);

  useEffect(() => {
    if (!story) return;
    const top = (story.comments ?? []).filter(c => c.parentId == null);
    setUserHasCommented(top.some((c) => c.userId === userId));

    const sorted = [...top].sort(
      sort === 'top'
        ? (a, b) => (b.clapCount ?? 0) - (a.clapCount ?? 0)
        : (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    setComments(sorted);
  }, [story, userId, sort]);

  const handleSubmit = async (text) => {
    await dispatch(postComment(storyId, text));
    setTimeout(() => commentRef?.current?.scrollIntoView({ behavior: 'smooth' }), 400);
  };

  const handleDelete = useCallback(
    (sid, cid) => dispatch(deleteComment(sid, cid)),
    [dispatch]
  );

  const handleReply = useCallback(
    (parentId, text) => dispatch(postReply(parentId, text)),
    [dispatch]
  );

  const totalCount = story?.commentCount ?? 0;

  return (
    <div className="cmt-root">
      {/* header */}
      <div className="cmt-header">
        <h2 className="cmt-title">
          Responses
          {totalCount > 0 && <span className="cmt-count-badge">{totalCount}</span>}
        </h2>
        <div className="cmt-sort-bar">
          {['newest', 'top'].map((s) => (
            <button
              key={s}
              className={`cmt-sort-btn ${sort === s ? 'active' : ''}`}
              onClick={() => setSort(s)}
            >
              {s === 'newest' ? 'Newest' : 'Top'}
            </button>
          ))}
        </div>
      </div>

      {/* new comment form */}
      {userId && userId !== authorInfo?.id && !userHasCommented && (
        <CommentInput
          onSubmit={handleSubmit}
          placeholder="What are your thoughts? (Markdown: **bold**, _italic_, `code`)"
        />
      )}

      {userId && userId !== authorInfo?.id && userHasCommented && (
        <p className="cmt-already-msg">You've already responded to this story.</p>
      )}

      {!userId && (
        <div className="cmt-signin-prompt">
          <span
            className="cmt-signin-link"
            onClick={() => { openModal('signin'); setShowComments(false); }}
          >
            Sign in
          </span>{' '}
          to leave a response
        </div>
      )}

      {/* comment list */}
      <div className="cmt-list">
        {comments.map((comment) => (
          <CommentTile
            key={comment.id}
            comment={comment}
            userId={userId}
            storyId={storyId}
            onDelete={handleDelete}
            onReply={handleReply}
          />
        ))}
        {comments.length === 0 && (
          <p className="cmt-empty">No responses yet — be the first!</p>
        )}
      </div>

      <div ref={commentRef} />
    </div>
  );
};

export default Comments;
