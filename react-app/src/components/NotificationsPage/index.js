import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import {
  fetchAllNotifications,
  markAllRead,
  updateDigestFrequency,
} from '../../store/notifications';
import './NotificationsPage.css';

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function notificationText(n) {
  const actor = n.actorUsername || 'Someone';
  switch (n.type) {
    case 'clap': return `${actor} clapped for your story`;
    case 'comment': return `${actor} commented on your story`;
    case 'follow': return `${actor} started following you`;
    case 'mention': return `${actor} mentioned you in a comment`;
    case 'reply': return `${actor} replied on a story you commented on`;
    default: return `${actor} interacted with your content`;
  }
}

function NotificationsPage() {
  const dispatch = useDispatch();
  const history = useHistory();
  const user = useSelector((s) => s.session.user);
  const { notifications, unreadCount } = useSelector((s) => s.notifications);
  const [digestFreq, setDigestFreq] = useState(user?.digestFrequency || 'none');
  const [digestSaved, setDigestSaved] = useState(false);

  useEffect(() => {
    if (!user) {
      history.push('/');
      return;
    }
    dispatch(fetchAllNotifications());
  }, [dispatch, user, history]);

  useEffect(() => {
    if (user) setDigestFreq(user.digestFrequency || 'none');
  }, [user]);

  const handleMarkAllRead = () => dispatch(markAllRead());

  const handleDigestSave = async () => {
    await dispatch(updateDigestFrequency(digestFreq));
    setDigestSaved(true);
    setTimeout(() => setDigestSaved(false), 2000);
  };

  const handleNotifClick = (n) => {
    if (n.targetType === 'story' && n.targetId) {
      history.push(`/story/${n.targetId}`);
    }
  };

  return (
    <div className="notif-page">
      <div className="notif-page-inner">
        <div className="notif-page-header">
          <h1>Notifications</h1>
          {unreadCount > 0 && (
            <button className="notif-mark-all-btn" onClick={handleMarkAllRead}>
              Mark all read
            </button>
          )}
        </div>

        <div className="notif-list">
          {notifications.length === 0 ? (
            <div className="notif-empty">No notifications yet.</div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`notif-item ${!n.read ? 'notif-unread' : ''}`}
                onClick={() => handleNotifClick(n)}
              >
                <div className="notif-dot-wrapper">
                  {!n.read && <span className="notif-dot" />}
                </div>
                <div className="notif-body">
                  <span className="notif-text">{notificationText(n)}</span>
                  <span className="notif-time">{timeAgo(n.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="notif-digest-panel">
          <h2>Email Digest</h2>
          <p>Get a summary of stories from authors you follow.</p>
          <div className="notif-digest-controls">
            <select
              value={digestFreq}
              onChange={(e) => setDigestFreq(e.target.value)}
            >
              <option value="none">Off</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            <button className="notif-save-btn" onClick={handleDigestSave}>
              {digestSaved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotificationsPage;
