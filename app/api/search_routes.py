import re
import html as _html
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from sqlalchemy import or_, func, distinct
from sqlalchemy.orm import joinedload, selectinload
from app.models import db, Story, Tag, StoryTag, User, Comment, Clap, StoryImage, Follower
from app.models.search_query import SearchQuery

search_routes = Blueprint('search', __name__)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _eager_options():
    return [
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
    ]


def _is_postgres():
    return 'postgresql' in str(db.engine.url)


def _build_tsv():
    """Weighted tsvector: title=A (higher), body=B."""
    return (
        func.setweight(func.to_tsvector('english', func.coalesce(Story.title, '')), 'A')
        .op('||')(
            func.setweight(func.to_tsvector('english', func.coalesce(Story.content, '')), 'B')
        )
    )


def _log_search(query):
    try:
        key = query.lower()[:255]
        existing = SearchQuery.query.filter_by(query=key).first()
        if existing:
            existing.count += 1
            existing.last_searched_at = datetime.utcnow()
        else:
            db.session.add(SearchQuery(
                query=key, count=1, last_searched_at=datetime.utcnow(),
            ))
        db.session.commit()
    except Exception:
        db.session.rollback()


_TAG_RE = re.compile(r'<[^>]+>')


def _strip_html(text):
    """Replace HTML tags with spaces and collapse whitespace."""
    return ' '.join(_TAG_RE.sub(' ', text).split())


def _highlight(text_content, query):
    """HTML-escape text, then wrap query terms in <mark> tags."""
    if not text_content:
        return ''
    escaped = _html.escape(text_content)
    if not query:
        return escaped
    terms = sorted({t for t in query.split() if t}, key=len, reverse=True)
    if not terms:
        return escaped
    # Escape query terms before building the regex so they match the escaped text
    pattern = re.compile(
        r'(' + '|'.join(re.escape(_html.escape(t)) for t in terms) + r')',
        re.IGNORECASE,
    )
    return pattern.sub(r'<mark>\1</mark>', escaped)


def _get_snippet(content, query, max_len=220):
    """Extract a plain-text snippet centred on the first matching term."""
    if not content:
        return ''
    text = _strip_html(content)
    if not query:
        return text[:max_len] + ('…' if len(text) > max_len else '')
    lower = text.lower()
    for term in query.split():
        idx = lower.find(term.lower())
        if idx >= 0:
            start = max(0, idx - 80)
            end = min(len(text), idx + 140)
            snippet = text[start:end]
            if start > 0:
                snippet = '…' + snippet
            if end < len(text):
                snippet += '…'
            return snippet
    return text[:max_len] + ('…' if len(text) > max_len else '')


def _story_to_search_dict(story, query):
    d = story.to_dict()
    snippet = _get_snippet(story.content, query)
    d['snippet'] = _highlight(snippet, query)
    d['titleHighlighted'] = _highlight(story.title, query)
    return d


# ── Count helpers (fast — no eager loading, no OFFSET) ───────────────────────

def _count_stories(query, terms):
    if _is_postgres():
        ts_q = func.websearch_to_tsquery('english', query)
        return Story.query.filter(_build_tsv().op('@@')(ts_q)).count()
    conds = [Story.title.ilike(f'%{t}%') | Story.content.ilike(f'%{t}%') for t in terms]
    return Story.query.filter(or_(*conds)).count()


def _count_authors(terms):
    conds = [
        User.first_name.ilike(f'%{t}%') |
        User.last_name.ilike(f'%{t}%') |
        User.username.ilike(f'%{t}%')
        for t in terms
    ]
    return User.query.filter(or_(*conds)).count()


def _get_matching_tags(terms):
    """Return list of Tag objects matching query terms."""
    conds = [Tag.tag.ilike(f'%{t}%') for t in terms]
    return Tag.query.filter(or_(*conds)).all()


def _tagged_story_ids_subq(tag_ids):
    """Subquery that returns distinct story IDs matching the given tag IDs."""
    return (
        db.session.query(Story.id)
        .join(StoryTag, StoryTag.story_id == Story.id)
        .filter(StoryTag.tag_id.in_(tag_ids))
        .distinct()
        .subquery()
    )


def _count_tagged_stories(tag_ids):
    if not tag_ids:
        return 0
    subq = _tagged_story_ids_subq(tag_ids)
    return db.session.query(func.count()).select_from(subq).scalar()


# ── Fetch helpers (with eager loading + pagination) ───────────────────────────

def _fetch_stories(query, terms, page, per_page, eager):
    if _is_postgres():
        ts_q = func.websearch_to_tsquery('english', query)
        tsv = _build_tsv()
        base = (
            Story.query.options(*eager)
            .filter(tsv.op('@@')(ts_q))
            .order_by(func.ts_rank_cd(tsv, ts_q).desc(), Story.created_at.desc())
        )
    else:
        conds = [Story.title.ilike(f'%{t}%') | Story.content.ilike(f'%{t}%') for t in terms]
        base = (
            Story.query.options(*eager)
            .filter(or_(*conds))
            .order_by(Story.created_at.desc())
        )
    return base.offset((page - 1) * per_page).limit(per_page).all()


def _fetch_authors(terms, page, per_page):
    conds = [
        User.first_name.ilike(f'%{t}%') |
        User.last_name.ilike(f'%{t}%') |
        User.username.ilike(f'%{t}%')
        for t in terms
    ]
    return (
        User.query
        .options(selectinload(User.followers), selectinload(User.following))
        .filter(or_(*conds))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )


def _fetch_tagged_stories(tag_ids, page, per_page, eager):
    """Use a subquery for distinct story IDs to avoid DISTINCT+ORDER BY conflicts."""
    subq = _tagged_story_ids_subq(tag_ids)
    return (
        Story.query.options(*eager)
        .filter(Story.id.in_(subq))
        .order_by(Story.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@search_routes.route('', strict_slashes=False)
def search():
    query = request.args.get('q', '').strip()
    type_filter = request.args.get('type', '')  # stories | authors | tags
    page = max(1, int(request.args.get('page', 1)))
    per_page = min(50, max(1, int(request.args.get('per_page', 20))))

    if not query:
        return jsonify({
            'search': '',
            'stories': [], 'authors': [], 'taggedStories': [], 'tags': [],
            'totalStories': 0, 'totalAuthors': 0,
            'totalTags': 0, 'totalTaggedStories': 0,
            'page': 1, 'perPage': per_page,
        })

    _log_search(query)
    terms = [t for t in query.split() if t]
    eager = _eager_options()

    # Always compute all 3 counts so filter pills are always populated.
    total_stories = _count_stories(query, terms)
    total_authors = _count_authors(terms)
    matching_tags = _get_matching_tags(terms)
    tag_ids = [t.id for t in matching_tags]
    total_tags = len(matching_tags)           # distinct matching tags
    total_tagged = _count_tagged_stories(tag_ids)  # stories bearing those tags

    # Fetch full paginated results only for the active tab.
    stories, authors, tagged_stories = [], [], []

    if not type_filter or type_filter == 'stories':
        stories = _fetch_stories(query, terms, page, per_page, eager)
    if not type_filter or type_filter == 'authors':
        authors = _fetch_authors(terms, page, per_page)
    if not type_filter or type_filter == 'tags':
        if tag_ids:
            tagged_stories = _fetch_tagged_stories(tag_ids, page, per_page, eager)

    return jsonify({
        'search': query,
        'stories': [_story_to_search_dict(s, query) for s in stories],
        'authors': [a.to_dict() for a in authors],
        'taggedStories': [_story_to_search_dict(s, query) for s in tagged_stories],
        'tags': [t.to_dict() for t in matching_tags],
        'totalStories': total_stories,
        'totalAuthors': total_authors,
        'totalTags': total_tags,
        'totalTaggedStories': total_tagged,
        'page': page,
        'perPage': per_page,
    })


@search_routes.route('/suggest', strict_slashes=False)
def suggest():
    """Typeahead: top 5 stories + top 3 authors + top 3 tags."""
    query = request.args.get('q', '').strip()
    if not query or len(query) < 2:
        return jsonify({'stories': [], 'authors': [], 'tags': []})

    terms = [t for t in query.split() if t]
    eager_min = [selectinload(Story.author), selectinload(Story.images)]

    if _is_postgres():
        ts_q = func.websearch_to_tsquery('english', query)
        tsv = _build_tsv()
        stories = (
            Story.query.options(*eager_min)
            .filter(tsv.op('@@')(ts_q))
            .order_by(func.ts_rank_cd(tsv, ts_q).desc())
            .limit(5)
            .all()
        )
    else:
        conds = [Story.title.ilike(f'%{t}%') for t in terms]
        stories = (
            Story.query.options(*eager_min)
            .filter(or_(*conds))
            .order_by(Story.created_at.desc())
            .limit(5)
            .all()
        )

    author_conds = [
        User.first_name.ilike(f'%{t}%') |
        User.last_name.ilike(f'%{t}%') |
        User.username.ilike(f'%{t}%')
        for t in terms
    ]
    authors = User.query.filter(or_(*author_conds)).limit(3).all()

    tag_conds = [Tag.tag.ilike(f'%{t}%') for t in terms]
    tags = Tag.query.filter(or_(*tag_conds)).limit(3).all()

    return jsonify({
        'stories': [
            {'id': s.id, 'title': s.title,
             'authorName': f"{s.author.first_name} {s.author.last_name}"}
            for s in stories
        ],
        'authors': [
            {'id': a.id, 'name': f"{a.first_name} {a.last_name}", 'username': a.username}
            for a in authors
        ],
        'tags': [{'id': t.id, 'tag': t.tag} for t in tags],
    })


@search_routes.route('/popular', strict_slashes=False)
def popular_searches():
    """Top searches from the last 7 days."""
    cutoff = datetime.utcnow() - timedelta(days=7)
    popular = (
        SearchQuery.query
        .filter(SearchQuery.last_searched_at >= cutoff)
        .order_by(SearchQuery.count.desc())
        .limit(10)
        .all()
    )
    return jsonify({'queries': [sq.to_dict() for sq in popular]})
