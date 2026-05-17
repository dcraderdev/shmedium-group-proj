# Shmedium

A Medium clone built as an App Academy capstone (May–Jun 2023). Flask + Postgres backend, React 17 + Redux frontend, AWS S3 for story images.

## Local development (Node 18+, Python 3.11)

1. Clone and install backend deps:

   ```bash
   pipenv install -r requirements.txt
   pipenv shell
   ```

2. Copy `.env.example` to `.env` and fill in values. Minimum to boot the backend against SQLite:

   ```bash
   cp .env.example .env
   ```

   The `SCHEMA` var is only needed in production (Postgres). For SQLite dev, leave it commented.

3. Run migrations and seed:

   ```bash
   flask db upgrade
   flask seed all
   flask run
   ```

4. In a second terminal, start the React app:

   ```bash
   cd react-app
   npm install
   npm start
   ```

   The npm scripts already set `NODE_OPTIONS=--openssl-legacy-provider`, which webpack 4 (react-scripts 4) needs on Node 17+.

5. For production Postgres, this project organizes all tables inside the `flask_schema` schema, defined by the `SCHEMA` environment variable. Replace the value with a unique name in **snake_case**.

See [`react-app/README.md`](./react-app/README.md) for more frontend-specific notes.


## Deployment (Fly.io)

The production backend runs on [Fly.io](https://fly.io) as a Dockerized
Flask + gunicorn service. Postgres lives on Supabase. Images live on AWS S3.

Live URL: **https://shmedium-api.fly.dev**

### Prerequisites

```bash
brew install flyctl
fly auth login
```

### Deploy

```bash
# First-time: provision the app
fly launch --no-deploy

# Set secrets (one-time, stored in Fly vault)
fly secrets set \
  SECRET_KEY=<generate_one> \
  DATABASE_URL=<supabase_pooler_url_port_6543> \
  AWS_ACCESS_KEY_ID=<key> \
  AWS_SECRET_ACCESS_KEY=<secret>

# Build image + deploy
fly deploy
```

The `fly.toml` at the repo root declares region, VM size, and non-secret env
vars (`FLASK_APP`, `FLASK_ENV`, `SCHEMA`). The `Dockerfile` handles building
the React app and packaging it with Flask.

### Run migrations

```bash
fly ssh console -C "flask db upgrade heads"
```

### Environment variables

| Key | Where to set |
|-----|--------------|
| `SECRET_KEY` | `fly secrets set` |
| `DATABASE_URL` | `fly secrets set` (Supabase pooler, port 6543) |
| `AWS_ACCESS_KEY_ID` | `fly secrets set` |
| `AWS_SECRET_ACCESS_KEY` | `fly secrets set` |
| `AWS_BUCKET_NAME` | `fly.toml` `[env]` section |
| `AWS_REGION` | `fly.toml` `[env]` section |
| `SCHEMA` | `fly.toml` `[env]` section (currently `shmedium_schema`) |