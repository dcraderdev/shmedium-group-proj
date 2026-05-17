import React, { useEffect, useContext, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useHistory, useParams } from 'react-router-dom';
import './StoryPage.css';
import parse, { domToReact } from 'html-react-parser';
import Comments from '../Comments';
import * as sessionActions from '../../store/session';
import * as storyActions from '../../store/story';
import { ModalContext } from '../../context/ModalContext';
import claps from '../../public/claps.svg';
import shining_star from '../../public/shining_star.svg';
import triple_dots_icon from '../../public/triple_dots_icon.svg';
import StoryPageSkeleton from '../StoryPageSkeleton';
import ReadingProgressBar from '../ReadingProgressBar';
import TableOfContents from '../TableOfContents';
import ShareButtons from '../ShareButtons';
import HighlightClipper from '../HighlightClipper';
import RelatedStories from '../RelatedStories';
import AuthorFollowCTA from '../AuthorFollowCTA';
import BookmarkButton from '../BookmarkButton';
import StickyAuthorBar from '../StickyAuthorBar';

const slugify = (text) =>
  text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 60);

const nodeText = (node) => {
  if (!node) return '';
  if (node.type === 'text') return node.data || '';
  if (node.children) return node.children.map(nodeText).join('');
  return '';
};

const parseOpts = {
  replace(domNode) {
    if (domNode.type !== 'tag') return;
    if (!['h2', 'h3'].includes(domNode.name)) return;
    const id = slugify(nodeText(domNode));
    const Tag = domNode.name;
    return <Tag id={id}>{domToReact(domNode.children || [], parseOpts)}</Tag>;
  },
};

const StoryPage = () => {
  const { openModal } = useContext(ModalContext);
  const history = useHistory();
  const dispatch = useDispatch();
  const { id } = useParams();

  const [date, setDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [sortedContent, setSortedContent] = useState([]);
  const [following, setFollowing] = useState(false);
  const [tocItems, setTocItems] = useState([]);

  const story = useSelector((state) => state.story.currentStory);
  const user = useSelector((state) => state.session.user);
  const followedAuthorIds = useSelector((state) => state.session.followedAuthorIds);
  const author = useSelector((state) => state.story.currentStory?.authorInfo);

  const contentRef = useRef(null);
  const commentsRef = useRef(null);
  const topOptionsRef = useRef(null);

  const readingTime = story ? Math.max(1, Math.round((story.wordCount || 0) / 200)) : null;

  const [clapFloats, setClapFloats] = useState([]);
  const [clapBouncing, setClapBouncing] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);

  useEffect(() => {
    const el = topOptionsRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [story]);

  const handleClapClick = async () => {
    // Bounce animation
    setClapBouncing(true);
    setTimeout(() => setClapBouncing(false), 500);
    // Float label
    const floatId = Date.now();
    setClapFloats(prev => [...prev, floatId]);
    setTimeout(() => setClapFloats(prev => prev.filter(f => f !== floatId)), 800);

    const response = await dispatch(storyActions.clapStory(id));
    if (response?.error) alert('Sorry, you cannot clap your own stories.');
  };

  const handleUnclapClick = async () => {
    const response = await dispatch(storyActions.unclapStory(id));
    if (response?.message) alert('Sorry, you do not have any claps to remove.');
  };

  useEffect(() => {
    setFollowing(followedAuthorIds.includes(author?.id));
  }, [author, followedAuthorIds]);

  const handleFollow = async () => {
    if (!user) return;
    if (following) {
      await dispatch(storyActions.unfollowAuthor(author.id));
    } else {
      await dispatch(storyActions.followAuthor(author.id));
    }
    setFollowing(!following);
  };

  const scrollToComments = () => {
    commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const loadStory = async () => {
      setIsLoading(true);
      await dispatch(storyActions.getStoryById(id));
      setIsLoading(false);
    };
    loadStory();
  }, [id, dispatch]);

  useEffect(() => {
    if (story?.createdAt) {
      const d = new Date(story.createdAt);
      setDate(d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    }
  }, [story]);

  useEffect(() => {
    if (!story) return;
    const segments = [];
    let last = 0;
    story.images.forEach((image) => {
      segments.push({
        text: story.content.slice(last, image.position),
        imageData: { url: image.url, variants: image.variants || null },
        altTag: image.altTag,
      });
      last = image.position;
    });
    if (last < story.content.length) {
      segments.push({ text: story.content.slice(last) });
    }
    setSortedContent(segments);
  }, [story]);

  useEffect(() => {
    if (!story || isLoading) return;
    const timer = setTimeout(() => {
      if (!contentRef.current) return;
      const nodes = contentRef.current.querySelectorAll('h2, h3');
      const items = Array.from(nodes).map((node) => ({
        id: node.id || slugify(node.textContent),
        text: node.textContent,
        level: parseInt(node.tagName[1], 10),
      }));
      setTocItems(items);
    }, 100);
    return () => clearTimeout(timer);
  }, [story, isLoading, sortedContent]);

  useEffect(() => {
    return () => { dispatch(storyActions.removeCurrentStory()); };
  }, []);

  const navToFeed = (search, subFeed) => {
    dispatch(sessionActions.search(search));
    dispatch(sessionActions.setFeed(search));
    dispatch(sessionActions.setSubFeed(subFeed));
    history.push('/home');
  };

  const navToAuthorProfile = (authorId) => {
    if (authorId) history.push(`/author/${authorId}`);
  };

  const renderTags = () =>
    story?.tags?.map((tag) => (
      <button
        onClick={() => navToFeed(tag.tag)}
        key={tag.id}
        className="main-page-tag memo-text story-tag"
      >
        {tag.tag}
      </button>
    ));

  const authorName = author ? `${author.firstName} ${author.lastName}` : '';
  const followedCount = followedAuthorIds?.length || 0;

  return (
    <>
      <ReadingProgressBar />

      {(!story || isLoading) && <div><StoryPageSkeleton /></div>}

      <div className="story-layout">
        {/* Left column — sticky share sidebar (desktop only) */}
        {story && (
          <div className="story-share-col">
            <ShareButtons story={story} />
          </div>
        )}

        {/* Center column */}
        <div className="story-page">
          {story && (
            <>
              <h4 className="member-only">
                <img src={shining_star} alt="" className="shining-star" />
                Member-only story
              </h4>

              <h1 className="story-title">{story.title}</h1>

              {/* Author header */}
              <div className="author-section">
                <img
                  src={story.authorInfo?.profileImage}
                  alt="author"
                  className="author-image"
                  loading="lazy"
                  decoding="async"
                  onClick={() => navToAuthorProfile(story.authorInfo?.id)}
                />
                <div className="author-information">
                  <div className="author-name-and-follow">
                    <span style={{ cursor: 'pointer' }} onClick={() => navToAuthorProfile(story.authorInfo?.id)}>
                      {story.authorInfo?.firstName} {story.authorInfo?.lastName}
                    </span>
                    {user && user.id !== story.authorInfo?.id && (
                      <button className="follow-unfollow-button" onClick={handleFollow}>
                        {following ? ' · Unfollow' : ' · Follow'}
                      </button>
                    )}
                  </div>
                  <div className="story-author">
                    <p className="time">{readingTime} min read · {date}</p>
                  </div>
                </div>
              </div>

              {/* Top options bar */}
              <div className="options-bar" ref={topOptionsRef}>
                <div className="clap-container">
                  {user?.id !== story.authorInfo?.id && (
                    <button className="unclap-button" onClick={handleUnclapClick}>−</button>
                  )}
                  <div className="clap-content" style={{ position: 'relative' }}>
                    <img src={claps} alt="claps" className="claps-icon" />
                    <div className="claps-count">{story.claps}</div>
                    {clapFloats.map(id => (
                      <span key={id} className="clap-float-label">+1</span>
                    ))}
                  </div>
                  {user?.id !== story.authorInfo?.id && (
                    <button
                      className={`clap-button${clapBouncing ? ' bouncing' : ''}`}
                      onClick={handleClapClick}
                    >+</button>
                  )}
                </div>

                <button className="comment-button" onClick={scrollToComments}>
                  💬 {story.commentCount ?? 0}
                </button>

                <BookmarkButton
                  storyId={story.id}
                  initialHasBookmarked={story.hasBookmarked}
                  initialCount={story.bookmarkCount}
                  user={user}
                />

                {user?.id === story.authorInfo?.id && (
                  <img
                    src={triple_dots_icon}
                    alt="options"
                    className="triple-dots-icon"
                    onClick={() => openModal('storyOptionsModal')}
                  />
                )}
              </div>

              {/* Mobile share strip */}
              <ShareButtons story={story} />

              {/* Article body */}
              <div className="story-content" ref={contentRef}>
                {sortedContent.map((item, index) => (
                  <div key={index}>
                    {item.text && (
                      <div className="memo-text">
                        {parse(item.text, parseOpts)}
                      </div>
                    )}
                    {item.imageData && (
                      item.imageData.variants ? (
                        <picture>
                          <source
                            type="image/webp"
                            srcSet={`${item.imageData.variants.card.webp} 800w, ${item.imageData.variants.full.webp} 1600w`}
                            sizes="(max-width: 900px) 800px, 1600px"
                          />
                          <img
                            src={item.imageData.variants.full.jpeg}
                            srcSet={`${item.imageData.variants.card.jpeg} 800w, ${item.imageData.variants.full.jpeg} 1600w`}
                            sizes="(max-width: 900px) 800px, 1600px"
                            alt={item.altTag}
                            className="story-image"
                            loading="lazy"
                            decoding="async"
                          />
                        </picture>
                      ) : (
                        <img
                          src={item.imageData.url}
                          alt={item.altTag}
                          className="story-image"
                          loading="lazy"
                          decoding="async"
                        />
                      )
                    )}
                  </div>
                ))}
              </div>

              <div className="main-page-tag-container">{renderTags()}</div>

              {/* Bottom options bar */}
              <div className="options-bar">
                <div className="clap-container">
                  {user?.id !== story.authorInfo?.id && (
                    <button className="unclap-button" onClick={handleUnclapClick}>−</button>
                  )}
                  <div className="clap-content" style={{ position: 'relative' }}>
                    <img src={claps} alt="claps" className="claps-icon" />
                    <div className="claps-count">{story.claps}</div>
                    {clapFloats.map(id => (
                      <span key={`b-${id}`} className="clap-float-label">+1</span>
                    ))}
                  </div>
                  {user?.id !== story.authorInfo?.id && (
                    <button
                      className={`clap-button${clapBouncing ? ' bouncing' : ''}`}
                      onClick={handleClapClick}
                    >+</button>
                  )}
                </div>

                <button className="comment-button" onClick={scrollToComments}>
                  💬 {story.commentCount ?? 0}
                </button>

                <BookmarkButton
                  storyId={story.id}
                  initialHasBookmarked={story.hasBookmarked}
                  initialCount={story.bookmarkCount}
                  user={user}
                />

                {user?.id === story.authorInfo?.id && (
                  <img
                    src={triple_dots_icon}
                    alt="options"
                    className="triple-dots-icon"
                    onClick={() => openModal('storyOptionsModal')}
                  />
                )}
              </div>

              {/* Bottom author section */}
              <div className="author-section">
                <img
                  src={story.authorInfo?.profileImage}
                  alt="author"
                  className="author-image"
                  loading="lazy"
                  decoding="async"
                  onClick={() => navToAuthorProfile(story.authorInfo?.id)}
                />
                <div className="author-information">
                  <div className="author-name-and-follow">
                    <span style={{ cursor: 'pointer' }} onClick={() => navToAuthorProfile(story.authorInfo?.id)}>
                      {story.authorInfo?.firstName} {story.authorInfo?.lastName}
                    </span>
                    {user && user.id !== story.authorInfo?.id && (
                      <button className="follow-unfollow-button" onClick={handleFollow}>
                        {following ? ' · Unfollow' : ' · Follow'}
                      </button>
                    )}
                  </div>
                  <div className="story-author">
                    <p className="time">{readingTime} min read · {date}</p>
                  </div>
                </div>
              </div>

              {/* Related stories rail */}
              <RelatedStories storyId={story.id} authorName={authorName} />

              {/* Inline comments */}
              <div className="story-comments-section" ref={commentsRef}>
                <Comments
                  storyId={story.id}
                  authorInfo={story.authorInfo}
                  userId={user?.id}
                  setShowComments={() => {}}
                />
              </div>
            </>
          )}
        </div>

        {/* Right rail — ToC */}
        {story && (
          <div className="story-toc-wrapper">
            <TableOfContents items={tocItems} />
          </div>
        )}
      </div>

      {/* Text highlight + clip */}
      {story && (
        <HighlightClipper
          storyId={story.id}
          contentRef={contentRef}
          user={user}
          contentVersion={story.id}
        />
      )}

      {/* Sticky author follow CTA (bottom-right popup) */}
      {story && (
        <AuthorFollowCTA
          author={author}
          user={user}
          following={following}
          onFollow={handleFollow}
          followedCount={followedCount}
        />
      )}

      {/* Sticky author mini-bar (desktop, after scroll) */}
      {story && (
        <StickyAuthorBar
          author={author}
          user={user}
          following={following}
          onFollow={handleFollow}
          claps={story.claps}
          onClap={handleClapClick}
        />
      )}

      {/* Sticky mobile claps bar — mobile only, slides up after scrolling past top options */}
      {story && showStickyBar && user?.id !== story.authorInfo?.id && (
        <div className="sticky-claps-bar">
          <div className="sticky-claps-content">
            <img src={claps} alt="claps" className="sticky-claps-icon" />
            <span>{story.claps}</span>
          </div>
          <div className="sticky-clap-actions">
            <button className="m-unclap-btn" onClick={handleUnclapClick}>−</button>
            <button className="m-clap-btn" onClick={handleClapClick}>+</button>
          </div>
        </div>
      )}
    </>
  );
};

export default StoryPage;
