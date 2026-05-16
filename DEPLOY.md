# Render Deployment Guide

Unified deploy: Flask serves both the API and the React build from one Render
Web Service. Postgres lives on Supabase. Images live on AWS S3.

> Architecture decision: see the README. Single URL, single deploy.

## Prereqs (Donovan to gather before starting)

You'll need values for these. Hand the whole bundle off in one go.

| Env var | Where to get it |
|---|---|
| `SUPABASE_DATABASE_URL` | Supabase dashboard → Project Settings → Database → Connection string → URI. Pick **"Use connection pooling"** if available; otherwise the direct URI works. Starts with `postgresql://`. |
| `AWS_ACCESS_KEY_ID` | IAM → Users → (your user) → Security credentials → Access keys |
| `AWS_SECRET_ACCESS_KEY` | Shown once at IAM key creation. Save it. |
| `AWS_BUCKET_NAME` | The bucket you created. |
| `AWS_REGION` | The region the bucket lives in (e.g. `us-east-1`). MUST match the bucket. |

### AWS S3 bucket setup checklist

1. Create the bucket (any region, but remember which one).
2. **Block Public Access**: turn OFF "Block all public access". Story images need to be publicly readable.
3. **Bucket Policy** — paste this (replace `YOUR_BUCKET`):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Sid": "PublicReadGetObject",
       "Effect": "Allow",
       "Principal": "*",
       "Action": "s3:GetObject",
       "Resource": "arn:aws:s3:::YOUR_BUCKET/*"
     }]
   }
   ```
4. **CORS** — only needed if React uploads directly. Our code uploads via Flask (server-side), so CORS is **not required**. Leave it default.
5. **IAM user** — create a user with programmatic access. Attach this inline policy (least-privilege, replace `YOUR_BUCKET`):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
       "Resource": "arn:aws:s3:::YOUR_BUCKET/*"
     }]
   }
   ```
6. Generate an access key for that user. Save `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.

### Supabase setup checklist

1. Create a new project. Pick a region close to where Render will deploy (Render free is in Oregon → match with `us-west-1` or `us-west-2` Supabase region).
2. Wait for the project to provision (~2 min).
3. Settings → Database → grab the connection string. Use the format starting with `postgresql://`.
4. **Schema name**: Supabase uses the `public` schema by default. The app's `SCHEMA` env var prefixes all tables. For this deploy, set `SCHEMA=shmedium_schema` — Alembic will create it automatically on first `flask db upgrade`.

## Render Web Service config

After pushing `portfolio-deploy` (this branch) to GitHub:

1. **Render dashboard → New → Web Service**.
2. **Connect** the `dcraderdev/shmedium-group-proj` repository. (Render will ask for GitHub permission the first time.)
3. **Branch**: `portfolio-deploy` (NOT `main` — we want to deploy the cleanup branch).
4. Fill in the form:

| Field | Value |
|---|---|
| **Name** | `shmedium` (or whatever) |
| **Region** | Oregon (US West) — closest to Supabase US West |
| **Branch** | `portfolio-deploy` |
| **Root Directory** | _leave blank_ |
| **Runtime** | `Python 3` |
| **Build Command** | _see below_ |
| **Start Command** | `gunicorn app:app` |
| **Instance Type** | **Free** |

### Build command (one line, paste exactly)

```bash
npm install --prefix react-app && NODE_OPTIONS=--openssl-legacy-provider npm run build --prefix react-app && pip install -r requirements.txt && pip install psycopg2-binary && flask db upgrade && flask seed all
```

Note: the original README used `pip install psycopg2`; that needs build tools. `psycopg2-binary` is the standard fix on Render free.

### Environment variables to set (Render → Advanced → Add Environment Variable)

Click "Generate Value" for `SECRET_KEY`. Paste the rest.

```
SECRET_KEY                = <click Render's Generate>
FLASK_APP                 = app
FLASK_ENV                 = production
DATABASE_URL              = <Supabase connection URI from prereqs>
SCHEMA                    = shmedium_schema
AWS_ACCESS_KEY_ID         = <from IAM>
AWS_SECRET_ACCESS_KEY     = <from IAM>
AWS_BUCKET_NAME           = <bucket name>
AWS_REGION                = <bucket region, e.g. us-east-1>
REACT_APP_BASE_URL        = https://<render-service-name>.onrender.com
PYTHON_VERSION            = 3.11.9
```

> `PYTHON_VERSION` matters: Render reads it (or the Pipfile setting) to pick the runtime. 3.11.x is the target.

> `REACT_APP_BASE_URL` matches the Render-assigned hostname. Render shows it at the top of the service page once created; you may need to redeploy once after setting this so the React build picks it up.

### Port

Render auto-detects from gunicorn — no manual port setting needed. (Flask binds to `$PORT` via gunicorn's defaults.)

## First deploy flow

1. Click **Create Web Service**. Render starts the first build (10-15 min — the `npm install` of CRA's 2,189 packages is the bottleneck).
2. Watch the **Logs** tab. Expect:
   - `npm install --prefix react-app` → ~3-5 min
   - `npm run build` → ~1-2 min (you should see "The build folder is ready to be deployed")
   - `pip install` → ~30 sec
   - `flask db upgrade` → migrations run (you should see "Running upgrade" lines)
   - `flask seed all` → seeds run, ending with `✅ Seeded 40 realistic articles…`
   - `gunicorn app:app` → service goes live
3. Visit the Render-assigned URL. The site should load.

## Auto-deploy

Render auto-deploys on every push to the configured branch (`portfolio-deploy`).
To turn this off (recommended for portfolio — avoids surprise rebuilds):
**Settings → Auto-Deploy → No**.

## Cold-start behavior (free tier)

Render free spins down after 15 minutes of no traffic. Cold start = ~30-60 seconds while the dyno boots, then everything works. The case study text on the portfolio site should acknowledge this so a cold-spun-down demo doesn't look broken.

## Troubleshooting cheat sheet

| Symptom | Likely cause | Fix |
|---|---|---|
| Build fails on `npm install` | Node version mismatch | Add env var `NODE_VERSION=18.x` |
| Build fails on `pip install psycopg2` | Missing build tools | Already fixed — we use `psycopg2-binary` |
| 500 on every request, logs show `relation … does not exist` | Migrations didn't run | Check build log; rerun build manually |
| 500 on signup/signin, logs show CSRF errors | `SECRET_KEY` not set or changed mid-session | Ensure `SECRET_KEY` is set; clear browser cookies |
| Image uploads 500 | AWS keys/bucket/region mismatch | Double-check all four `AWS_*` env vars; verify bucket policy allows `s3:PutObject` |
| Image uploads succeed but show broken | Region mismatch in URL | Confirm `AWS_REGION` matches actual bucket region |
| `/api/auth/` returns "Unauthorized" after signin | Cookie not being set | Confirm `FLASK_ENV=production` (enables `Secure` cookie flag over HTTPS) |

## Custom domain (optional, after live)

To wire up `shmedium.dcrader.dev`:

1. Render → service → Settings → Custom Domain → add `shmedium.dcrader.dev`.
2. Render shows a target hostname like `<service>.onrender.com` and a CNAME value.
3. In the DNS provider for `dcrader.dev`, add a CNAME: `shmedium` → `<value from Render>`.
4. Wait for Render to verify (usually within minutes; cert provisioning may take an extra few).
5. Update `REACT_APP_BASE_URL` to `https://shmedium.dcrader.dev` and trigger a manual redeploy so the React build embeds the new URL.
