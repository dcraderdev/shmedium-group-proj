import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as storyActions from '../../store/story';
import { setUser } from '../../store/session';
import './AuthorProfile.css';

const TABS = ['Stories', 'About', 'Followers', 'Following'];

const defaultCover = 'https://miro.medium.com/v2/resize:fit:1500/1*k3c5bfQ5F4kLVZMuJl-7RA.jpeg';
const defaultAvatar = 'https://miro.medium.com/v2/resize:fit:2400/1*TL9pFJJHFfH2oy9Q_Wh7iA.png';

function EditProfileModal({ profile, onClose, onSave }) {
  const [bio, setBio] = useState(profile.bio || '');
  const [twitterHandle, setTwitterHandle] = useState(profile.twitterHandle || '');
  const [githubHandle, setGithubHandle] = useState(profile.githubHandle || '');
  const [websiteUrl, setWebsiteUrl] = useState(profile.websiteUrl || '');
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(profile.coverImageUrl || '');
  const [saving, setSaving] = useState(false);
  const dispatch = useDispatch();

  const handleCoverChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    let payload;
    if (coverFile) {
      const fd = new FormData();
      fd.append('bio', bio);
      fd.append('twitterHandle', twitterHandle);
      fd.append('githubHandle', githubHandle);
      fd.append('websiteUrl', websiteUrl);
      fd.append('coverImage', coverFile);
      payload = fd;
    } else {
      payload = { bio, twitterHandle, githubHandle, websiteUrl, coverImageUrl: coverPreview };
    }
    const updated = await dispatch(storyActions.updateProfile(payload));
    setSaving(false);
    if (updated && !updated.error) {
      onSave(updated);
    }
  };

  return (
    <div className="apc-modal-overlay" onClick={onClose}>
      <div className="apc-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="apc-modal-title">Edit Profile</h2>
        <form onSubmit={handleSubmit} className="apc-edit-form">
          <label className="apc-form-label">Cover Image</label>
          <div className="apc-cover-preview" style={{ backgroundImage: `url(${coverPreview || defaultCover})` }}>
            <label className="apc-cover-upload-btn">
              Change Cover
              <input type="file" accept="image/*" onChange={handleCoverChange} style={{ display: 'none' }} />
            </label>
          </div>

          <label className="apc-form-label">Bio</label>
          <textarea
            className="apc-textarea"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Write a short bio…"
            rows={4}
          />

          <label className="apc-form-label">Twitter handle</label>
          <input
            className="apc-input"
            value={twitterHandle}
            onChange={(e) => setTwitterHandle(e.target.value)}
            placeholder="@handle"
          />

          <label className="apc-form-label">GitHub handle</label>
          <input
            className="apc-input"
            value={githubHandle}
            onChange={(e) => setGithubHandle(e.target.value)}
            placeholder="username"
          />

          <label className="apc-form-label">Website</label>
          <input
            className="apc-input"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://yoursite.com"
          />

          <div className="apc-form-actions">
            <button type="button" className="apc-btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="apc-btn-save" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StoryCard({ story, onClick }) {
  const thumbnail = story.images?.[0]?.url || 'https://miro.medium.com/v2/resize:fit:1200/1*jfdwtvU6V6g99q3G7gq7dQ.png';
  const date = story.createdAt?.slice(0, 10) || '';
  return (
    <div className="apc-story-card" onClick={() => onClick(story.id)}>
      <div className="apc-story-card-img" style={{ backgroundImage: `url(${thumbnail})` }} />
      <div className="apc-story-card-body">
        <h3 className="apc-story-card-title">{story.title}</h3>
        <p className="apc-story-card-intro">{story.slicedIntro}</p>
        <div className="apc-story-card-meta">
          <span>{date}</span>
          <span className="apc-dot">·</span>
          <span>{story.timeToRead} min read</span>
          <span className="apc-dot">·</span>
          <span>👏 {story.claps}</span>
          {story.commentCount > 0 && (
            <span className="apc-comment-badge">💬 {story.commentCount}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function UserPill({ followerRecord, allUsers }) {
  const history = useHistory();
  const userId = followerRecord.followerId || followerRecord.authorId;
  return (
    <div className="apc-user-pill" onClick={() => history.push(`/author/${userId}`)}>
      <div className="apc-user-pill-avatar" />
      <span className="apc-user-pill-name">User {userId}</span>
    </div>
  );
}

export default function AuthorProfilePage() {
  const { id } = useParams();
  const history = useHistory();
  const dispatch = useDispatch();

  const sessionUser = useSelector((state) => state.session.user);
  const followedAuthorIds = useSelector((state) => state.session.followedAuthorIds);
  const authorProfile = useSelector((state) => state.story.authorProfile);
  const authorStoriesState = useSelector((state) => state.story.authorStories);

  const [activeTab, setActiveTab] = useState('Stories');
  const [sort, setSort] = useState('newest');
  const [loadingMore, setLoadingMore] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [profile, setProfile] = useState(null);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const sentinelRef = useRef(null);
  const numericId = parseInt(id, 10);

  const isOwner = sessionUser?.id === numericId;

  useEffect(() => {
    dispatch(storyActions.getAuthorProfile(numericId));
    dispatch(storyActions.getAuthorStories(numericId, 1, sort));
  }, [numericId, sort, dispatch]);

  useEffect(() => {
    if (authorProfile && authorProfile.id === numericId) {
      setProfile(authorProfile);
    }
  }, [authorProfile, numericId]);

  useEffect(() => {
    setFollowing(followedAuthorIds?.includes(numericId) || false);
  }, [followedAuthorIds, numericId]);

  const handleFollow = async () => {
    if (!sessionUser) return;
    setFollowLoading(true);
    setFollowing((f) => !f);
    if (following) {
      await dispatch(storyActions.unfollowAuthor(numericId));
    } else {
      await dispatch(storyActions.followAuthor(numericId));
    }
    await dispatch(storyActions.getAuthorProfile(numericId));
    setFollowLoading(false);
  };

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    const currentPage = authorStoriesState?.currentPage || 1;
    const totalPages = authorStoriesState?.totalPages || 1;
    if (currentPage >= totalPages) return;
    setLoadingMore(true);
    await dispatch(storyActions.getAuthorStories(numericId, currentPage + 1, sort));
    setLoadingMore(false);
  }, [loadingMore, authorStoriesState, numericId, sort, dispatch]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleSortChange = (newSort) => {
    if (newSort === sort) return;
    setSort(newSort);
  };

  const handleProfileSave = (updated) => {
    setProfile(updated);
    setShowEditModal(false);
  };

  if (!profile) {
    return (
      <div className="apc-loading">
        <div className="apc-skeleton-hero" />
        <div className="apc-skeleton-body" />
      </div>
    );
  }

  const stories = authorStoriesState?.userId === numericId ? (authorStoriesState.stories || []) : [];
  const hasMore = (authorStoriesState?.currentPage || 1) < (authorStoriesState?.totalPages || 1);
  const memberSince = profile.createdAt?.slice(0, 10) || '';

  return (
    <div className="apc-root">
      {/* Hero */}
      <div
        className="apc-hero"
        style={{ backgroundImage: `url(${profile.coverImageUrl || defaultCover})` }}
      >
        <div className="apc-hero-overlay" />
        <div className="apc-hero-content">
          <img
            className="apc-avatar"
            src={profile.profileImage || defaultAvatar}
            alt={`${profile.firstName} ${profile.lastName}`}
          />
          <h1 className="apc-name">{profile.firstName} {profile.lastName}</h1>
          {profile.bio && <p className="apc-bio-hero">{profile.bio}</p>}
          <div className="apc-hero-meta">
            <span>{profile.numFollowers} followers</span>
            <span className="apc-dot">·</span>
            <span>{profile.numFollowing} following</span>
            <span className="apc-dot">·</span>
            <span>Member since {memberSince}</span>
          </div>
          <div className="apc-hero-actions">
            {isOwner ? (
              <button className="apc-btn-edit" onClick={() => setShowEditModal(true)}>Edit Profile</button>
            ) : sessionUser ? (
              <button
                className={`apc-btn-follow ${following ? 'following' : ''}`}
                onClick={handleFollow}
                disabled={followLoading}
              >
                {following ? 'Following' : 'Follow'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Stat row */}
      <div className="apc-stats">
        <div className="apc-stat">
          <span className="apc-stat-value">{profile.totalStories ?? authorStoriesState?.totalStories ?? '—'}</span>
          <span className="apc-stat-label">Stories</span>
        </div>
        <div className="apc-stat">
          <span className="apc-stat-value">{profile.totalClaps ?? '—'}</span>
          <span className="apc-stat-label">Claps received</span>
        </div>
        <div className="apc-stat">
          <span className="apc-stat-value">{profile.numFollowers}</span>
          <span className="apc-stat-label">Followers</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="apc-tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`apc-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="apc-tab-content">
        {activeTab === 'Stories' && (
          <>
            <div className="apc-sort-bar">
              <button
                className={`apc-sort-btn ${sort === 'newest' ? 'active' : ''}`}
                onClick={() => handleSortChange('newest')}
              >
                Newest
              </button>
              <button
                className={`apc-sort-btn ${sort === 'top' ? 'active' : ''}`}
                onClick={() => handleSortChange('top')}
              >
                Top this month
              </button>
            </div>

            <div className="apc-story-grid">
              {stories.map((story) => (
                <StoryCard key={story.id} story={story} onClick={(id) => history.push(`/story/${id}`)} />
              ))}
            </div>

            {hasMore && (
              <div ref={sentinelRef} className="apc-sentinel">
                {loadingMore && <div className="apc-loading-spinner" />}
              </div>
            )}

            {!hasMore && stories.length > 0 && (
              <p className="apc-end-message">You've seen all stories.</p>
            )}

            {stories.length === 0 && !loadingMore && (
              <p className="apc-empty">No stories yet.</p>
            )}
          </>
        )}

        {activeTab === 'About' && (
          <div className="apc-about">
            {profile.bio ? (
              <div className="apc-about-bio">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{profile.bio}</ReactMarkdown>
              </div>
            ) : (
              <p className="apc-empty">No bio yet.</p>
            )}
            <div className="apc-social-links">
              {profile.twitterHandle && (
                <a
                  className="apc-social-link twitter"
                  href={`https://twitter.com/${profile.twitterHandle.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  𝕏 @{profile.twitterHandle.replace('@', '')}
                </a>
              )}
              {profile.githubHandle && (
                <a
                  className="apc-social-link github"
                  href={`https://github.com/${profile.githubHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ⌥ GitHub
                </a>
              )}
              {profile.websiteUrl && (
                <a
                  className="apc-social-link website"
                  href={profile.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  🌐 Website
                </a>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Followers' && (
          <div className="apc-people-list">
            {(profile.followers || []).length === 0 ? (
              <p className="apc-empty">No followers yet.</p>
            ) : (
              profile.followers.map((f) => (
                <FollowerPill key={f.id} record={f} type="follower" />
              ))
            )}
          </div>
        )}

        {activeTab === 'Following' && (
          <div className="apc-people-list">
            {(profile.followings || []).length === 0 ? (
              <p className="apc-empty">Not following anyone yet.</p>
            ) : (
              profile.followings.map((f) => (
                <FollowerPill key={f.id} record={f} type="following" />
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

function FollowerPill({ record, type }) {
  const history = useHistory();
  const userId = type === 'follower' ? record.followerId : record.authorId;
  return (
    <div className="apc-user-pill" onClick={() => history.push(`/author/${userId}`)}>
      <div className="apc-user-pill-icon">👤</div>
      <span className="apc-user-pill-name">User #{userId}</span>
      <span className="apc-user-pill-arrow">→</span>
    </div>
  );
}
