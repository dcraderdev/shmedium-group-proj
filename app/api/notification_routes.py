import os
import hmac as _hmac
from flask import Blueprint, jsonify, request, redirect, make_response
from flask_login import login_required, current_user
from app.models import db, User
from app.models.notification import Notification
from sqlalchemy import desc
import base64
import hashlib

notification_routes = Blueprint('notifications', __name__)

# 1×1 transparent GIF bytes
_PIXEL_GIF = (
    b'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00'
    b'\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x00\x00\x00\x00'
    b'\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02'
    b'\x44\x01\x00\x3b'
)


def _make_track_token(user_id):
    secret = os.environ.get('SECRET_KEY', 'dev-secret').encode()
    id_b64 = base64.urlsafe_b64encode(str(user_id).encode()).rstrip(b'=').decode()
    mac = _hmac.new(secret, str(user_id).encode(), hashlib.sha256).hexdigest()[:16]
    return f"{id_b64}.{mac}"


def _user_from_track_token(token):
    try:
        id_b64, _ = token.split('.', 1)
        padding = (4 - len(id_b64) % 4) % 4
        user_id = int(base64.urlsafe_b64decode(id_b64 + '=' * padding).decode())
    except Exception:
        return None
    expected = _make_track_token(user_id)
    if not _hmac.compare_digest(token, expected):
        return None
    return User.query.get(user_id)


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
    """Unsubscribe from email digest via token (no login required). Returns HTML."""
    user = User.query.filter_by(unsubscribe_token=token).first()
    if not user:
        html = _unsubscribe_html(success=False)
        return make_response(html, 404)
    user.digest_frequency = 'none'
    db.session.commit()
    html = _unsubscribe_html(success=True, name=user.first_name)
    return make_response(html, 200)


@notification_routes.route('/digest/track/open/<token>')
def track_open(token):
    """Email open tracking pixel. Returns a 1×1 transparent GIF."""
    user = _user_from_track_token(token)
    if user:
        print(f"[digest-track] open uid={user.id}")
    resp = make_response(_PIXEL_GIF)
    resp.headers['Content-Type'] = 'image/gif'
    resp.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return resp


@notification_routes.route('/digest/track/click/<token>')
def track_click(token):
    """Email click tracking redirect."""
    url = request.args.get('url', '/')
    base_url = os.environ.get('APP_BASE_URL', 'https://shmedium.onrender.com').rstrip('/')
    if not (url.startswith('/') or url.startswith(base_url)):
        url = '/'
    user = _user_from_track_token(token)
    if user:
        print(f"[digest-track] click uid={user.id} url={url}")
    return redirect(url)


def _unsubscribe_html(success, name=''):
    if success:
        heading = f"You've been unsubscribed, {name}."
        body = "You won't receive any more digest emails from Shmedium."
    else:
        heading = "Invalid unsubscribe link."
        body = "This link may have already been used or is no longer valid."
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Unsubscribe — Shmedium</title>
  <style>
    body{{margin:0;padding:0;background:#f9f9f9;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;min-height:100vh}}
    .card{{background:#fff;border-radius:6px;box-shadow:0 2px 12px rgba(0,0,0,.1);padding:48px 40px;max-width:480px;text-align:center}}
    .logo{{font-size:22px;font-weight:900;background:#fec016;display:inline-block;padding:8px 18px;border-radius:4px;margin-bottom:28px}}
    h1{{font-size:22px;font-weight:700;margin:0 0 12px;color:#111}}
    p{{font-size:15px;color:#666;margin:0 0 24px;line-height:1.6}}
    a{{color:#111;font-weight:600;font-size:14px}}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Shmedium</div>
    <h1>{heading}</h1>
    <p>{body}</p>
    <a href="/">Back to Shmedium</a>
  </div>
</body>
</html>"""
