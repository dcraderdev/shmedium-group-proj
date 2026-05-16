import os
from datetime import datetime, timedelta
from flask.cli import AppGroup
from flask import current_app

digest_commands = AppGroup('digest')


def _build_email_html(user, stories, base_url, frequency_label):
    unsubscribe_url = f"{base_url}/api/notifications/unsubscribe/{user.unsubscribe_token}"
    story_rows = ""
    for story in stories:
        story_url = f"{base_url}/story/{story.id}"
        clap_count = len(story.claps)
        author = story.author
        story_rows += f"""
        <tr>
          <td style="padding:16px 0;border-bottom:1px solid #e8e8e8;">
            <p style="margin:0 0 4px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px;">
              {author.first_name} {author.last_name}
            </p>
            <a href="{story_url}" style="font-size:18px;font-weight:700;color:#111;text-decoration:none;line-height:1.3;">
              {story.title}
            </a>
            <p style="margin:6px 0 0;font-size:13px;color:#666;">
              {story.sliced_intro or ''}
            </p>
            <p style="margin:8px 0 0;font-size:12px;color:#999;">
              {clap_count} clap{'s' if clap_count != 1 else ''} · {story.time_to_read or 5} min read
            </p>
          </td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#fec016;padding:24px 32px;">
            <span style="font-size:24px;font-weight:900;letter-spacing:-1px;">Shmedium</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 8px;">
            <h2 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#111;">
              Your {frequency_label} digest, {user.first_name}
            </h2>
            <p style="margin:0;font-size:14px;color:#888;">Stories from authors you follow</p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              {story_rows}
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f3f3f3;padding:20px 32px;font-size:12px;color:#999;text-align:center;">
            You're receiving this because you opted in to a {frequency_label} digest.<br>
            <a href="{unsubscribe_url}" style="color:#999;">Unsubscribe</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _send_digest_for_frequency(frequency):
    from app.models import db, User, Story, Follower
    from sqlalchemy.orm import selectinload, joinedload
    from app.models.story import Story
    from app.models.user import User
    from app.models.follower import Follower
    from app.models.clap import Clap

    sendgrid_key = os.environ.get('SENDGRID_API_KEY')
    from_email = os.environ.get('DIGEST_FROM_EMAIL', 'digest@shmedium.app')
    base_url = os.environ.get('APP_BASE_URL', 'https://shmedium.onrender.com')

    if frequency == 'daily':
        since = datetime.utcnow() - timedelta(days=1)
        label = 'daily'
    else:
        since = datetime.utcnow() - timedelta(weeks=1)
        label = 'weekly'

    users = User.query.filter(User.digest_frequency == frequency).all()
    print(f"[digest] Sending {label} digest to {len(users)} users")

    for user in users:
        if not user.unsubscribe_token:
            user.generate_unsubscribe_token()
            db.session.commit()

        followed_ids = [f.author_id for f in Follower.query.filter_by(follower_id=user.id).all()]
        if not followed_ids:
            continue

        stories = (
            Story.query
            .filter(Story.author_id.in_(followed_ids), Story.created_at >= since)
            .options(
                selectinload(Story.claps),
                selectinload(Story.author),
            )
            .all()
        )
        stories.sort(key=lambda s: len(s.claps), reverse=True)
        top_stories = stories[:5]

        if not top_stories:
            continue

        subject = f"{len(top_stories)} new {'story' if len(top_stories) == 1 else 'stories'} from authors you follow"
        html_body = _build_email_html(user, top_stories, base_url, label)

        if sendgrid_key:
            _send_via_sendgrid(sendgrid_key, from_email, user.email, subject, html_body)
        else:
            print(f"[digest] SENDGRID_API_KEY not set — would send to {user.email}: {subject}")


def _send_via_sendgrid(api_key, from_email, to_email, subject, html_body):
    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail, Email, To, Content
        sg = sendgrid.SendGridAPIClient(api_key=api_key)
        message = Mail(
            from_email=from_email,
            to_emails=to_email,
            subject=subject,
            html_content=html_body,
        )
        response = sg.send(message)
        print(f"[digest] Sent to {to_email}: {response.status_code}")
    except Exception as e:
        print(f"[digest] Failed to send to {to_email}: {e}")


@digest_commands.command('send-daily')
def send_daily():
    """Send daily digest emails."""
    _send_digest_for_frequency('daily')


@digest_commands.command('send-weekly')
def send_weekly():
    """Send weekly digest emails."""
    _send_digest_for_frequency('weekly')
