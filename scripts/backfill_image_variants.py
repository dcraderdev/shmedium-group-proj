#!/usr/bin/env python3
"""Backfill image variants for existing story images.

Handles two cases:
  1. S3-hosted images (file_name IS NOT NULL): download original from S3,
     generate 6 variants (3 widths × JPEG + WebP), upload variants, mark done.
  2. External-URL images (file_name IS NULL, e.g. Pexels seeds): download via
     HTTP, upload original to S3, generate 6 variants, update url + file_name,
     mark done.

Usage:
    python scripts/backfill_image_variants.py           # process all pending
    python scripts/backfill_image_variants.py --dry-run  # download + process but don't write to S3/DB

Requires env vars (see .env):
    DATABASE_URL, SCHEMA, FLASK_ENV,
    AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_BUCKET_NAME, AWS_REGION
"""
import sys
import os
import io
import time
import urllib.request
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from app.models import db, StoryImage
from app.aws3 import s3, bucket, generate_image_variants


def _fetch_bytes(url, timeout=30):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read(), resp.headers.get('Content-Type', 'image/jpeg')


def _ext_from_filename(filename):
    return filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'jpg'


def _ext_from_content_type(ct):
    mapping = {'image/jpeg': 'jpg', 'image/png': 'png',
               'image/webp': 'webp', 'image/gif': 'gif'}
    base = ct.split(';')[0].strip()
    return mapping.get(base, 'jpg')


def _ext_from_url(url):
    path = url.split('?')[0].split('/')[-1]
    if '.' in path:
        return path.rsplit('.', 1)[-1].lower()
    return ''


def process_image(img, dry_run=False):
    """Download, upload (if needed), and generate variants for one StoryImage.

    Returns 'ok', 'skip', or 'fail:<reason>'.
    """
    file_bytes = None
    filename = img.file_name

    if filename:
        # Already on S3 — download original
        try:
            response = s3.get_object(Bucket=bucket, Key=filename)
            file_bytes = response['Body'].read()
        except Exception as e:
            return f'fail:s3-download:{e}'
    else:
        # External URL — download via HTTP
        url = img.url
        try:
            file_bytes, content_type = _fetch_bytes(url)
        except Exception as e:
            return f'fail:http-download:{e}'

        # Derive a deterministic S3 key from the image id + URL extension
        ext = _ext_from_url(url) or _ext_from_content_type(content_type)
        filename = f"seed_image_{img.id}_{int(time.time())}.{ext}"

        if not dry_run:
            # Upload original to S3
            try:
                s3.put_object(
                    Bucket=bucket,
                    Key=filename,
                    Body=file_bytes,
                    ContentType=content_type,
                    CacheControl='max-age=31536000, immutable',
                )
            except Exception as e:
                return f'fail:s3-upload-original:{e}'

            img.url = f"https://{bucket}.s3.{os.getenv('AWS_REGION','us-east-1')}.amazonaws.com/{filename}"
            img.file_name = filename

    if not dry_run:
        try:
            result = generate_image_variants(file_bytes, filename)
            if result is False:
                return 'skip:gif'
        except Exception as e:
            return f'fail:variant-gen:{e}'

        img.has_variants = True
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            return f'fail:db-commit:{e}'
    else:
        # Dry-run: just test that we can open and resize the image
        try:
            from PIL import Image, ImageOps
            pil = Image.open(io.BytesIO(file_bytes))
            pil = ImageOps.exif_transpose(pil)
            pil.thumbnail((400, 400))
        except Exception as e:
            return f'fail:pillow:{e}'

    return 'ok'


def run(dry_run=False):
    with app.app_context():
        pending = StoryImage.query.filter(
            StoryImage.has_variants.isnot(True),
        ).all()

        total = len(pending)
        print(f"Images to process: {total}  (dry_run={dry_run})")
        if not total:
            print("Nothing to do.")
            return

        counts = {'ok': 0, 'skip': 0, 'fail': 0}
        for i, img in enumerate(pending, 1):
            status = process_image(img, dry_run=dry_run)
            category = status.split(':')[0]
            counts[category] = counts.get(category, 0) + 1
            icon = '✓' if category == 'ok' else ('↷' if category == 'skip' else '✗')
            label = img.file_name or img.url[:60]
            print(f"[{i:4}/{total}] {icon} id={img.id:4}  {status:<20}  {label}")

        print(f"\nDone. ok={counts.get('ok',0)}  skip={counts.get('skip',0)}  fail={counts.get('fail',0)}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true',
                        help='Download and process images but do not write to S3 or DB')
    args = parser.parse_args()
    run(dry_run=args.dry_run)
