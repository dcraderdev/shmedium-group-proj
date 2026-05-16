from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from app.models import db, User
from app.models.notification import Notification
from sqlalchemy import desc

notification_routes = Blueprint('notifications', __name__)


@notification_routes.route('/')
@login_required
def get_notifications():
    """Return last 10 notifications and unread count for the current user."""
    notifications = (
        Notification.query
        .filter_by(user_id=current_user.id)
        .order_by(desc(Notification.created_at))
        .limit(10)
        .all()
    )
    unread_count = Notification.query.filter_by(user_id=current_user.id, read=False).count()
    return jsonify({
        'notifications': [n.to_dict() for n in notifications],
        'unreadCount': unread_count,
    })


@notification_routes.route('/all')
@login_required
def get_all_notifications():
    """Return full notification history for the current user."""
    notifications = (
        Notification.query
        .filter_by(user_id=current_user.id)
        .order_by(desc(Notification.created_at))
        .all()
    )
    unread_count = Notification.query.filter_by(user_id=current_user.id, read=False).count()
    return jsonify({
        'notifications': [n.to_dict() for n in notifications],
        'unreadCount': unread_count,
    })


@notification_routes.route('/read', methods=['PATCH'])
@login_required
def mark_all_read():
    """Mark all of the current user's notifications as read."""
    Notification.query.filter_by(user_id=current_user.id, read=False).update({'read': True})
    db.session.commit()
    return jsonify({'message': 'All notifications marked as read'})


@notification_routes.route('/<int:id>/read', methods=['PATCH'])
@login_required
def mark_one_read(id):
    """Mark a single notification as read."""
    notif = Notification.query.get(id)
    if not notif or notif.user_id != current_user.id:
        return jsonify({'error': 'Not found'}), 404
    notif.read = True
    db.session.commit()
    return jsonify(notif.to_dict())


@notification_routes.route('/digest', methods=['PATCH'])
@login_required
def update_digest():
    """Update the current user's digest frequency preference."""
    data = request.get_json()
    frequency = data.get('frequency', 'none')
    if frequency not in ('none', 'daily', 'weekly'):
        return jsonify({'error': 'Invalid frequency'}), 400

    user = User.query.get(current_user.id)
    user.digest_frequency = frequency
    if frequency != 'none':
        user.generate_unsubscribe_token()
    db.session.commit()
    return jsonify({'digestFrequency': user.digest_frequency})


@notification_routes.route('/unsubscribe/<token>')
def unsubscribe(token):
    """Unsubscribe from email digest via token (no login required)."""
    user = User.query.filter_by(unsubscribe_token=token).first()
    if not user:
        return jsonify({'error': 'Invalid token'}), 404
    user.digest_frequency = 'none'
    db.session.commit()
    return jsonify({'message': 'Successfully unsubscribed from digest emails'})
