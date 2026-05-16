import re
from datetime import datetime, timedelta
from app.models import db
from app.models.notification import Notification
from app.models.user import User

# Dedup window: don't re-notify if the same actor already triggered the same
# event on the same target within this many seconds.
_DEDUP_WINDOW_S = 3600


def create_notification(user_id, type, actor_id, target_type=None, target_id=None):
    """Create a notification, skipping self-notifications and recent duplicates."""
    if user_id == actor_id:
        return

    cutoff = datetime.utcnow() - timedelta(seconds=_DEDUP_WINDOW_S)
    exists = Notification.query.filter(
        Notification.user_id == user_id,
        Notification.type == type,
        Notification.actor_id == actor_id,
        Notification.target_type == target_type,
        Notification.target_id == target_id,
        Notification.created_at >= cutoff,
    ).first()
    if exists:
        return

    notif = Notification(
        user_id=user_id,
        type=type,
        actor_id=actor_id,
        target_type=target_type,
        target_id=target_id,
    )
    db.session.add(notif)


def notify_mentions(content, actor_id, story_id):
    """Parse @username mentions and create notifications, deduplicating per user."""
    seen = set()
    for username in re.findall(r'@(\w+)', content):
        if username in seen:
            continue
        seen.add(username)
        user = User.query.filter_by(username=username).first()
        if user:
            create_notification(
                user_id=user.id,
                type='mention',
                actor_id=actor_id,
                target_type='story',
                target_id=story_id,
            )
