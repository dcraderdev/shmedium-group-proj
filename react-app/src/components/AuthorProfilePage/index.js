import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as storyActions from '../../store/story';
import './AuthorProfile.css';

const TABS = ['Stories', 'About', 'Followers', 'Following'];
const DEFAULT_COVER = 'https://miro.medium.com/v2/resize:fit:1500/1*k3c5bfQ5F4kLVZMuJl-7RA.jpeg';
const DEFAULT_AVATAR = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Default_pfp.svg/256px-Default_pfp.svg.png';

/* ─── helpers ─────────────────────────────────────────────────── */

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
}

/* ─── EditProfileModal ────────────────────────────────────────── */

function EditProfileModal({ profile, onClose, onSave }) {
  const dispatch = useDispatch();
  const [bio, setBio] = useState(profile.bio || '');
  const [twitter, setTwitter] = useState(profile.twitterHandle || '');
  const [github, setGithub] = useState(profile.githubHandle || '');
  const [website, setWebsite] = useState(profile.websiteUrl || '');
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(profile.coverImageUrl || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCoverChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    let payload;
    if (coverFile) {
      const fd = new FormData();
      fd.append('bio', bio);
      fd.append('twitterHandle', twitter);
      fd.append('githubHandle', github);
      fd.append('websiteUrl', website);
      fd.append('coverImage', coverFile);
      payload = fd;
    } else {
      payload = { bio, twitterHandle: twitter, githubHandle: github, websiteUrl: website, coverImageUrl: coverPreview };
    }
    const res = await dispatch(storyActions.updateProfile(payload));
    setSaving(false);
    if (res && !res.error) {
      onSave(res);
    } else {
      setError(res?.error || 'Failed to save. Try again.');
    }
  };

  return (
    <div className="apc-modal-overlay" onClick={onClose}>
      <div className="apc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="apc-modal-header">
          <h2 className="apc-modal-title">Edit Profile</h2>
          <button className="apc-modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="apc-edit-form">
          {/* Cover image */}
          <div className="apc-form-section">
            <label className="apc-form-label">Cover image</label>
            <div
              className="apc-cover-preview"
              style={{ backgroundImage: `url(${coverPreview || DEFAULT_COVER})` }}
            >
              <label className="apc-cover-upload-btn">
                Change cover
                <input type="file" accept="image/*" onChange={handleCoverChange} style={{ display: 'none' }} />
              </label>
            </div>
          </div>

          {/* Bio */}
          <div className="apc-form-section">
            <label className="apc-form-label">Bio</label>
            <textarea
              className="apc-textarea"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell readers about yourself… (Markdown supported)"
              rows={5}
            />
          </div>

          {/* Socials */}
          <div className="apc-form-section">
            <label className="apc-form-label">Social links</label>
            <div className="apc-social-inputs">
              <div className="apc-social-input-row">
                <span className="apc-social-prefix">𝕏</span>
                <input
                  className="apc-input"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="Twitter / X handle (without @)"
                />
              </div>
              <div className="apc-social-input-row">
                <span className="apc-social-prefix">⌥</span>
                <input
                  className="apc-input"
                  value={github}
                  onChange={(e) => setGithub(e.target.value)}
                  placeholder="GitHub username"
                />
              </div>
              <div className="apc-social-input-row">
                <span className="apc-social-prefix">🌐</span>
                <input
                  className="apc-input"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yoursite.com"
                />
              </div>
            </div>
          </div>

          {error && <p className="apc-form-error">{error}</p>}

          <div className="apc-form-actions">
            <button type="button" className="apc-btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="apc-btn-save" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── StoryCard ───────────────────────────────────────────────── */

function StoryCard({ story, onNavigate }) {
  const thumbnail =
    story.images?.[0]?.url ||
    'https://miro.medium.com/v2/resize:fit:1200/1*jfdwtvU6V6g99q3G7gq7dQ.png';

  return (
    <div className="apc-story-card" onClick={() => onNavigate(story.id)}>
      <div className="apc-story-card-img" style={{ backgroundImage: `url(${thumbnail})` }} />
      <div className="apc-story-card-body">
        <h3 className="apc-story-card-title">{story.title}</h3>
        {story.slicedIntro && (
          <p className="apc-story-card-intro">{story.slicedIntro}</p>
        )}
        <div className="apc-story-card-meta">
          <span>{fmtShort(story.createdAt)}</span>
          <span className="apc-dot">·</span>
          <span>{story.timeToRead} min read</span>
          <span className="apc-dot">·</span>
          <span>👏 {story.claps ?? 0}</span>
          {story.commentCount > 0 && (
            <span className="apc-comment-badge">💬 {story.commentCount}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── FollowerPill ────────────────────────────────────────────── */

function FollowerPill({ record, viewAs }) {
  const history = useHistory();
  // viewAs='follower' → show the person who follows (followerUser)
  // viewAs='following' → show the person being followed (authorUser)
  const user = viewAs === 'follower' ? record.followerUser : record.authorUser;
  if (!user) return null;

  const avatar = user.profileImage || DEFAULT_AVATAR;
  const name = `${user.firstName} ${user.lastName}`;

  return (
    <div className="apc-user-pill" onClick={() => history.push(`/author/${user.id}`)}>
      <img className="apc-user-pill-avatar" src={avatar} alt={name} loading="lazy" />
      <span className="apc-user-pill-name">{name}</span>
      <span className="apc-user-pill-arrow">→</span>
    </div>
  );
}

/* ─── AuthorProfilePage ───────────────────────────────────────── */

export default function AuthorProfilePage() {
  const { id } = useParams();
  const history = useHistory();
  const dispatch = useDispatch();

  const sessionUser = useSelector((s) => s.session.user);
  const followedAuthorIds = useSelector((s) => s.session.followedAuthorIds);
  const authorProfile = useSelector((s) => s.story.authorProfile);
  const authorStoriesState = useSelector((s) => s.story.authorStories);

  const numericId = parseInt(id, 10);
  const isOwner = sessionUser?.id === numericId;

  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('Stories');
  const [sort, setSort] = useState('newest');
  const [loadingMore, setLoadingMore] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const sentinelRef = useRef(null);

  /* ─ load profile + first page ─ */
  useEffect(() => {
    setProfile(null);          // clear stale profile while fetching
    dispatch(storyActions.getAuthorProfile(numericId));
    dispatch(storyActions.getAuthorStories(numericId, 1, sort));
  }, [numericId, dispatch]);   // sort intentionally excluded — sort change handled separately

  /* ─ reload stories on sort change ─ */
  useEffect(() => {
    dispatch(storyActions.getAuthorStories(numericId, 1, sort));
  }, [sort, numericId, dispatch]);

  /* ─ sync local profile from redux ─ */
  useEffect(() => {
    if (authorProfile?.id === numericId) {
      setProfile(authorProfile);
    }
  }, [authorProfile, numericId]);

  /* ─ sync follow state ─ */
  useEffect(() => {
    setFollowing(followedAuthorIds?.includes(numericId) ?? false);
  }, [followedAuthorIds, numericId]);

  /* ─ follow / unfollow ─ */
  const handleFollow = async () => {
    if (!sessionUser) return;
    const wasFollowing = following;
    setFollowing(!wasFollowing);          // optimistic
    setFollowLoading(true);
    if (wasFollowing) {
      await dispatch(storyActions.unfollowAuthor(numericId));
    } else {
      await dispatch(storyActions.followAuthor(numericId));
    }
    // refresh profile so follower counts update
    await dispatch(storyActions.getAuthorProfile(numericId));
    setFollowLoading(false);
  };

  /* ─ infinite scroll ─ */
  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    const cur = authorStoriesState?.currentPage ?? 1;
    const total = authorStoriesState?.totalPages ?? 1;
    if (cur >= total) return;
    setLoadingMore(true);
    await dispatch(storyActions.getAuthorStories(numericId, cur + 1, sort));
    setLoadingMore(false);
  }, [loadingMore, authorStoriesState, numericId, sort, dispatch]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  /* ─ edit profile ─ */
  const handleProfileSave = (updated) => {
    setProfile(updated);
    setShowEditModal(false);
  };

  /* ─ skeleton while loading ─ */
  if (!profile) {
    return (
      <div className="apc-root">
        <div className="apc-skeleton-hero" />
        <div className="apc-skeleton-stats" />
        <div className="apc-skeleton-body" />
      </div>
    );
  }

  const stories =
    authorStoriesState?.userId === numericId && authorStoriesState?.sort === sort
      ? authorStoriesState.stories ?? []
      : [];
  const hasMore =
    (authorStoriesState?.currentPage ?? 1) < (authorStoriesState?.totalPages ?? 1);

  return (
    <div className="apc-root">
      {/* ── Hero ── */}
      <div
        className="apc-hero"
        style={{ backgroundImage: `url(${profile.coverImageUrl || DEFAULT_COVER})` }}
      >
        <div className="apc-hero-overlay" />
        <div className="apc-hero-content">
          <img
            className="apc-avatar"
            src={profile.profileImage || DEFAULT_AVATAR}
            alt={`${profile.firstName} ${profile.lastName}`}
          />
          <h1 className="apc-name">{profile.firstName} {profile.lastName}</h1>
          {profile.bio && (
            <p className="apc-bio-hero">{profile.bio.slice(0, 160)}{profile.bio.length > 160 ? '…' : ''}</p>
          )}
          <div className="apc-hero-meta">
            <span><strong>{profile.numFollowers ?? 0}</strong> followers</span>
            <span className="apc-dot">·</span>
            <span><strong>{profile.numFollowing ?? 0}</strong> following</span>
            <span className="apc-dot">·</span>
            <span>Member since {fmtDate(profile.createdAt)}</span>
          </div>
          <div className="apc-hero-actions">
            {isOwner ? (
              <button className="apc-btn-edit" onClick={() => setShowEditModal(true)}>
                Edit Profile
              </button>
            ) : sessionUser ? (
              <button
                className={`apc-btn-follow ${following ? 'following' : ''}`}
                onClick={handleFollow}
                disabled={followLoading}
              >
                {following ? '✓ Following' : '+ Follow'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Stat row ── */}
      <div className="apc-stats">
        <div className="apc-stat">
          <span className="apc-stat-value">{profile.totalStories ?? '—'}</span>
          <span className="apc-stat-label">Stories</span>
        </div>
        <div className="apc-stat">
          <span className="apc-stat-value">{profile.totalClaps ?? '—'}</span>
          <span className="apc-stat-label">Claps received</span>
        </div>
        <div className="apc-stat">
          <span className="apc-stat-value">{profile.numFollowers ?? 0}</span>
          <span className="apc-stat-label">Followers</span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="apc-tabs-bar">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`apc-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            {tab === 'Followers' && profile.numFollowers > 0 && (
              <span className="apc-tab-badge">{profile.numFollowers}</span>
            )}
            {tab === 'Following' && profile.numFollowing > 0 && (
              <span className="apc-tab-badge">{profile.numFollowing}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="apc-tab-content">

        {/* Stories */}
        {activeTab === 'Stories' && (
          <>
            <div className="apc-sort-bar">
              {['newest', 'top'].map((s) => (
                <button
                  key={s}
                  className={`apc-sort-btn ${sort === s ? 'active' : ''}`}
                  onClick={() => { if (sort !== s) setSort(s); }}
                >
                  {s === 'newest' ? 'Newest' : 'Top this month'}
                </button>
              ))}
            </div>

            {stories.length === 0 && !loadingMore ? (
              <p className="apc-empty">No stories yet.</p>
            ) : (
              <div className="apc-story-grid">
                {stories.map((story) => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    onNavigate={(sid) => history.push(`/story/${sid}`)}
                  />
                ))}
              </div>
            )}

            {(hasMore || loadingMore) && (
              <div ref={sentinelRef} className="apc-sentinel">
                {loadingMore && <div className="apc-spinner" />}
              </div>
            )}
            {!hasMore && stories.length > 0 && (
              <p className="apc-end-msg">You've seen all {profile.totalStories} stories.</p>
            )}
          </>
        )}

        {/* About */}
        {activeTab === 'About' && (
          <div className="apc-about">
            {profile.bio ? (
              <div className="apc-about-bio">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{profile.bio}</ReactMarkdown>
              </div>
            ) : (
              <p className="apc-empty">{isOwner ? 'Add a bio to tell readers about yourself.' : 'No bio yet.'}</p>
            )}

            {(profile.twitterHandle || profile.githubHandle || profile.websiteUrl) && (
              <div className="apc-social-links">
                {profile.twitterHandle && (
                  <a
                    className="apc-social-link"
                    href={`https://twitter.com/${profile.twitterHandle.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="apc-social-icon">𝕏</span>
                    @{profile.twitterHandle.replace(/^@/, '')}
                  </a>
                )}
                {profile.githubHandle && (
                  <a
                    className="apc-social-link"
                    href={`https://github.com/${profile.githubHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="apc-social-icon">⌥</span>
                    {profile.githubHandle}
                  </a>
                )}
                {profile.websiteUrl && (
                  <a
                    className="apc-social-link"
                    href={profile.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="apc-social-icon">🌐</span>
                    {profile.websiteUrl.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
            )}

            {isOwner && (
              <button className="apc-btn-edit-inline" onClick={() => setShowEditModal(true)}>
                Edit Profile
              </button>
            )}
          </div>
        )}

        {/* Followers */}
        {activeTab === 'Followers' && (
          <div className="apc-people-list">
            {(profile.followers ?? []).length === 0 ? (
              <p className="apc-empty">No followers yet.</p>
            ) : (
              (profile.followers ?? []).map((f) => (
                <FollowerPill key={f.id} record={f} viewAs="follower" />
              ))
            )}
          </div>
        )}

        {/* Following */}
        {activeTab === 'Following' && (
          <div className="apc-people-list">
            {(profile.followings ?? []).length === 0 ? (
              <p className="apc-empty">Not following anyone yet.</p>
            ) : (
              (profile.followings ?? []).map((f) => (
                <FollowerPill key={f.id} record={f} viewAs="following" />
              ))
            )}
          </div>
        )}
      </div>

      {showEditModal && (
        <EditProfileModal
          profile={profile}
          onClose={() => setShowEditModal(false)}
          onSave={handleProfileSave}
        />
      )}
    </div>
  );
}
