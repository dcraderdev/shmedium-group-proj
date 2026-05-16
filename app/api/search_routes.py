import re
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from sqlalchemy import or_, func
from sqlalchemy.orm import joinedload, selectinload
from app.models import db, Story, Tag, StoryTag, User, Comment, Clap, StoryImage, Follower
from app.models.search_query import SearchQuery

search_routes = Blueprint('search', __name__)


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


def _log_search(query):
    try:
        key = query.lower()[:255]
        existing = SearchQuery.query.filter_by(query=key).first()
        if existing:
            existing.count += 1
            existing.last_searched_at = datetime.utcnow()
        else:
            db.session.add(SearchQuery(
                query=key,
                count=1,
                last_searched_at=datetime.utcnow(),
            ))
        db.session.commit()
    except Exception:
        db.session.rollback()


def _highlight(text_content, query):
    """Wrap matching query terms in <mark> tags, single-pass, case-insensitive."""
    if not text_content or not query:
        return text_content or ''
    terms = sorted({t for t in query.split() if t}, key=len, reverse=True)
    if not terms:
        return text_content
    pattern = re.compile(
        r'(' + '|'.join(re.escape(t) for t in terms) + r')',
        re.IGNORECASE,
    )
    return pattern.sub(r'<mark>\1</mark>', text_content)


def _get_snippet(content, query, max_len=200):
    """Extract a snippet from content centred on the first matching term."""
    if not content:
        return ''
    if not query:
        return content[:max_len] + ('...' if len(content) > max_len else '')
    lower = content.lower()
    for term in query.split():
        idx = lower.find(term.lower())
        if idx >= 0:
            start = max(0, idx - 80)
            end = min(len(content), idx + 120)
            snippet = content[start:end]
            if start > 0:
                snippet = '...' + snippet
            if end < len(content):
                snippet += '...'
            return snippet
    return content[:max_len] + ('...' if len(content) > max_len else '')


def _story_to_search_dict(story, query):
    d = story.to_dict()
    snippet = _get_snippet(story.content, query)
    d['snippet'] = _highlight(snippet, query)
    d['titleHighlighted'] = _highlight(story.title, query)
    return d


def _run_story_fts(query, page, per_page, eager):
    """Return (stories_page, total) using the right backend."""
    if _is_postgres():
        ts_q = func.websearch_to_tsquery('english', query)
        tsv = func.setweight(
            func.to_tsvector('english', func.coalesce(Story.title, '')), 'A'
        ).op('||')(
            func.setweight(
                func.to_tsvector('english', func.coalesce(Story.content, '')), 'B'
            )
        )
        rank = func.ts_rank_cd(tsv, ts_q)
        base = Story.query.options(*eager).filter(
            tsv.op('@@')(ts_q)
        ).order_by(rank.desc(), Story.created_at.desc())
    else:
        terms = query.split()
        conds = [Story.title.ilike(f'%{t}%') | Story.content.ilike(f'%{t}%') for t in terms]
        base = Story.query.options(*eager).filter(or_(*conds)).order_by(Story.created_at.desc())

    total = base.count()
    items = base.offset((page - 1) * per_page).limit(per_page).all()
    return items, total


def _run_author_search(query, page, per_page):
    terms = query.split()
    conds = [
        User.first_name.ilike(f'%{t}%') |
        User.last_name.ilike(f'%{t}%') |
        User.username.ilike(f'%{t}%')
        for t in terms
    ]
    base = User.query.options(
        selectinload(User.followers),
        selectinload(User.following),
    ).filter(or_(*conds))
    total = base.count()
    items = base.offset((page - 1) * per_page).limit(per_page).all()
    return items, total


def _run_tag_search(query, page, per_page, eager):
    terms = query.split()
    tag_conds = [Tag.tag.ilike(f'%{t}%') for t in terms]
    matching_tags = Tag.query.filter(or_(*tag_conds)).all()
    tag_ids = [t.id for t in matching_tags]

    tagged_stories = []
    total = 0
    if tag_ids:
        base = Story.query.options(*eager).join(StoryTag).filter(
            StoryTag.tag_id.in_(tag_ids)
        ).order_by(Story.created_at.desc())
        total = base.count()
        tagged_stories = base.offset((page - 1) * per_page).limit(per_page).all()

    return matching_tags, tagged_stories, total


@search_routes.route('/')
def search():
    query = request.args.get('q', '').strip()
    type_filter = request.args.get('type', '')   # stories | authors | tags
    page = max(1, int(request.args.get('page', 1)))
    per_page = min(50, max(1, int(request.args.get('per_page', 20))))

    if not query:
        return jsonify({
            'search': '',
            'stories': [], 'authors': [], 'taggedStories': [], 'tags': [],
            'totalStories': 0, 'totalAuthors': 0, 'totalTags': 0,
            'page': 1, 'perPage': per_page,
        })

    _log_search(query)
    eager = _eager_options()

    stories, total_stories = [], 0
    authors, total_authors = [], 0
    tags, tagged_stories, total_tags = [], [], 0

    want_stories = not type_filter or type_filter == 'stories'
    want_authors = not type_filter or type_filter == 'authors'
    want_tags = not type_filter or type_filter == 'tags'

    if want_stories:
        stories, total_stories = _run_story_fts(query, page, per_page, eager)
    if want_authors:
        authors, total_authors = _run_author_search(query, page, per_page)
    if want_tags:
        tags, tagged_stories, total_tags = _run_tag_search(query, page, per_page, eager)

    return jsonify({
        'search': query,
        'stories': [_story_to_search_dict(s, query) for s in stories],
        'authors': [a.to_dict() for a in authors],
        'taggedStories': [_story_to_search_dict(s, query) for s in tagged_stories],
        'tags': [t.to_dict() for t in tags],
        'totalStories': total_stories,
        'totalAuthors': total_authors,
        'totalTags': total_tags,
        'page': page,
        'perPage': per_page,
    })


@search_routes.route('/suggest')
def suggest():
    """Typeahead: top 5 stories + top 3 authors + top 3 tags."""
    query = request.args.get('q', '').strip()
    if not query or len(query) < 2:
        return jsonify({'stories': [], 'authors': [], 'tags': []})

    eager_min = [selectinload(Story.author), selectinload(Story.images)]

    if _is_postgres():
        ts_q = func.websearch_to_tsquery('english', query)
        tsv = func.setweight(
            func.to_tsvector('english', func.coalesce(Story.title, '')), 'A'
        ).op('||')(
            func.setweight(
                func.to_tsvector('english', func.coalesce(Story.content, '')), 'B'
            )
        )
        stories = Story.query.options(*eager_min).filter(
            tsv.op('@@')(ts_q)
        ).order_by(func.ts_rank_cd(tsv, ts_q).desc()).limit(5).all()
    else:
        terms = query.split()
        conds = [Story.title.ilike(f'%{t}%') for t in terms]
        stories = Story.query.options(*eager_min).filter(
            or_(*conds)
        ).order_by(Story.created_at.desc()).limit(5).all()

    terms = query.split()
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
            {
                'id': s.id,
                'title': s.title,
                'authorName': f"{s.author.first_name} {s.author.last_name}",
            }
            for s in stories
        ],
        'authors': [
            {'id': a.id, 'name': f"{a.first_name} {a.last_name}", 'username': a.username}
            for a in authors
        ],
        'tags': [{'id': t.id, 'tag': t.tag} for t in tags],
    })


@search_routes.route('/popular')
def popular_searches():
    """Return top searches from the last 7 days."""
    cutoff = datetime.utcnow() - timedelta(days=7)
    popular = (
        SearchQuery.query
        .filter(SearchQuery.last_searched_at >= cutoff)
        .order_by(SearchQuery.count.desc())
        .limit(10)
        .all()
    )
    return jsonify({'queries': [sq.to_dict() for sq in popular]})
