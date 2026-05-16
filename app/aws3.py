import boto3
import io
import os
from dotenv import load_dotenv

load_dotenv()

AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
region = os.getenv("AWS_REGION", "us-east-1")
bucket = os.getenv("AWS_BUCKET_NAME", "well-done-proj")

s3 = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=region,
)

# (size_name, url_suffix, target_width_px)
_VARIANT_SIZES = [
    ('thumbnail', '400w', 400),
    ('card',      '800w', 800),
    ('full',      '1600w', 1600),
]


def generate_image_variants(file_bytes, base_filename):
    """Generate 3 widths × 2 formats (JPEG + WebP) from raw image bytes.

    Uploads all 6 variants to S3 under keys derived from *base_filename*:
        <stem>_400w.jpg / .webp
        <stem>_800w.jpg / .webp
        <stem>_1600w.jpg / .webp

    All objects get a 1-year immutable cache header so CDN / browsers can
    cache aggressively once the app switches to public URLs or a CDN.
    """
    from PIL import Image  # deferred so startup isn't slowed when Pillow absent

    stem = base_filename.rsplit('.', 1)[0]

    img = Image.open(io.BytesIO(file_bytes))

    # Flatten alpha channels so JPEG encoding never fails
    if img.mode in ('RGBA', 'LA', 'P'):
        if img.mode == 'P':
            img = img.convert('RGBA')
        bg = Image.new('RGB', img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1])
        img = bg
    elif img.mode != 'RGB':
        img = img.convert('RGB')

    for _name, suffix, target_width in _VARIANT_SIZES:
        if img.width > target_width:
            ratio = target_width / img.width
            resized = img.resize(
                (target_width, int(img.height * ratio)),
                Image.LANCZOS,
            )
        else:
            resized = img.copy()

        for fmt, ext, ctype in [('JPEG', 'jpg', 'image/jpeg'), ('WEBP', 'webp', 'image/webp')]:
            buf = io.BytesIO()
            save_kwargs = {'quality': 85, 'optimize': True} if fmt == 'JPEG' else {'quality': 82}
            resized.save(buf, format=fmt, **save_kwargs)
            s3.put_object(
                Bucket=bucket,
                Key=f"{stem}_{suffix}.{ext}",
                Body=buf.getvalue(),
                ContentType=ctype,
                CacheControl='max-age=31536000, immutable',
            )

    return True
