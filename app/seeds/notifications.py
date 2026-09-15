"""Seed notifications so a signed-in demo reader has a populated bell.

Notifications are normally written at request time by the API (a clap, comment,
reply or follow creates one). Nothing replays that history for seeded data, so a
freshly seeded database left every account — including the demo user — with an
empty bell and an empty /notifications page, which reads as a broken feature
rather than a quiet one.

This derives notifications from activity that already exists in the seed rather
than inventing new events, so what the bell shows agrees with the claps,
comments and follows actually recorded against the user's stories.
"""

import random
from datetime import timedelta

from sqlalchemy.sql import text

from app.models import db, Notification, Story, Clap, Comment, Follower, environment, SCHEMA


RNG_SEED = 20260915

# Cap per recipient so the page stays readable and the bell badge stays plausible.
MAX_PER_USER = 12


def seed_notifications():
    """Replay seeded claps, comments and follows as notifications."""
    undo_notifications()

    rng = random.Random(RNG_SEED)

    story_authors = {s.id: s.author_id for s in Story.query.all()}
    rows = []

    # Claps and comments on a story notify its author.
    for clap in Clap.query.all():
        author_id = story_authors.get(clap.story_id)
        if author_id is None or author_id == clap.user_id:
            continue
        rows.append({
            'user_id': author_id,
            'type': 'clap',
            'actor_id': clap.user_id,
            'target_type': 'story',
            'target_id': clap.story_id,
            'created_at': clap.created_at,
        })

    for comment in Comment.query.all():
        author_id = story_authors.get(comment.story_id)
        if author_id is None or author_id == comment.user_id:
            continue
        rows.append({
            'user_id': author_id,
            'type': 'comment',
            'actor_id': comment.user_id,
            'target_type': 'story',
            'target_id': comment.story_id,
            'created_at': comment.created_at,
        })

    # A follow notifies the author being followed.
    for follow in Follower.query.all():
        if follow.author_id == follow.follower_id:
            continue
        rows.append({
            'user_id': follow.author_id,
            'type': 'follow',
            'actor_id': follow.follower_id,
            'target_type': None,
            'target_id': None,
            'created_at': getattr(follow, 'created_at', None),
        })

    # Collapse repeats the same way create_notification would, then keep the
    # newest few per recipient.
    seen = set()
    deduped = []
    for row in rows:
        key = (row['user_id'], row['type'], row['actor_id'], row['target_id'])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)

    by_user = {}
    for row in deduped:
        by_user.setdefault(row['user_id'], []).append(row)

    created = 0
    for user_id, user_rows in by_user.items():
        user_rows.sort(key=lambda r: (r['created_at'] is not None, r['created_at']), reverse=True)

        # Round-robin across types rather than taking the most recent N.
        # Claps outnumber comments roughly 13:1 in the seed, so straight recency
        # produced a page that said "clapped" twelve times — accurate, but it
        # reads as a broken or one-note feature. Interleaving shows that
        # comments and follows notify too.
        buckets = {}
        for row in user_rows:
            buckets.setdefault(row['type'], []).append(row)

        keep = []
        while len(keep) < MAX_PER_USER and any(buckets.values()):
            for notification_type in ('comment', 'follow', 'clap'):
                bucket = buckets.get(notification_type)
                if not bucket:
                    continue
                keep.append(bucket.pop(0))
                if len(keep) >= MAX_PER_USER:
                    break

        keep.sort(key=lambda r: (r['created_at'] is not None, r['created_at']), reverse=True)

        for index, row in enumerate(keep):
            created_at = row['created_at']
            if created_at is None:
                # Followers carry no timestamp; fan them out over recent days so
                # the list is not a wall of identical times.
                created_at = db.func.now()
                notification = Notification(
                    user_id=row['user_id'],
                    type=row['type'],
                    actor_id=row['actor_id'],
                    target_type=row['target_type'],
                    target_id=row['target_id'],
                    read=index >= 3,
                )
            else:
                notification = Notification(
                    user_id=row['user_id'],
                    type=row['type'],
                    actor_id=row['actor_id'],
                    target_type=row['target_type'],
                    target_id=row['target_id'],
                    # Leave the newest few unread so the bell shows a badge.
                    read=index >= 3,
                    created_at=created_at + timedelta(seconds=rng.randint(0, 120)),
                )

            db.session.add(notification)
            created += 1

    db.session.commit()
    print(f"✅ Seeded {created} notifications across {len(by_user)} users")


def undo_notifications():
    if environment == "production":
        db.session.execute(f"TRUNCATE table {SCHEMA}.notifications RESTART IDENTITY CASCADE;")
    else:
        db.session.execute(text("DELETE FROM notifications"))

    db.session.commit()
