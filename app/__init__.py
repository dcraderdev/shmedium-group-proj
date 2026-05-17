import os
import threading
from flask import Flask, render_template, request, session, redirect, make_response, jsonify
from flask_cors import CORS
from flask_migrate import Migrate
from flask_wtf.csrf import CSRFProtect, generate_csrf
from flask_login import LoginManager
from flask_compress import Compress
from .models import db, User, Story, Follower, Clap, Comment, StoryImage, Tag, StoryTag, SearchQuery, Bookmark, StoryHighlight
from .models.notification import Notification
from .api.user_routes import user_routes
from .api.auth_routes import auth_routes
from .api.story_routes import story_routes
from .api.comment_routes import comment_routes
from .api.follow_routes import follow_routes
from .api.search_routes import search_routes
from .api.bookmark_routes import bookmark_routes
from .api.highlight_routes import highlight_routes
from .api.notification_routes import notification_routes
from .seeds import seed_commands
from .email_digest import digest_commands
from .config import Config
from sqlalchemy.orm import joinedload, selectinload

app = Flask(__name__, static_folder='../react-app/build', static_url_path='/')

# Gzip/Brotli all text responses — 70-80% size reduction with no client changes
app.config['COMPRESS_REGISTER'] = True
app.config['COMPRESS_MIMETYPES'] = [
    'text/html', 'text/css', 'text/javascript',
    'application/javascript', 'application/json',
    'application/x-javascript', 'image/svg+xml',
]
app.config['COMPRESS_LEVEL'] = 6
Compress(app)

# Setup login manager
login = LoginManager(app)
login.login_view = 'auth.unauthorized'


@login.user_loader
def load_user(id):
    return User.query.get(int(id))


# Tell flask about our seed commands
app.cli.add_command(seed_commands)
app.cli.add_command(digest_commands)

app.config.from_object(Config)
app.register_blueprint(user_routes, url_prefix='/api/users')
app.register_blueprint(auth_routes, url_prefix='/api/auth')
app.register_blueprint(story_routes, url_prefix='/api/story')
app.register_blueprint(comment_routes, url_prefix='/api/comment')
app.register_blueprint(follow_routes, url_prefix='/api/follow')
app.register_blueprint(search_routes, url_prefix='/api/search')
app.register_blueprint(bookmark_routes, url_prefix='/api/story')
app.register_blueprint(highlight_routes, url_prefix='/api/story')
app.register_blueprint(notification_routes, url_prefix='/api/notifications')

db.init_app(app)
Migrate(app, db)

# Application Security
CORS(app)


@app.before_request
def https_redirect():
    if os.environ.get('FLASK_ENV') == 'production':
        if request.headers.get('X-Forwarded-Proto') == 'http':
            url = request.url.replace('http://', 'https://', 1)
            code = 301
            return redirect(url, code=code)


@app.after_request
def add_headers(response):
    # CSRF token cookie
    response.set_cookie(
        'csrf_token',
        generate_csrf(),
        secure=True if os.environ.get('FLASK_ENV') == 'production' else False,
        samesite='Strict' if os.environ.get('FLASK_ENV') == 'production' else None,
        httponly=True)

    # Cache-Control for content-hashed static assets (JS/CSS/media from CRA build)
    path = request.path
    if path.startswith('/static/') and any(
        path.startswith(p) for p in ('/static/js/', '/static/css/', '/static/media/')
    ):
        response.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    elif path == '/' or path.endswith('.html'):
        # SPA shell must never be stale — browser must revalidate
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'

    return response


@app.route("/api/docs")
def api_help():
    """
    Returns all API routes and their doc strings
    """
    acceptable_methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    route_list = { rule.rule: [[ method for method in rule.methods if method in acceptable_methods ],
                    app.view_functions[rule.endpoint].__doc__ ]
                    for rule in app.url_map.iter_rules() if rule.endpoint != 'static' }
    return route_list


@app.route("/api/init")
def initial_load():
    """Redirect to the story blueprint's cached initialize endpoint."""
    from app.api.story_routes import _FEED_CACHE, _build_feed_payload, _FEED_CACHE_TTL
    import time
    import app.api.story_routes as sr
    now = time.time()
    if sr._FEED_CACHE['data'] is None or (now - sr._FEED_CACHE['ts']) > _FEED_CACHE_TTL:
        sr._FEED_CACHE = {'data': _build_feed_payload(), 'ts': now}
    response = make_response(sr._FEED_CACHE['data'])
    response.headers['Cache-Control'] = 'public, max-age=60, stale-while-revalidate=30'
    return response


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def react_root(path):
    """
    This route will direct to the public directory in our
    react builds in the production environment for favicon
    or index.html requests
    """
    if path == 'medium-logo-circles-white.jpeg':
        return app.send_from_directory('public', 'medium-logo-circles-white.jpeg')
    return app.send_static_file('index.html')


@app.errorhandler(404)
def not_found(e):
    return app.send_static_file('index.html')


def _warmup_cache():
    """Pre-populate the feed cache on startup so the first real request is fast."""
    import time
    time.sleep(3)  # wait for DB connections to settle after Gunicorn fork
    try:
        with app.app_context():
            from app.api.story_routes import _build_feed_payload, _FEED_CACHE_TTL
            import app.api.story_routes as sr
            sr._FEED_CACHE = {'data': _build_feed_payload(), 'ts': time.time()}
    except Exception:
        pass  # non-fatal: first real request will cold-fill the cache


# Kick off cache warmup in the background so it doesn't block server startup
threading.Thread(target=_warmup_cache, daemon=True).start()
