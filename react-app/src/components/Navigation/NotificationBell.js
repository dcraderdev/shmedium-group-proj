import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { markAllRead, markOneRead } from '../../store/notifications';
import bellIcon from '../../public/bell-icon.svg';
import { clickable } from '../../utils/a11y';

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
  const title = n.storyTitle ? `"${n.storyTitle}"` : 'your story';
  switch (n.type) {
    case 'clap':    return `${actor} clapped for ${title}`;
    case 'comment': return `${actor} commented on ${title}`;
    case 'follow':  return `${actor} started following you`;
    case 'mention': return `${actor} mentioned you in ${title}`;
    case 'reply':   return `${actor} also commented on ${title}`;
    default:        return `${actor} interacted with ${title}`;
  }
}

function NotificationBell({ showBell }) {
  const dispatch = useDispatch();
  const history = useHistory();
  const { notifications, unreadCount } = useSelector((s) => s.notifications);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef(null);

  // Fetching and polling are owned by Navigation, which mounts once. Both the
  // desktop and mobile bells mount at the same time, so polling from here sent
  // every request twice. This component only renders what is already in redux.

  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleBellClick = (e) => {
    e.stopPropagation();
    setBellOpen((prev) => !prev);
  };

  const handleMarkAllRead = (e) => {
    e.stopPropagation();
    dispatch(markAllRead());
  };

  const handleNotifItemClick = (n) => {
    if (!n.read) dispatch(markOneRead(n.id));
    setBellOpen(false);
    if (n.targetType === 'story' && n.targetId) {
      history.push(`/story/${n.targetId}`);
    }
  };

  const handleViewAll = () => {
    setBellOpen(false);
    history.push('/notifications');
  };

  return (
    <div className="bell-icon-container bell-wrapper" ref={bellRef}>
      {/* With showBell false and nothing unread this rendered as an empty
          focusable role="button" — a tab stop with no name and nothing to see
          (WCAG 4.1.2). Only render the control when it has something to show,
          and name it here rather than leaning on the icon's alt text. */}
      {(showBell || unreadCount > 0) && (
        <div
          className="bell-trigger"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications'
          }
          {...clickable(handleBellClick)}
        >
          {showBell && <img src={bellIcon} alt="" />}
          {unreadCount > 0 && (
            <span className="bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </div>
      )}

      {bellOpen && (
        <div className="bell-dropdown">
          <div className="bell-dropdown-header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button className="bell-mark-all" onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="bell-dropdown-list">
            {notifications.length === 0 ? (
              <div className="bell-empty">No notifications yet.</div>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <div
                  key={n.id}
                  className={`bell-notif-item ${!n.read ? 'bell-notif-unread' : ''}`}
                  {...clickable(() => handleNotifItemClick(n))}
                >
                  {!n.read && <span className="bell-notif-dot" />}
                  <div className="bell-notif-body">
                    <span className="bell-notif-text">{notificationText(n)}</span>
                    <span className="bell-notif-time">{timeAgo(n.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="bell-dropdown-footer" onClick={handleViewAll}>
            See all notifications
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
