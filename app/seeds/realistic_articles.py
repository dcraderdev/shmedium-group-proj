"""Seed 40 realistic articles for the portfolio demo.

Adds on top of seed_stories() (which provides the original 56 articles).
Spreads created_at across the last 90 days, gives each article 1-200 claps
distributed across the existing seed users, attaches 1-3 tags per story,
and seeds 2-8 plausible comments per article.

Run order: must run AFTER seed_users, seed_tags, seed_stories.

✅ Deterministic — seeded from a fixed RNG seed so output is reproducible.
⚠️ Idempotent-ish — undo matches by title in ARTICLES, so re-running won't
    duplicate (each insert is preceded by undo).
"""

import random
from datetime import datetime, timedelta

from sqlalchemy.sql import text

from app.models import (
    db,
    Story,
    Tag,
    StoryTag,
    Clap,
    Comment,
    environment,
    SCHEMA,
)


# --- Content pool -----------------------------------------------------------

# 40 articles. Each: (title, sliced_intro, topic_key, body_paragraph_count)
# The body_paragraph_count is a hint; actual count is 3-5 picked deterministically.
ARTICLES = [
    # programming / tech (10)
    ("The Quiet Power of Boring Code",
     "The most reliable systems I have ever shipped were also the most boring.",
     "programming", 4),
    ("Why I Stopped Reaching for Microservices",
     "Three years and one rewrite later, the monolith won.",
     "programming", 4),
    ("Postgres Is the Answer to Most Questions",
     "Before you reach for Redis, Mongo, or Elastic, ask Postgres first.",
     "programming", 5),
    ("Reading Code Is a Skill, Not a Side Effect",
     "We obsess over writing clean code but barely teach how to read it.",
     "programming", 4),
    ("The Junior Developer Mistakes I Stopped Apologizing For",
     "Some of the moves I was embarrassed about turned out to be the right ones.",
     "programming", 4),
    ("Tests Are a Communication Medium",
     "A good test suite is documentation written for your future self.",
     "programming", 3),
    ("Stop Optimizing What You Have Not Measured",
     "The biggest perf wins I ever shipped came from removing code, not adding it.",
     "programming", 4),
    ("The Real Cost of a Side Project",
     "It is not the hours. It is the residual context you carry into Monday.",
     "programming", 3),
    ("Git Is Not Hard; Your Mental Model Is Off",
     "Once you see git as a graph of snapshots, everything else clicks.",
     "programming", 4),
    ("Why I Write My Own Throwaway Tools",
     "A five-line bash script has shipped more value for me than most libraries.",
     "programming", 3),

    # self-improvement / productivity (8)
    ("The Cult of Productivity Almost Broke Me",
     "I built systems for systems and forgot why I was working in the first place.",
     "selfimprovement", 4),
    ("Two-Hour Workdays and Why They Still Work",
     "Compressing creative work into a tight window forced me to choose.",
     "selfimprovement", 4),
    ("Boredom Is a Feature, Not a Bug",
     "The best ideas I have had were in shower stalls and long car rides.",
     "selfimprovement", 3),
    ("I Quit Reading Self-Help and Started Reading History",
     "Old generals had better advice on focus than anyone on LinkedIn.",
     "selfimprovement", 4),
    ("Saying No Is a Career Skill, Not a Personality Flaw",
     "The people I admire most are surgical about what they decline.",
     "selfimprovement", 3),
    ("Your Calendar Is Lying to You",
     "Time blocks do not equal time spent. Audit the gap.",
     "selfimprovement", 4),
    ("The Best Advice I Got Came From a Bartender",
     "He spent twenty years watching people fail at the same three things.",
     "selfimprovement", 3),
    ("Small Habits, Honest Tracking, Nothing Fancy",
     "I deleted my habit-tracking app and replaced it with a sticky note.",
     "selfimprovement", 4),

    # travel / lifestyle (6)
    ("Three Weeks in Lisbon Changed How I Think About Cities",
     "Density without hostility — Lisbon proved it is possible.",
     "travel", 4),
    ("The Underrated Joy of a One-Backpack Trip",
     "Every grand adventure I have taken started with subtraction.",
     "travel", 3),
    ("Why I Stopped Planning Trips Down to the Hour",
     "The best parts of every itinerary were the ones I did not write.",
     "travel", 4),
    ("A Slow Morning in Kyoto",
     "There is a coffee shop on a side street I will probably never find again.",
     "travel", 3),
    ("The Map Is Not the Trip",
     "Two travelers with the same itinerary will tell two different stories.",
     "travel", 4),
    ("On Going Home",
     "Every return reveals a version of the place you missed before.",
     "travel", 3),

    # design / art / writing (8)
    ("Good Design Is Mostly Subtraction",
     "Every meaningful redesign I have shipped started with deletes, not adds.",
     "design", 4),
    ("Typography Is the Last Honest Craft",
     "A well-set paragraph rewards every reader, even the ones who do not notice.",
     "design", 3),
    ("The Sketchbook Habit Nobody Talks About",
     "Filling pages with bad ideas is the only way to find the good ones.",
     "design", 4),
    ("Writing Is Thinking in Public",
     "I publish drafts because finished work hides the work that mattered.",
     "writing", 4),
    ("The Brief Is the Most Important Artifact",
     "If the brief is fuzzy, the deliverable will be fuzzier.",
     "design", 3),
    ("Why Designers Should Code a Little",
     "You do not need to ship. You need to feel the friction.",
     "design", 4),
    ("On Making Things You Cannot Sell",
     "Some of my favorite projects will never leave my hard drive.",
     "writing", 3),
    ("Color Theory Is Not Theory",
     "The rules are a starting point. Bend them once you can defend the bend.",
     "design", 4),

    # health / food / culture / other (8)
    ("The Quiet Discipline of Cooking at Home",
     "Three meals a day is a lot of decisions. Most of mine are now defaults.",
     "cooking", 4),
    ("Running Did Not Fix Me, But It Helped",
     "I did not lose weight. I gained a place to put the noise.",
     "health", 3),
    ("On Sleeping Through the Night Again",
     "I tried every supplement on the shelf before doing the obvious thing.",
     "health", 4),
    ("The Coffee Snobs Are Right About One Thing",
     "Beans matter. Everything else is preference.",
     "cooking", 3),
    ("A Year Without Streaming",
     "I rented movies again. The act of choosing changed what I watched.",
     "culture", 4),
    ("Why I Read Physical Books Again",
     "The Kindle is for travel. The shelf is for memory.",
     "culture", 3),
    ("Five Pieces of Music I Have Played Too Many Times",
     "If they survive a thousand listens, they earn their place.",
     "music", 4),
    ("On Picking Up Hobbies Late",
     "Adult beginners have something kids do not: the patience to be bad.",
     "selfimprovement", 3),
]


# Paragraph pools per topic. We pick 3-5 paragraphs per article (deterministic).
PARAGRAPHS = {
    "programming": [
        "The pattern I keep coming back to is the one I would have rejected three years ago. Plain functions, clear names, a handful of obvious tables. There is no clever metaprogramming, no inheritance chain that requires a sticky note to follow. Every junior who has joined the team has been productive in days, not weeks, and the on-call rotation has gotten quieter. The lesson, if there is one, is that boring code is a gift you give your future self and everyone who comes after.",
        "I watched a team spend two quarters porting a service to a new framework because the old one felt creaky. The new framework was elegant, modern, and chosen for excellent technical reasons. It is also now legacy. The service it replaced still runs in a corner of the company, untouched, doing exactly what it has done since 2019. The lesson there is about the half-life of taste, and how much rework gets shipped under the banner of improvement.",
        "Most performance problems are not algorithmic. They are accidental N+1 queries, unnecessary serialization, JSON parsing on the hot path, or a cache that never gets read. I learned to bring a profiler before bringing an opinion. The numbers do not care which framework you prefer. They will point at a line nobody owns, written in haste eighteen months ago, and ask you to come fix it.",
        "There is a category of bug that only appears when one engineer leaves the company. It lived in their head, in the way they manually edited config before deploys, in the side channel they used to coordinate with another team. We call this institutional knowledge and then act surprised when it walks out the door. The fix is not better documentation. The fix is making the steps unnecessary, or making them part of the build.",
        "Pair programming, code review, and rubber-duck debugging all work for the same underlying reason: forcing yourself to explain a thing out loud surfaces the assumption that was wrong. Most of the time you do not need a second engineer to catch the bug. You need the friction of a witness. The version of me that has to say it tends to notice things the silent version glossed past.",
        "The single most useful skill I picked up this decade was learning to read SQL query plans. It is not glamorous. It will not get a talk at a conference. But the day I stopped guessing about query performance and started looking at the plan was the day half of my bug reports stopped existing. There is no clever framework that beats understanding what the database is actually doing.",
    ],
    "selfimprovement": [
        "For two years I had a notion database with seven nested templates, a tagging taxonomy I had reworked four times, and a weekly review ritual that took an hour. Then I deleted the whole thing and started writing the day's three priorities on a sticky note. My output went up. The lesson is that the system is not the work. The work is the work, and any system that distracts from it is friction wearing the costume of progress.",
        "The hardest part of habit-building is not starting. It is the third week, when the novelty has worn off, no one is watching, and the only thing keeping you going is the agreement you made with yourself. That agreement is the asset. Build it small, keep it boring, and protect it like a relationship.",
        "I used to think that focus was a personality trait and that I did not have it. Then I noticed that I could focus for hours on the things I cared about and was scatter-brained about the things I did not. Focus turned out to be a downstream effect of caring. The trick was not learning to concentrate. The trick was learning what was worth concentrating on.",
        "Every productivity book has a chapter on saying no. They make it sound like a single brave decision. In practice it is a hundred small ones, mostly unglamorous, mostly without applause. You decline the coffee, the side project, the speaking gig. You stop replying instantly. You shrink the surface area of your obligations until what is left is the thing you actually wanted to do.",
        "Boredom used to feel like failure. Now it feels like a runway. The ideas I am proudest of all surfaced in long, quiet stretches when I was not trying to produce anything. The phone was elsewhere. The room was a little too quiet. Whatever was in my head got room to move. We have made boredom so easy to escape that we have lost the thing it was supposed to do.",
        "The advice that has held up best for me is not from books. It is from a handful of people I trust who have watched me work for years. They know when I am rationalizing. They know which excuses are recurring. Five minutes with them is worth more than five hundred pages of someone telling me what successful people do at six in the morning.",
    ],
    "travel": [
        "The neighborhood I stayed in had a bakery that opened at six, a tile-lined pharmacy that has been in the same family since 1908, and an old man on the corner who said hello in three languages until he figured out which one I spoke. I did not see a single sight. I came home with a city in my chest anyway. That is the only kind of travel I want now.",
        "The trip I planned the least went the best. We had a list of three cities and a return date. Everything else we figured out from the back of a notebook over morning coffee. The cost was a few wrong turns and a couple of mediocre meals. The payoff was an afternoon at a stranger's wedding and a four-hour conversation with a fisherman who had never been more than fifty kilometers from where he was born.",
        "There is a particular kind of joy in carrying everything you need on your back. Not because the backpack is romantic, but because every item in it had to earn its place. The trip becomes a slow argument against the next thing you do not need. You come home and look at your apartment differently. Most of what is in it would not have made the cut.",
        "I have stopped photographing the famous things. The Eiffel Tower has been photographed enough. What I take pictures of now are doorways, breakfast tables, the way a particular sidewalk meets a particular curb. The photos are useless to anyone but me. They are the only ones I look at again.",
        "Going home after a long trip is its own kind of journey. The familiar things feel slightly wrong, like the furniture has been moved a centimeter. You notice the smells, the way the light falls in the kitchen. You realize how much of where you live is invisible until you have been somewhere else long enough to forget it.",
        "The traveler I admire most is not the one with the longest list of countries. It is the one who has gone back to the same small town fifteen years in a row, knows the shopkeepers by name, and has been invited to weddings and funerals. Depth, not breadth. There is a version of travel that is mostly about consumption, and there is one that is mostly about being known.",
    ],
    "design": [
        "Every meaningful redesign I have shipped started with deletes, not adds. The page had eight call-to-actions; we kept one. The dashboard had twelve metrics; we kept four. The onboarding had seven steps; we kept three. The hard part is not the deleting. The hard part is the conversation about what is allowed to be deleted, which is mostly a conversation about whose ego is attached to what.",
        "Designers love mood boards. I have made my share. But the artifact I rely on most is the brief, written in plain prose, no images, the shorter the better. If I can write a tight paragraph about what we are building and why, every downstream decision gets easier. If I cannot, I am decorating, not designing.",
        "Type set well is the closest thing graphic design has to a contract with the reader. Every choice — leading, measure, weight contrast, hierarchy — is a small promise about how the reader will be treated. Get it right and most readers will never notice. Get it wrong and the page feels rude even if they cannot say why.",
        "The first time I shipped a feature I had also implemented end-to-end was a turning point. I felt the friction the engineers had been describing for months. The animation that took six lines in Figma took six hundred in code. The empty state I had drawn in five minutes took two days of edge cases. Designing in a vacuum produces ideas the team cannot afford. Designing in the build produces ideas the team can.",
        "Color systems are deceptive. They look like math. In practice they are a series of small political decisions: this brand color has to feel correct against this competitor's, this gray has to read as neutral under both displays, this accent has to survive the marketing team. The tokens are a fiction we agree on so the work can move.",
        "Sketchbooks are the only honest design tool I have. They cannot be undone. The bad ideas stay on the page next to the good ones, which means I have to actually look at the difference. Every digital tool is too forgiving. The sketchbook is the only place I have learned to recognize my own bad ideas in time.",
    ],
    "writing": [
        "Drafting in public — even semi-public — changed how I write. The pressure to be done went down. The pressure to be honest went up. I do not publish anything I would not stand behind, but I publish a lot of work that is not finished, because finishing is a mirage and the alternative is a hard drive full of half-thoughts.",
        "The pieces of writing I am most proud of are the ones I wrote and then rewrote and then cut in half and then cut again. The work I am least proud of is the work I shipped fast because the deadline mattered more than the sentence. There is no trick. Just the willingness to spend twice as long as you think you should.",
        "I keep a folder of essays I will never publish. Some are too personal, some are too half-formed, some are just embarrassingly wrong. I reread them every six months. They are a map of what I used to think. The version of me writing today owes a lot to the version that wrote things badly and let them sit.",
        "Reading is the part of writing nobody talks about because it does not produce anything visible. But the writers I steal from most are the ones whose books I have reread three or four times. The sentences I write that I like best have always come from somewhere. I am just trying to be a good thief.",
        "The blank page is not the problem. The full page is. Editing is where the work actually happens, and the only way to get good at it is to spend years cutting things you were proud of when you wrote them. The version of the paragraph that survives is the one that earned its place by being shorter than the one before it.",
    ],
    "cooking": [
        "The cooking habit that has changed the most for me is shopping. I stopped going to one store with a list and started going to three stores with rough categories. The produce place, the butcher, the corner market. The food gets better, the cost goes down, and the act of shopping becomes part of the meal rather than a chore that precedes it.",
        "I keep a list of fifteen dinners I can make without thinking. Pasta with anchovy and breadcrumbs. Beans and rice with whatever is in the fridge. A roast chicken on Sunday that becomes stock on Wednesday. The list is the most useful thing in my kitchen. It is also the result of a decade of small experiments I mostly forgot.",
        "The case for cooking at home is not really about money or health, though both apply. It is about decisions. A restaurant menu offers twenty choices. The fridge offers one or two. When the decisions are smaller, the meal gets made, the kitchen gets cleaner, and the day ends without the residue of having to negotiate with another business.",
        "Knife skills are real. Six months of cutting onions slowly and correctly will save you years of cutting them poorly. The same is true for everything else in a kitchen that looks intimidating: technique compounds. The good cooks I know are the ones who repeated the same simple things until those things stopped being conscious.",
        "Coffee is the one place I will admit to being a snob. The beans matter. The grind matters. The water matters. Everything else — the brewing method, the cup, the ritual — is preference and aesthetics, and the difference between great coffee and good coffee is mostly the beans you started with.",
    ],
    "health": [
        "Running did not fix anything I came to it for. I did not lose much weight, I did not get faster, and the existential noise in my head did not quiet down. But I built a place to put thirty minutes a day that was structurally non-negotiable, and over a year that turned out to matter more than any of the things I thought I wanted.",
        "Sleep is the cheapest performance enhancer in the world and the one most people refuse to pay for. I tried every supplement. I tried the apps, the rings, the cold showers, the breathing techniques. The thing that actually worked was going to bed an hour earlier and not negotiating with the version of me that wanted to scroll one more time.",
        "The doctors who have helped me most have asked the boring questions. How is the sleep. How is the stress. Are you eating. Are you moving. They have not prescribed anything fancy. They have noticed that most of what shows up as a symptom is downstream of a few simple things being out of joint, and that the things are not glamorous.",
        "I have stopped tracking workouts. The data was making me worse, not better. The number of times I went out for a run because I wanted to was overtaken by the number of times I went out to fill a square on a graph. I deleted the app. The runs got slower and more frequent. The graph would have called this a regression.",
        "Wellness as a culture has overshot. The fact that I drink water and sleep eight hours does not require a brand. The performative version of taking care of yourself is itself a stressor. The quiet version, where you just do the boring things consistently and do not post about them, is the one that compounds.",
    ],
    "culture": [
        "The act of renting a movie used to be an event. You picked it from a wall, you committed to it, and you watched the whole thing. The infinite library on every streaming service has dissolved that contract. I have started doing it the old way again, picking one thing on Sunday and watching it without alternatives. The movies got better. I am not sure if it was the movies or the choosing.",
        "Reading on a screen is fine. Reading on paper is different. I am not going to argue that one is morally superior. I will say that the books I remember most clearly are the ones I read in print, and that the shelf I look at every day is a map of who I have been. The Kindle does not do that.",
        "I am suspicious of any culture that requires constant feeding. The shows you have to keep up with, the news cycle you have to track, the discourse you have to follow. The things I love most have not changed for me much in twenty years. They reward returning, not keeping up. There is a difference between being current and being engaged.",
        "Concerts are one of the only experiences left where you cannot multitask. The phone is out for the song you want to remember and then it is away again. You stand there for two hours and pay attention. I have started going more, not because the music is better than at home, but because the attention is.",
        "The cultural artifacts I keep returning to are not the ones that were most popular when they came out. They are the ones a friend recommended that took me three years to actually pick up. Friends remain the best recommendation engine ever invented, and the algorithm has not figured out how to fake the texture of that yet.",
    ],
    "music": [
        "There is a small set of recordings I have played hundreds of times and have not gotten tired of. They are not necessarily the most technically impressive things in their genres. They are the ones that revealed something new on the tenth listen, and again on the fortieth. The repeat-ability is the thing.",
        "Music as background and music as foreground are different activities. I had forgotten that. Putting on headphones, closing the laptop, and listening to a record straight through is closer to reading than to streaming. I do it once a week now. It has been some of the best time I have spent.",
        "The musicians I trust most have day jobs or used to. They are not chasing the next algorithm spike. They are working out the same musical idea over years, and the work compounds in a way you cannot fake. Most of them I found through one friend who knew one friend who knew the drummer.",
        "I have stopped trying to keep up with new releases. There is more good music in the back catalog than I will ever finish. The pressure to be current was making me a worse listener. I went deeper into a few artists instead of wider across many, and the listening got richer.",
        "Live music has always been the test. The records I love most are the ones where the live version is also the album version — where the performance is not hiding behind production. It is a high bar, but the people who clear it tend to age very well.",
    ],
}


# Pool of plausible comments
COMMENT_POOL = [
    "Wow, this really hit. Sharing with my team.",
    "Saving this one. The third paragraph is exactly what I needed today.",
    "Disagree with the second point — I have seen the opposite play out at my last job — but the rest holds up.",
    "Honest writing. Thanks for not dressing it up.",
    "This articulates something I have been trying to say for a year. Appreciate the words.",
    "Came here from a friend who shared it on Slack. Glad I read it.",
    "Read this on the train. Rereading it now.",
    "I bookmarked this for later and then forgot, then someone else sent it to me. Apparently the algorithm wants me to read it.",
    "Sharp. The bit about the sticky note is going on my wall.",
    "I have lived this. The two-quarter rewrite paragraph is uncomfortably specific.",
    "Subscribed. Looking forward to more like this.",
    "Curious what you would say to the counter-argument that the boring choice is the lazy choice. I do not buy it, but I have heard it.",
    "More writing like this please.",
    "This is the second piece of yours I have read this month. Both of them stayed with me.",
    "Reading this from a coffee shop and laughing. The bartender section is too real.",
    "I needed this today.",
    "The honesty here is the part that landed for me. A lot of writing on this topic refuses to admit the costs.",
    "Sent to two friends in the last hour.",
    "The closing paragraph is going in my notes app.",
    "Refreshing. Most takes on this topic feel performative.",
    "I have been on both sides of this and you got it right.",
    "A rare piece I will probably reread.",
    "Going to use the doorways photography idea. Thanks for naming it.",
    "Three years late to this but glad I found it.",
    "Loved the line about boredom being a runway.",
]


# --- Helpers ---------------------------------------------------------------

def _topic_to_tag_names(topic):
    """Map internal topic key to existing seed tag names."""
    mapping = {
        "programming": ["Programming", "Software Development", "Web Development", "Technology", "JavaScript", "Python"],
        "selfimprovement": ["Self Improvement", "Productivity", "Personal Development", "Psychology"],
        "travel": ["Travel", "Lifestyle", "Culture"],
        "design": ["Design", "Art", "Architecture"],
        "writing": ["Writing", "Books", "Education"],
        "cooking": ["Cooking", "Lifestyle", "Health"],
        "health": ["Health", "Lifestyle", "Self Improvement"],
        "culture": ["Culture", "Entertainment", "Film", "Books"],
        "music": ["Music", "Culture", "Art"],
    }
    return mapping.get(topic, ["Lifestyle"])


def _build_body(rng, intro, topic, paragraph_count):
    """Assemble HTML body. Mirrors the existing seed style (<br><br> separated)."""
    pool = PARAGRAPHS[topic]
    chosen = rng.sample(pool, k=min(paragraph_count, len(pool)))
    # Wrap the intro in bold like the existing seed_stories does
    opening = f"<b>{intro}</b>"
    return "<br><br>".join([opening] + chosen)


def _word_count(text_blob):
    return len(text_blob.split())


def _time_to_read(word_count):
    # 220 wpm average, minimum 3 minutes
    return max(3, round(word_count / 220))


# --- Main seed -------------------------------------------------------------

NUM_USERS = 23  # IDs 1-23 from seed_users
RNG_SEED = 20260515  # today's date for reproducibility


def seed_realistic_articles():
    """Add 40 realistic articles with lived-in engagement signals.

    Idempotent: removes any prior insertion matching ARTICLES titles before adding.
    """
    undo_realistic_articles()

    rng = random.Random(RNG_SEED)
    now = datetime.utcnow()

    # Pre-fetch tag rows so we can attach by id
    all_tags = {t.tag: t for t in Tag.query.all()}

    inserted_stories = []
    for (title, intro, topic, paragraph_hint) in ARTICLES:
        # Deterministic per-article RNG so retries produce same content per title
        article_rng = random.Random(f"{RNG_SEED}-{title}")
        paragraph_count = article_rng.randint(3, 5)
        body = _build_body(article_rng, intro, topic, paragraph_count)
        author_id = article_rng.randint(1, NUM_USERS)

        # Spread across last 90 days
        days_ago = rng.randint(0, 90)
        minutes_ago = rng.randint(0, 24 * 60)
        created_at = now - timedelta(days=days_ago, minutes=minutes_ago)

        word_count = _word_count(body)
        story = Story(
            author_id=author_id,
            title=title,
            content=body,
            time_to_read=_time_to_read(word_count),
            sliced_intro=intro,
            created_at=created_at,
            updated_at=created_at,
        )
        db.session.add(story)
        inserted_stories.append((story, topic, article_rng, created_at))

    db.session.commit()  # commit to get story IDs

    # Tags
    for (story, topic, article_rng, _) in inserted_stories:
        tag_names = _topic_to_tag_names(topic)
        chosen_tag_names = article_rng.sample(tag_names, k=min(article_rng.randint(1, 3), len(tag_names)))
        for tag_name in chosen_tag_names:
            tag = all_tags.get(tag_name)
            if tag is None:
                continue
            db.session.add(StoryTag(story_id=story.id, tag_id=tag.id))

    db.session.commit()

    # Claps: 1-200 per story, spread across users; clap timestamps after the story was created
    for (story, _topic, article_rng, created_at) in inserted_stories:
        clap_count = article_rng.randint(1, 200)
        for _ in range(clap_count):
            user_id = article_rng.randint(1, NUM_USERS)
            # Clap happened sometime between story creation and now
            seconds_since = int((datetime.utcnow() - created_at).total_seconds())
            offset = article_rng.randint(0, max(seconds_since, 1))
            clap_time = created_at + timedelta(seconds=offset)
            db.session.add(Clap(
                user_id=user_id,
                story_id=story.id,
                created_at=clap_time,
                updated_at=clap_time,
            ))

    db.session.commit()

    # Comments: 2-8 per story
    for (story, _topic, article_rng, created_at) in inserted_stories:
        comment_count = article_rng.randint(2, 8)
        chosen_comments = article_rng.sample(COMMENT_POOL, k=min(comment_count, len(COMMENT_POOL)))
        for comment_text in chosen_comments:
            user_id = article_rng.randint(1, NUM_USERS)
            seconds_since = int((datetime.utcnow() - created_at).total_seconds())
            offset = article_rng.randint(0, max(seconds_since, 1))
            comment_time = created_at + timedelta(seconds=offset)
            db.session.add(Comment(
                user_id=user_id,
                story_id=story.id,
                content=comment_text,
                created_at=comment_time,
                updated_at=comment_time,
            ))

    db.session.commit()

    print(f"✅ Seeded {len(inserted_stories)} realistic articles with claps + comments + tags")


def undo_realistic_articles():
    """Remove only the articles this script inserted (matched by title).

    In production, the global undo in __init__.py uses TRUNCATE so this is a no-op
    in that path. For local dev we match by title.
    """
    if environment == "production":
        # Production-wide truncate happens upstream; nothing to do here.
        return

    titles = [a[0] for a in ARTICLES]
    if not titles:
        return

    # Pull story IDs for our titles, then clear dependent rows first
    rows = Story.query.filter(Story.title.in_(titles)).all()
    story_ids = [r.id for r in rows]
    if not story_ids:
        return

    Clap.query.filter(Clap.story_id.in_(story_ids)).delete(synchronize_session=False)
    Comment.query.filter(Comment.story_id.in_(story_ids)).delete(synchronize_session=False)
    StoryTag.query.filter(StoryTag.story_id.in_(story_ids)).delete(synchronize_session=False)
    Story.query.filter(Story.id.in_(story_ids)).delete(synchronize_session=False)
    db.session.commit()
