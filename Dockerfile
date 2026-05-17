# ── Stage 1: build React ────────────────────────────────────────────
FROM node:18-slim AS react-builder
WORKDIR /build
COPY react-app/package*.json ./
RUN npm install
COPY react-app/ ./
ENV NODE_OPTIONS=--openssl-legacy-provider
ENV CI=false
RUN npm run build

# ── Stage 2: Flask / gunicorn ────────────────────────────────────────
FROM python:3.11-slim
WORKDIR /app

# psycopg2 needs libpq-dev; gcc for any C-ext wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt psycopg2-binary

# Flask application package + migrations
COPY app/ ./app/
COPY migrations/ ./migrations/

# React production build (served as Flask static files)
COPY --from=react-builder /build/build ./react-app/build

ENV FLASK_APP=app
ENV FLASK_ENV=production

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--timeout", "120", "app:app"]
