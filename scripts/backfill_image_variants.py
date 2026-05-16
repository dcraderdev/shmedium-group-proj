#!/usr/bin/env python3
"""Backfill image variants for the 104 existing S3 story images.

Run from the project root after applying the migration:

    python scripts/backfill_image_variants.py

Requires the same .env / environment variables the Flask app uses:
    AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_BUCKET_NAME,
    DATABASE_URL (or FLASK_ENV + DB connection vars used by Config).

The script is idempotent — re-running it skips images already processed.
"""
import sys
import os

# Allow imports from the project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from app.models import db, StoryImage
from app.aws3 import s3, bucket, generate_image_variants


def run():
    with app.app_context():
        pending = StoryImage.query.filter(
            StoryImage.has_variants.isnot(True),
            StoryImage.file_name.isnot(None),
            StoryImage.url.like('https://well-done%'),
        ).all()

        total = len(pending)
        print(f"Images to backfill: {total}")
        if not total:
            print("Nothing to do.")
            return

        ok = 0
        fail = 0
        for i, img in enumerate(pending, 1):
            try:
                response = s3.get_object(Bucket=bucket, Key=img.file_name)
                file_bytes = response['Body'].read()
                generate_image_variants(file_bytes, img.file_name)
                img.has_variants = True
                db.session.commit()
                ok += 1
                print(f"[{i}/{total}] OK   {img.file_name}")
            except Exception as exc:
                db.session.rollback()
                fail += 1
                print(f"[{i}/{total}] FAIL {img.file_name}: {exc}")

        print(f"\nDone. {ok} succeeded, {fail} failed.")


if __name__ == '__main__':
    run()
