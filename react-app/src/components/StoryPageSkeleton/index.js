import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import './StoryPageSkeleton.css';
import claps from '../../public/claps.svg';
import shining_star from '../../public/shining_star.svg';
import triple_dots_icon from '../../public/triple_dots_icon.svg';
import commentBubble from '../../public/comment.svg';

const StoryPageSkeleton = () => {
  const [showComments, setShowComments] = useState(false);

  // const currentUserId = useSelector(state => state.session.user?.id);

  
  return (
    <>

      {/* This is the loading placeholder, and it used to be wrapped in
          {story && (...)} — so it rendered only once the story had already
          arrived, and nothing at all while the story was loading. The page was
          therefore blank for the whole fetch (measured ~1.8s against
          production), with no heading for a screen reader to land on. Nothing
          in here reads from `story`; it is all shimmer blocks. */}
      <div className="story-page">
          <>
            <h4 className="member-only">
              <img
                src={shining_star}
                alt="shining-star"
                className="shining-star"
              />
              Member-only story
            </h4>

            {/* WCAG 1.3.1 / 2.4.6: an empty h1 is not a heading. While the story
                loads this is the page's only h1, so it carries the loading state
                for assistive tech and the shimmer block for everyone else. */}
            <h1 className="storypageskeleton-story-title shimmer">
              <span className="visually-hidden">Loading story…</span>
            </h1>




            <div className="author-section flex">
              <img
                src={'https://miro.medium.com/v2/resize:fit:1200/1*jfdwtvU6V6g99q3G7gq7dQ.png'}
                alt="author profile icon"
                className="author-image"
               
              />
              <div className="storypageskeleton-author-information memo-text">
                <div className='author-name-and-follow'>
                  <div className='storypageskeleton-authorname shimmer'>
                    
                  </div>

                    <button className="follow-unfollow-button" >
                      Follow
                    </button>

                </div>
                <div>
                <div className="story-author">


                  <p className="storypageskeleton-time shimmer">

                  </p>
                </div>

                </div>
              </div>
            </div>







            {/* changed original options bar to hide ability to clap/unclap your own stories + show ... only if you're the author of the story you're on */}
            <div className="options-bar">
              <div className="clap-container">
      
                <div className="clap-content">
                  <img src={claps} alt="claps" className="claps-icon" />
                  <div className="claps-count"></div>
                </div>
              
              </div>

              <img src={commentBubble} alt="comment" className="comment-icon" />

             
                <img
                  src={triple_dots_icon}
                  alt="triple-dots-icon"
                  className="triple-dots-icon"
                />
             

              <div className={`overlay ${showComments ? 'active' : ''}`}></div>
            </div>

            <div className="story-content">


            <div className="storypageskeleton-story-content large shimmer"> </div>
            <div className="storypageskeleton-story-content large shimmer"> </div>
            <div className="storypageskeleton-story-content large shimmer"> </div>
            <div className="storypageskeleton-story-content large shimmer"> </div>
            <div className="storypageskeleton-story-content large shimmer"> </div>
            <div className="storypageskeleton-story-content med shimmer"> </div>
            <div className="storypageskeleton-story-content med "> </div>

            <div className="storypageskeleton-story-content large shimmer"> </div>
            <div className="storypageskeleton-story-content large shimmer"> </div>
            <div className="storypageskeleton-story-content large shimmer"> </div>
            <div className="storypageskeleton-story-content large shimmer"> </div>
            <div className="storypageskeleton-story-content large shimmer"> </div>
            <div className="storypageskeleton-story-content small shimmer"> </div>
            <div className="storypageskeleton-story-content small "> </div>

            <div className="storypageskeleton-story-content large shimmer"> </div>
            <div className="storypageskeleton-story-content large shimmer"> </div>
            <div className="storypageskeleton-story-content large shimmer"> </div>
            <div className="storypageskeleton-story-content large shimmer"> </div>
            <div className="storypageskeleton-story-content large shimmer"> </div>
            <div className="storypageskeleton-story-content med shimmer"> </div>
            <div className="storypageskeleton-story-content med "> </div>


            </div>








            <div className="options-bar">
              <div className="clap-container">
      
                <div className="clap-content">
                  <img src={claps} alt="claps" className="claps-icon" />
                  <div className="claps-count"></div>
                </div>
              
              </div>

              <img src={commentBubble} alt="comment" className="comment-icon" />

             
                <img
                  src={triple_dots_icon}
                  alt="triple-dots-icon"
                  className="triple-dots-icon"
                />
             

              <div className={`overlay ${showComments ? 'active' : ''}`}></div>
            </div>

            

            <div className="author-section flex">
              <img
                src={'https://miro.medium.com/v2/resize:fit:1200/1*jfdwtvU6V6g99q3G7gq7dQ.png'}
                alt="author profile icon"
                className="author-image"
               
              />
              <div className="storypageskeleton-author-information memo-text">
                <div className='author-name-and-follow'>
                  <div className='storypageskeleton-authorname shimmer'>
                    
                  </div>

                    <button className="follow-unfollow-button" >
                      Follow
                    </button>

                </div>
                <div>
                <div className="story-author">


                  <p className="storypageskeleton-time shimmer">

                  </p>
                </div>

                </div>
              </div>
            </div>

          </>
      </div>
    </>
  );
};
export default StoryPageSkeleton;
