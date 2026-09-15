from flask import Blueprint, jsonify, session, request
from app.models import User, db, Follower, Story, StoryTag, Comment
from app.forms import LoginForm
from app.forms import SignUpForm
from flask_login import current_user, login_user, logout_user, login_required
from sqlalchemy.orm import joinedload, selectinload


def _story_full_query():
    return Story.query.options(
        selectinload(Story.author).options(
            selectinload(User.followers),
            selectinload(User.following),
        ),
        selectinload(Story.tags).joinedload(StoryTag.tag),
        selectinload(Story.images),
        selectinload(Story.comments).options(
            joinedload(Comment.user),
            selectinload(Comment.claps),
        ),
        selectinload(Story.claps),
    )


def _session_story_lists(user_id):
    """Serialize the two story lists the client needs at sign-in.

    These feed the "Following" and "By you" tabs, which render the same tiles as
    the main feed — so they need the feed shape, not the full article. Building
    them with the full query meant eager-loading every comment, clap and
    follower for ~40 stories and shipping ~196KB over a cross-region link: the
    login round trip measured **13 seconds**, long enough that the demo button
    read as broken. Reusing the feed serializer plus one aggregate count query
    brings it in line with /api/story/initialize.
    """
    from app.api.story_routes import _story_feed_relations, _bulk_counts

    followings = Follower.query.filter_by(follower_id=user_id).all()
    followed_authors_ids = [f.author_id for f in followings]

    subscribed = (
        _story_feed_relations()
        .filter(Story.author_id.in_(followed_authors_ids))
        .all()
        if followed_authors_ids else []
    )
    own = _story_feed_relations().filter(Story.author_id == user_id).all()

    counts = _bulk_counts([s.id for s in subscribed] + [s.id for s in own])

    def serialize(story):
        c = counts.get(story.id, {})
        return story.to_dict_feed(
            clap_count=c.get('claps', 0),
            comment_count=c.get('comments', 0),
            bookmark_count=c.get('bookmarks', 0),
        )

    return {
        'subscribedStories': [serialize(s) for s in subscribed],
        'userStories': [serialize(s) for s in own],
        'followedAuthorIds': followed_authors_ids,
    }


auth_routes = Blueprint('auth', __name__)


def validation_errors_to_error_messages(validation_errors):
    """
    Simple function that turns the WTForms validation errors into a simple list
    """
    errorMessages = []
    for field in validation_errors:
        for error in validation_errors[field]:
            errorMessages.append(f'{field} : {error}')
    return errorMessages


@auth_routes.route('/')
def authenticate():
    """
    Authenticates a user.
    """
    if current_user.is_authenticated:
        return {
            'user': current_user.to_dict(),
            'status': 200,
            **_session_story_lists(current_user.id),
        }
    return {'errors': ['Unauthorized']}


@auth_routes.route('/login', methods=['POST'])
def login():
    """
    Logs a user in
    """
    form = LoginForm()
    # Get the csrf_token from the request cookie and put it into the
    # form manually to validate_on_submit can be used
    form['csrf_token'].data = request.cookies['csrf_token']
    if form.validate_on_submit():
        # Add the user to the session, we are logged in!
        user = User.query.filter(User.email == form.data['email']).first()
        login_user(user)

        return {
            'user': user.to_dict(),
            'status': 200,
            **_session_story_lists(user.id),
        }
    return {'errors': validation_errors_to_error_messages(form.errors)}, 401


@auth_routes.route('/logout', methods=['DELETE'])
def logout():
    """
    Logs a user out
    """
    logout_user()
    return {'message': 'User logged out'}


@auth_routes.route('/signup', methods=['POST'])
def sign_up():
    """
    Creates a new user and logs them in
    """
    form = SignUpForm()
    form['csrf_token'].data = request.cookies['csrf_token']
    if form.validate_on_submit():
        user = User(
            username=form.data['username'],
            email=form.data['email'],
            password=form.data['password'],
            first_name=form.data['first_name'],
            last_name=form.data['last_name'],
            profile_image=form.data['profile_image']
        )
        db.session.add(user)
        db.session.commit()
        login_user(user)
        return {'user': user.to_dict(), 'status': 202}
    return {'errors': validation_errors_to_error_messages(form.errors), 'status': 401}, 401


@auth_routes.route('/unauthorized')
def unauthorized():
    """
    Returns unauthorized JSON when flask-login authentication fails
    """
    return {'errors': ['Unauthorized']}, 401