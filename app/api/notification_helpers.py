import re
from app.models import db
from app.models.notification import Notification
from app.models.user import User


def create_notification(user_id, type, actor_id, target_type=None, target_id=None):
    """Create a notification, skipping self-notifications."""
    if user_id == actor_id:
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
    """Parse @username mentions in comment content and create notifications."""
    mentions = re.findall(r'@(\w+)', content)
    for username in mentions:
        user = User.query.filter_by(username=username).first()
        if user:
            create_notification(
                user_id=user.id,
                type='mention',
                actor_id=actor_id,
                target_type='story',
                target_id=story_id,
            )
