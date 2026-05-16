#!/usr/bin/env python3
"""Backfill responsive image variants for all story images in Supabase.

Strategy:
  - Pexels / Unsplash (and plus.unsplash.com): Imgix-powered CDNs.
    Construct 3 widths × 2 formats (JPEG + WebP) by rewriting URL query
    params (?w=NNN, ?fm=webp, etc.).  No S3 or network download required.
  - S3-hosted originals (file_name IS NOT NULL): download from S3, resize
    with Pillow, upload 6 variants.  Requires real AWS credentials.
  - Other CDNs (CNN, Hearst, Apple, iStock): populate variants with the
    original URL for all sizes (no resize possible without the binary).
    The srcset still fires — the browser just downloads the same image
    at every breakpoint, which is the same as the current behavior.

Result: every row in story_images gets variants_json set, so the frontend
<picture> + srcset markup activates for all 104 seed images immediately.

Usage:
    python scripts/backfill_image_variants.py           # full run (writes DB)
    python scripts/backfill_image_variants.py --dry-run  # verify without writing
    python scripts/backfill_image_variants.py --limit 10 # process first N images

Requires env vars (see .env):
    DATABASE_URL, SCHEMA, FLASK_ENV
    AWS_* only needed for S3-hosted images
"""
import sys
import os
import io
import json
import time
import argparse
import urllib.request
from urllib.parse import urlparse, urlunparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from app.models import db, StoryImage


# --------------------------------------------------------------------------
# CDN detection
# --------------------------------------------------------------------------

# Imgix-powered hosts — support ?w=NNN&fm=webp&q=NN natively
_IMGIX_HOSTS = {
    'images.pexels.com',
    'images.unsplash.com',
    'plus.unsplash.com',
}


def _is_imgix(url):
    host = urlparse(url).hostname or ''
    return host in _IMGIX_HOSTS


# --------------------------------------------------------------------------
# Variant URL construction (no S3 / no Pillow)
# --------------------------------------------------------------------------

def _imgix_variant(url, width, webp=False):
    """Return a resized variant URL using Imgix query params."""
    parsed = urlparse(url)

    # Parse existing query string into ordered list (preserve non-dimension params)
    params = {}
    for part in (parsed.query or '').split('&'):
        if '=' in part:
            k, v = part.split('=', 1)
            params[k] = v

    # Remove params we're replacing
    for k in ('w', 'h', 'dpr', 'fit', 'crop', 'fm', 'q', 'auto'):
        params.pop(k, None)

    params['w'] = str(width)
    if webp:
        params['fm'] = 'webp'
        params['q'] = '82'
    else:
        params['auto'] = 'compress'
        params['q'] = '85'

    query = '&'.join(f'{k}={v}' for k, v in params.items())
    return urlunparse(parsed._replace(query=query))


def construct_imgix_variants(url):
    return {
        name: {
            'jpeg': _imgix_variant(url, w, webp=False),
            'webp': _imgix_variant(url, w, webp=True),
            'width': w,
        }
        for name, w in [('thumbnail', 400), ('card', 800), ('full', 1600)]
    }


def construct_static_variants(url):
    """Fallback for non-resizable CDNs: same URL at all sizes."""
    return {
        name: {'jpeg': url, 'webp': url, 'width': w}
        for name, w in [('thumbnail', 400), ('card', 800), ('full', 1600)]
    }


# --------------------------------------------------------------------------
# S3 + Pillow path (for user-uploaded originals)
# --------------------------------------------------------------------------

def _s3_variants(img, dry_run):
    """Download from S3, generate Pillow variants, upload 6 objects."""
    try:
        from app.aws3 import s3, bucket, generate_image_variants
    except Exception as e:
        return f'fail:aws3-import:{e}'

    try:
        response = s3.get_object(Bucket=bucket, Key=img.file_name)
        file_bytes = response['Body'].read()
    except Exception as e:
        return f'fail:s3-download:{e}'

    if dry_run:
        try:
            from PIL import Image, ImageOps
            pil = Image.open(io.BytesIO(file_bytes))
            ImageOps.exif_transpose(pil).thumbnail((400, 400))
        except Exception as e:
            return f'fail:pillow:{e}'
        return 'ok:dry-run'

    try:
        result = generate_image_variants(file_bytes, img.file_name)
        if result is False:
            return 'skip:gif'
    except Exception as e:
        return f'fail:variant-gen:{e}'

    img.has_variants = True
    return 'ok'


# --------------------------------------------------------------------------
# Per-image processing
# --------------------------------------------------------------------------

def process_image(img, dry_run=False):
    if img.file_name:
        # S3-hosted original
        status = _s3_variants(img, dry_run)
        if status in ('ok', 'ok:dry-run'):
            if not dry_run:
                img.has_variants = True
                try:
                    db.session.commit()
                except Exception as e:
                    db.session.rollback()
                    return f'fail:db-commit:{e}'
        return status

    # External URL image
    url = img.url
    if _is_imgix(url):
        variants = construct_imgix_variants(url)
        strategy = 'imgix'
    else:
        variants = construct_static_variants(url)
        strategy = 'static'

    if not dry_run:
        img.variants_json = json.dumps(variants)
        img.has_variants = True
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            return f'fail:db-commit:{e}'

    return f'ok:{strategy}'


# --------------------------------------------------------------------------
# Main runner
# --------------------------------------------------------------------------

def run(dry_run=False, limit=None):
    with app.app_context():
        q = StoryImage.query.filter(StoryImage.has_variants.isnot(True))
        if limit:
            q = q.limit(limit)
        pending = q.all()

        total = len(pending)
        print(f"Images to process: {total}  (dry_run={dry_run})")
        if not total:
            print("Nothing to do — all images already have variants.")
            return

        counts = {}
        for i, img in enumerate(pending, 1):
            status = process_image(img, dry_run=dry_run)
            key = status.split(':')[0]
            counts[key] = counts.get(key, 0) + 1
            icon = '✓' if key == 'ok' else ('↷' if key == 'skip' else '✗')
            label = img.file_name or img.url[:70]
            print(f"[{i:4}/{total}] {icon}  {status:<20}  {label}")

        print(f"\nDone. {counts}")

        if not dry_run:
            # Final verification
            done = StoryImage.query.filter(StoryImage.has_variants == True).count()
            total_rows = StoryImage.query.count()
            print(f"DB state: {done}/{total_rows} images have variants")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--limit', type=int, default=None)
    args = parser.parse_args()
    run(dry_run=args.dry_run, limit=args.limit)
