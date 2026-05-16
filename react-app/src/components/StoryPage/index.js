import React, { useEffect, useContext, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useHistory, useParams } from 'react-router-dom';
import './StoryPage.css';
import parse from 'html-react-parser';
import CommentPanel from '../CommentPanel';
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

// Assign stable slug IDs to h2/h3 nodes so ToC links work
const slugify = (text) =>
  text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 60);

const headingTransform = (domNode) => {
  if (domNode.type !== 'tag' || !['h2', 'h3'].includes(domNode.name)) return undefined;
  const text = domNode.children?.map((c) => c.data || '').join('') || '';
  const id = slugify(text);
  const Tag = domNode.name;
  return <Tag id={id}>{text}</Tag>;
};

const StoryPage = () => {
  const { openModal } = useContext(ModalContext);
  const history = useHistory();
  const dispatch = useDispatch();
  const { id } = useParams();

  const [date, setDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [sortedContent, setSortedContent] = useState([]);
  const [showComments, setShowComments] = useState(false);
  const [following, setFollowing] = useState(false);
  const [tocItems, setTocItems] = useState([]);

  const story = useSelector((state) => state.story.currentStory);
  const user = useSelector((state) => state.session.user);
  const followedAuthorIds = useSelector((state) => state.session.followedAuthorIds);
  const author = useSelector((state) => state.story.currentStory?.authorInfo);

  const contentRef = useRef(null);

  // --- Reading time from word count ---
  const readingTime = story
    ? Math.max(1, Math.round(story.wordCount / 200))
    : story?.timeToRead;

  // --- Claps ---
  const handleClapClick = async () => {
    const response = await dispatch(storyActions.clapStory(id));
    if (response?.error) alert('Sorry, you cannot clap your own stories.');
  };

  const handleUnclapClick = async () => {
    const response = await dispatch(storyActions.unclapStory(id));
    if (response?.message) alert('Sorry, you do not have any claps to remove.');
  };

  // --- Follow state ---
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

  // --- Load story ---
  useEffect(() => {
    const loadStory = async () => {
      setIsLoading(true);
      await dispatch(storyActions.getStoryById(id));
      setIsLoading(false);
    };
    loadStory();
  }, [id, dispatch]);

  useEffect(() => {
    if (story) {
      setDate(story.createdAt.slice(0, 16));
    }
  }, [story]);

  // --- Sort content segments (text + images) ---
  useEffect(() => {
    if (!story) return;
    const segments = [];
    let last = 0;
    story.images.forEach((image) => {
      segments.push({ text: story.content.slice(last, image.position), image: image.url, altTag: image.altTag });
      last = image.position;
    });
    if (last < story.content.length) {
      segments.push({ text: story.content.slice(last) });
    }
    setSortedContent(segments);
  }, [story]);

  // --- Extract ToC from rendered headings ---
  useEffect(() => {
    if (!story || isLoading) return;
    // Small delay so DOM has rendered
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

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => { dispatch(storyActions.removeCurrentStory()); };
  }, []);

  // --- Navigation helpers ---
  const navToFeed = (search, subFeed) => {
    dispatch(sessionActions.search(search));
    dispatch(sessionActions.setFeed(search));
    dispatch(sessionActions.setSubFeed(subFeed));
    history.push('/home');
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
        {/* Center column */}
        <div className="story-page">
          {story && (
            <>
              <h4 className="member-only">
                <img src={shining_star} alt="shining-star" className="shining-star" />
                Member-only story
              </h4>

              <h1 className="story-title">{story.title}</h1>

              {/* Author header */}
              <div className="author-section flex">
                <img
                  src={story.authorInfo?.profileImage}
                  alt="author profile icon"
                  className="author-image"
                  onClick={() => navToFeed(`${story.authorInfo?.firstName} ${story.authorInfo?.lastName}`, 'authors')}
                />
                <div className="author-information memo-text">
                  <div className="author-name-and-follow">
                    <div onClick={() => navToFeed(`${story.authorInfo?.firstName} ${story.authorInfo?.lastName}`, 'authors')}>
                      {story.authorInfo?.firstName} {story.authorInfo?.lastName}
                    </div>
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
              <div className="options-bar">
                <div className="clap-container">
                  {user?.id !== story.authorInfo?.id && (
                    <button className="unclap-button" onClick={handleUnclapClick}>-</button>
                  )}
                  <div className="clap-content">
                    <img src={claps} alt="claps" className="claps-icon" />
                    <div className="claps-count">{story.claps}</div>
                  </div>
                  {user?.id !== story.authorInfo?.id && (
                    <button className="clap-button" onClick={handleClapClick}>+</button>
                  )}
                </div>

                <CommentPanel showComments={showComments} setShowComments={setShowComments} story={story} />

                <BookmarkButton
                  storyId={story.id}
                  initialHasBookmarked={story.hasBookmarked}
                  initialCount={story.bookmarkCount}
                  user={user}
                />

                {user?.id === story.authorInfo?.id && (
                  <img
                    src={triple_dots_icon}
                    alt="triple-dots-icon"
                    className="triple-dots-icon"
                    onClick={() => openModal('storyOptionsModal')}
                  />
                )}

                <div
                  className={`overlay ${showComments ? 'active' : ''}`}
                  onClick={() => setShowComments(false)}
                />
              </div>

              {/* Mobile share strip */}
              <ShareButtons story={story} />

              {/* Article body */}
              <div className="story-content" ref={contentRef}>
                {sortedContent.map((item, index) => (
                  <div key={index}>
                    {item.text && (
                      <div className="memo-text">
                        {parse(item.text, { replace: headingTransform })}
                      </div>
                    )}
                    {item.image && (
                      <img src={item.image} alt={item.altTag} className="story-image" />
                    )}
                  </div>
                ))}
              </div>

              <div className="main-page-tag-container">{renderTags()}</div>

              {/* Bottom options bar */}
              <div className="options-bar">
                <div className="clap-container">
                  {user?.id !== story.authorInfo?.id && (
                    <button className="unclap-button" onClick={handleUnclapClick}>-</button>
                  )}
                  <div className="clap-content">
                    <img src={claps} alt="claps" className="claps-icon" />
                    <div className="claps-count">{story.claps}</div>
                  </div>
                  {user?.id !== story.authorInfo?.id && (
                    <button className="clap-button" onClick={handleClapClick}>+</button>
                  )}
                </div>

                <CommentPanel showComments={showComments} setShowComments={setShowComments} story={story} />

                <BookmarkButton
                  storyId={story.id}
                  initialHasBookmarked={story.hasBookmarked}
                  initialCount={story.bookmarkCount}
                  user={user}
                />

                {user?.id === story.authorInfo?.id && (
                  <img
                    src={triple_dots_icon}
                    alt="triple-dots-icon"
                    className="triple-dots-icon"
                    onClick={() => openModal('storyOptionsModal')}
                  />
                )}
                <div
                  className={`overlay ${showComments ? 'active' : ''}`}
                  onClick={() => setShowComments(false)}
                />
              </div>

              {/* Bottom author section */}
              <div className="author-section flex">
                <img
                  src={story.authorInfo?.profileImage}
                  alt="author profile icon"
                  className="author-image"
                  onClick={() => navToFeed(`${story.authorInfo?.firstName} ${story.authorInfo?.lastName}`, 'authors')}
                />
                <div className="author-information memo-text">
                  <div className="author-name-and-follow">
                    <div onClick={() => navToFeed(`${story.authorInfo?.firstName} ${story.authorInfo?.lastName}`, 'authors')}>
                      {story.authorInfo?.firstName} {story.authorInfo?.lastName}
                    </div>
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

              {/* Related stories rails */}
              <RelatedStories storyId={story.id} authorName={authorName} />
            </>
          )}
        </div>

        {/* Right rail — ToC (desktop sticky, mobile collapsible drawer) */}
        {story && (
          <div className="story-toc-wrapper">
            <TableOfContents items={tocItems} />
          </div>
        )}
      </div>

      {/* Text highlight + clip */}
      {story && (
        <HighlightClipper storyId={story.id} contentRef={contentRef} user={user} />
      )}

      {/* Sticky author follow CTA */}
      {story && (
        <AuthorFollowCTA
          author={author}
          user={user}
          following={following}
          onFollow={handleFollow}
          followedCount={followedCount}
        />
      )}
    </>
  );
};

export default StoryPage;
