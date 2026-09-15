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
    StoryImage,
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


# Additional paragraphs per topic, merged into PARAGRAPHS below.
#
# Kept separate so the original pool stays readable in diffs. These exist so an
# article can draw 7-9 paragraphs (~700-1000 words, a 4-5 minute read) instead of
# the original 3-5 (~260 words), which rendered as one-minute stubs next to the
# hand-written seed stories and made the feed look unfinished.
_EXTRA_PARAGRAPHS = {
    "programming": [
        "Every team I have worked on eventually rediscovers the same truth about abstractions: the cost is not writing them, it is the years afterward when someone needs to do something the abstraction did not anticipate. A shallow wrapper saves ten lines today and costs a week when the underlying library changes in a way the wrapper cannot express. I have started asking a simple question before adding a layer. If this turns out to be wrong, how expensive is it to remove?",
        "Deploys used to be an event at my last company. There was a checklist, a rotating deploy captain, and a Slack channel that got quiet in a particular way when something went sideways. When we moved to small, frequent, boring releases, the anxiety drained out of the process. Not because we got better engineers, but because the blast radius of any single change got small enough that being wrong stopped being expensive.",
        "The best code review comment I ever received was a question, not a correction. Someone asked why I had chosen to cache that value, and in trying to write the answer I realized I did not have one. I deleted forty lines and the feature got faster. Reviews that only catch style are a tax. Reviews that ask what the author was thinking are the ones that change the code.",
        "Naming is the part of the job that never gets easier and never stops mattering. A function named correctly does not need a comment. A variable named vaguely will be misread by every person who touches it, including you in four months. I have spent twenty minutes on a single name and considered it time well spent, because the alternative is a decade of small confusions paid by everyone downstream.",
        "There is a version of engineering maturity that looks like doing less. Fewer dependencies, fewer services, fewer configuration options, fewer clever tricks. It is not laziness and it is not a lack of ambition. It is the recognition that every line of code is a liability you have agreed to carry, and the only ones worth carrying are the ones doing real work.",
    ],
    "selfimprovement": [
        "Ambition has a shape that is easy to misread. For years I assumed it meant wanting more of everything: more responsibility, more visibility, more projects running at once. What it actually turned out to mean, once I paid attention, was wanting a specific thing badly enough to say no to the adjacent ones. The people I admire are not doing more than me. They are doing less, on purpose, with more attention.",
        "I keep a running document of decisions I got wrong and what I believed at the time. It is not a punishment exercise. It is the only reliable way I have found to notice patterns, because memory quietly edits the past to make the current version of you look reasonable. Reading my own reasoning from two years ago is humbling in a way no book has managed.",
        "Comparison is not the thief of joy so much as the thief of accuracy. When I measure my work against someone else's finished output, I am comparing my drafts to their edits, my Tuesday to their highlight reel. The comparison that has actually helped me is against my own work from a year ago, which is the only version that shares my constraints.",
        "The habits that stuck were the ones I made smaller than felt respectable. Five minutes of reading. One paragraph. A ten-minute walk. Every ambitious version of those habits failed inside a month. The embarrassingly small version has now run for years, and the compounding has produced more than any of the ambitious ones would have if they had survived, which they did not.",
        "Most advice is context collapsed into a sentence. It worked for someone, under conditions they have forgotten to mention, with resources they are not counting. That does not make it useless. It makes it a hypothesis rather than an instruction. The useful move is to ask what conditions made it work, and whether any of them are true for you.",
    ],
    "travel": [
        "The best day of any trip is usually the third one. The first is logistics and disorientation. The second is the list of things you thought you should see. By the third, the map has stopped being abstract, you know which direction the water is, and you have opinions about which of the two cafes on the corner is better. That is when a place stops being a destination and starts being somewhere you are.",
        "Language is the fastest way to be humbled and the fastest way to be welcomed. My accent is bad and my vocabulary is a few hundred words. It has never mattered. People respond to the attempt, not the execution. The twenty minutes I spend learning how to greet, thank, and apologize have bought more goodwill than every guidebook I have carried.",
        "I have learned to budget time the way I budget money on a trip. An afternoon with nothing scheduled is not wasted, it is the thing that makes the rest work. The itineraries I have regretted were the efficient ones, where every hour had a job and none of them had room for the detour that turned out to be the memory.",
        "Tourism and travel are different activities that happen in the same places. One is consumption of a curated experience, which is fine and sometimes exactly what you want. The other is closer to temporary residence: buying groceries, doing laundry, getting bored, finding out what a place is like on a Tuesday when nothing is happening.",
        "Coming back with fewer photographs and more notes has changed what I retain. The photo captures what something looked like, which I would probably remember anyway. The note captures what I thought about it, which I would not. Years later the notebook is the thing I open.",
    ],
    "design": [
        "Constraints are the most underrated design tool. A blank canvas is paralyzing, while a canvas with three fixed requirements is a problem you can actually solve. The projects that went badly for me were almost always the ones where the client insisted on total freedom, which in practice meant nobody had done the work of deciding what the thing was for.",
        "Accessibility is not a checklist you run at the end. Treated that way it produces work that technically passes and practically fails. Treated as a starting constraint, it makes better design for everyone: clearer hierarchy, more honest contrast, larger targets, text that survives being resized. The best accessible interfaces I have used were not obviously accessible. They were just good.",
        "There is a failure mode where a design system becomes the product. The tokens get beautiful, the documentation gets thorough, the component library gets a dedicated team, and the actual application stops improving. A system is scaffolding. When the scaffolding requires more maintenance than the building, something has gone sideways.",
        "The critique culture on a team matters more than the talent on it. I have watched strong designers produce mediocre work in rooms where feedback was performative, and average designers produce excellent work in rooms where someone was willing to say the uncomfortable true thing kindly. The skill being developed in a good critique is not taste. It is the ability to hear a hard note without defending.",
        "Prototypes lie in useful ways and in dangerous ones. A clickable prototype tests whether a flow makes sense, which is genuine value. It does not test whether the thing feels good at real latency, with real data, on a real device, in the sun. I have shipped flows that tested beautifully and felt awful, because the prototype was silent about everything that mattered.",
    ],
    "writing": [
        "Every essay I have finished went through a stage where I was convinced it was worthless. That stage is not a signal about the work. It is a stage, as reliable as a fever curve, and it shows up somewhere around the second real draft. Learning to keep working through it rather than treating it as information was the single most productive thing I did for my writing.",
        "The sentence is the unit that matters. Not the outline, not the argument, not the structure, all of which can be fixed later. If the sentences are dead the piece is dead, and no amount of reorganization will resuscitate it. I read my drafts aloud for exactly this reason. The ear catches what the eye forgives.",
        "Writing for an audience you can picture is easier than writing for everyone. When I imagine one specific person who might need this, the register sorts itself out, the jargon either earns its place or goes, and the false authority drains out of the prose. Writing for everyone produces writing for nobody, in a voice that belongs to no one.",
        "The hardest editing is cutting the paragraph you wrote the piece in order to include. It is usually the cleverest one. It is usually the one that made you want to write the essay. And it is usually not doing any work for the reader, which is the only test that counts. I keep a file of these, which is either discipline or sentimentality.",
        "Publishing regularly taught me something that publishing well never did: most pieces are not events. They land quietly, a few people read them, and life continues. That deflation is a gift. It lowers the stakes enough that you can keep working, and the body of work accumulates while you are not looking.",
    ],
    "cooking": [
        "Salt is the skill. Not the ingredient, the skill of knowing when something needs more and having the nerve to add it. Almost everything I cooked in my twenties was undersalted, and almost every time I thought a dish was missing something complicated, it was missing salt. Learning to taste and adjust did more for my cooking than any recipe ever has.",
        "A well-stocked pantry is worth more than a well-planned week. Tinned fish, good olive oil, dried beans, decent pasta, a few acids, something fermented. With those on the shelf there is always a meal thirty minutes away, which means the plan failing does not mean takeout. The plan fails often. The pantry does not care.",
        "Cooking for other people is a different craft than cooking for yourself. The food matters less than the timing, and the timing matters less than whether you are relaxed enough to be present. I have served simple food at ease and elaborate food while frantic, and nobody has ever remembered the elaborate one fondly.",
        "Leftovers are a design problem. Cook the roast on Sunday knowing Wednesday exists, and the week gets easier. Cook it as a one-night event and Wednesday becomes a decision you will make badly at seven in the evening. The best home cooks I know are not better at cooking. They are better at sequencing.",
        "Recipes are notation, not instruction. They assume a stove you do not have, a pan of a size they did not mention, and produce of a moisture content they could not know. Learning to read a recipe as a sketch of intent rather than a set of commands is the point at which cooking stops being anxious and starts being interesting.",
    ],
    "health": [
        "Consistency beats intensity in a way that is genuinely unfair to people who like intensity. Three moderate sessions a week for a year will leave you in a better place than two brutal months followed by a ten-month gap, which is the pattern I repeated for most of a decade. The boring version wins and it is not close.",
        "Pain and soreness are different signals and I spent years treating them as the same one. Learning the difference, mostly by getting it wrong and being injured, changed how I train more than any program did. The willingness to stop early on a bad day is what makes it possible to show up on all the other ones.",
        "Mental health interventions that worked for me were embarrassingly unsophisticated: sunlight in the morning, a reason to leave the house, conversations with people who knew me before this year. I wanted the answer to be something I could purchase or optimize. It turned out to be a handful of ordinary things done regularly, which is harder than buying something.",
        "The health advice industry is optimized for novelty because novelty is what gets attention, and the fundamentals have not changed in decades so they cannot be reported as news. Sleep, movement, food you cooked, people you like, something to do that matters to you. There is no eleventh item, and the ten are not a secret.",
        "I stopped framing rest as something I earn. Framing it that way meant I only rested after proving I deserved it, which meant I rested badly and late, usually after something broke. Rest as a scheduled input rather than a reward changed the whole system, and the work got better, which was not the point but was a nice outcome.",
    ],
    "culture": [
        "Algorithms are good at giving me more of what I already liked and bad at giving me the thing that would change my mind. The most important books and records in my life all arrived through a person, usually with an argument attached and often at a moment I was not looking. That kind of recommendation has a texture that recommendation engines have not learned to fake.",
        "Rewatching and rereading are underrated. A book I read at twenty and again at thirty-five is two different books, and the difference is a measurement of what happened to me in between. The pressure to always be consuming something new means most people never get that measurement, which seems like a loss.",
        "Criticism at its best is not a verdict, it is an invitation to pay closer attention. The reviews I still think about did not tell me whether to see the film. They told me what to look at, and the looking changed. The star rating is the least interesting thing on the page and it is the part everyone reads.",
        "Every generation is told that its cultural output is thinner than what came before. The claim is usually made by people comparing everything being made now to the small fraction of the past that survived, which is not a fair fight. Time is an aggressive editor. The present will look better in thirty years, once most of it is gone.",
        "There is a difference between taste and preference that took me too long to learn. Preference is what I like. Taste is being able to recognize when something is good at what it is trying to do, including when it is not for me. Confusing the two produces confident people who are wrong a lot.",
    ],
    "music": [
        "Learning an instrument as an adult is mostly an exercise in tolerating being bad at something in a way you have organized your life to avoid. The progress is real but it arrives on a schedule that has nothing to do with how badly you want it. Twenty minutes a day for a year will take you somewhere. Four hours on a Sunday, once, will not.",
        "Production choices date faster than songs do. The reverb, the compression, the particular drum sound of a decade are all timestamps. The songs that survive tend to be the ones that would work played by one person in a room, which is a useful test to apply before you fall in love with a mix.",
        "Playlists changed how I listen and I am not sure it was an improvement. The album as a sequence, with a side one and a side two and an order someone argued about, asks for a kind of attention I now have to schedule. Shuffle is convenient. Convenience is not always what the thing was for.",
        "The local show is where music is actually alive. Forty people, a room with bad acoustics, a band that will not exist in three years. Nothing about it is optimized and most of it is not very good, which is exactly why the good moments land the way they do. I go more often now than I did when I had more time.",
        "Music does a thing to memory that nothing else in my life does. A song I have not heard in fifteen years arrives with the weather of the month I was listening to it, the room, the person. It is the closest thing I have to time travel and it is completely involuntary, which is probably why it works.",
    ],
}

for _topic, _extra in _EXTRA_PARAGRAPHS.items():
    PARAGRAPHS[_topic].extend(_extra)


# Stock imagery per topic, keyed to the same topic labels as PARAGRAPHS.
#
# Source: Unsplash (https://unsplash.com), used under the Unsplash License, which
# permits free commercial and non-commercial use. Each entry is (photo_id, alt).
# The alt text describes what is actually in the frame — these were reviewed
# individually rather than guessed from the file name — and carries the source
# credit so the citation survives into the rendered page and the accessibility
# tree without needing a separate caption element.
#
# URLs are built with an explicit width so the browser never pulls the multi-
# thousand-pixel original (see _image_url below).
TOPIC_IMAGES = {
    "programming": [
        ("photo-1461749280684-dccba630e2f6", "Syntax-highlighted code on a dark terminal screen"),
        ("photo-1516116216624-53e697fedbea", "HTML markup open in a dark code editor"),
        ("photo-1498050108023-c5249f4df085", "Laptop showing code on a bright white desk"),
        ("photo-1517180102446-f3ece451e9d8", "Browser developer tools inspecting a page's markup"),
        ("photo-1519389950473-47ba0277781c", "Overhead view of a desk covered in laptops and devices as a team works"),
    ],
    "selfimprovement": [
        ("photo-1500673922987-e212871fec22", "A path through dark woods lit from above"),
        ("photo-1469474968028-56623f02e42e", "A person standing on a rocky outcrop looking over misty mountains"),
        ("photo-1512820790803-83ca734da794", "A stack of business and strategy paperbacks on a desk"),
    ],
    "travel": [
        ("photo-1476514525535-07fb3b4ae5f1", "The bow of a wooden boat on a still lake below mountains"),
        ("photo-1488646953014-85cb44e25828", "A camera, backpack and field notebook laid out on a paper map"),
        ("photo-1506905925346-21bda4d32df4", "Snow-covered mountain peaks rising above a layer of cloud"),
        ("photo-1447752875215-b2761acb3c5d", "A wooden footbridge running through dense green forest"),
    ],
    "design": [
        ("photo-1524758631624-e2822e304c36", "A bright modern office lounge with armchairs and a floor lamp"),
        ("photo-1552664730-d307ca884978", "A team gathered around a whiteboard covered in sticky notes"),
        ("photo-1517048676732-d65bc937f952", "People taking notes around a table in a working meeting"),
        ("photo-1522071820081-009f0129c71c", "Colleagues working together on laptops in a shared office"),
    ],
    "writing": [
        ("photo-1499750310107-5fef28a66643", "A laptop, coffee mug and notebook on a wooden desk"),
        ("photo-1507842217343-583bb7270b66", "A wall of worn hardback books packed edge to edge"),
        ("photo-1481627834876-b7833e8f5570", "A library aisle receding under warm hanging lights"),
        ("photo-1524995997946-a1c2e315a42f", "Curved shelves of books in a circular library"),
    ],
    "cooking": [
        ("photo-1504674900247-0877df9cc836", "Plates of cooked meat and salad photographed from above"),
        ("photo-1466637574441-749b8f19452f", "A cutting board with fresh vegetables, eggs and a knife"),
        ("photo-1498837167922-ddd27525d352", "Trays of colourful chopped vegetables laid out in rows"),
        ("photo-1494859802809-d069c3b71a8a", "A white bowl of dressed salad on a pale surface"),
        ("photo-1495521821757-a1efb6729352", "Pour-over coffee brewing into a glass carafe on a scale"),
    ],
    "health": [
        ("photo-1506126613408-eca07ce68773", "A person sitting cross-legged in meditation at sunset"),
        ("photo-1544367567-0f2fcb009e0b", "A silhouetted yoga pose against an orange sunset sky"),
        ("photo-1441974231531-c6227db76b6e", "Tall trees in a sunlit forest seen from below"),
    ],
    "culture": [
        ("photo-1514933651103-005eec06c04b", "The dim interior of a bar lined with bottles"),
        ("photo-1543007630-9710e4a00a20", "A warm restaurant interior under rows of hanging lights"),
        ("photo-1524995997946-a1c2e315a42f", "Curved shelves of books in a circular library"),
    ],
    "music": [
        ("photo-1470225620780-dba8ba36b745", "Hands working a DJ mixer under purple stage light"),
        ("photo-1514933651103-005eec06c04b", "The dim interior of a bar lined with bottles"),
        ("photo-1543007630-9710e4a00a20", "A warm venue interior under rows of hanging lights"),
    ],
}

# Credit suffix appended to every alt tag so the source is cited wherever the
# image is rendered or read aloud.
IMAGE_CREDIT = "photo via Unsplash"


def _image_url(photo_id, width=1200):
    """Unsplash CDN URL at a sane render width.

    The originals are several thousand pixels wide; the frontend's resizeCdnUrl
    only rewrites Pexels URLs, so the width is baked in here instead.
    """
    return f"https://images.unsplash.com/{photo_id}?auto=format&fit=crop&w={width}&q=80"


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


SEP = "<br><br>"


def _build_body(rng, intro, topic, paragraph_count):
    """Assemble HTML body. Mirrors the existing seed style (<br><br> separated)."""
    pool = PARAGRAPHS[topic]
    chosen = rng.sample(pool, k=min(paragraph_count, len(pool)))
    # Wrap the intro in bold like the existing seed_stories does
    opening = f"<b>{intro}</b>"
    return SEP.join([opening] + chosen)


def _paragraph_boundaries(body):
    """Character offsets immediately after each paragraph separator.

    StoryImage.position is a character index into Story.content: the reader view
    slices the body at each position and drops the image in (see StoryPage's
    content.slice(last, image.position)). Landing on a paragraph boundary keeps
    images from splitting a sentence in half.
    """
    offsets = []
    idx = body.find(SEP)
    while idx != -1:
        offsets.append(idx + len(SEP))
        idx = body.find(SEP, idx + 1)
    return offsets


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
        paragraph_count = article_rng.randint(7, 9)
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

    # Images: 2 per story, dropped at paragraph boundaries roughly a third and
    # two thirds of the way down, so the reader view breaks up the text the same
    # way the hand-written seed stories do.
    for (story, topic, article_rng, _) in inserted_stories:
        candidates = TOPIC_IMAGES.get(topic) or []
        if not candidates:
            continue

        boundaries = _paragraph_boundaries(story.content)
        # Skip the boundary right after the bold intro so the article still opens
        # with text rather than an image.
        boundaries = boundaries[1:]
        if not boundaries:
            continue

        picks = article_rng.sample(candidates, k=min(2, len(candidates)))
        slots = []
        for fraction in (0.33, 0.7):
            slot = boundaries[min(int(len(boundaries) * fraction), len(boundaries) - 1)]
            if slot not in slots:
                slots.append(slot)

        for (photo_id, alt), position in zip(picks, slots):
            db.session.add(StoryImage(
                story_id=story.id,
                url=_image_url(photo_id),
                position=position,
                alt_tag=f"{alt} — {IMAGE_CREDIT}",
            ))

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
    StoryImage.query.filter(StoryImage.story_id.in_(story_ids)).delete(synchronize_session=False)
    StoryTag.query.filter(StoryTag.story_id.in_(story_ids)).delete(synchronize_session=False)
    Story.query.filter(Story.id.in_(story_ids)).delete(synchronize_session=False)
    db.session.commit()
