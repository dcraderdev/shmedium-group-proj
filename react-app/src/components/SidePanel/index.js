import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';

import './SidePanel.css';
// import { WindowContext } from '../../context/WindowContext';
// import { ModalContext } from '../../context/ModalContext';
import * as sessionActions from '../../store/session';

import StoryTileThree from '../StoryTileThree';
import StoryTileTwoSkeleton from '../StoryTileTwoSkeleton';
import { clickable } from '../../utils/a11y';


const SidePanel = () => {
  const dispatch = useDispatch()
  const history = useHistory();
  const [showTags, setShowtags] = useState(false);
  const tags = useSelector((state) => state.story.tags);
  const stories = useSelector(state=>state.story.stories)
  const loaded = useSelector(state=>state.story.loaded)

  const searchTag = (tag) => {
    // Scrolling is handled by StoryFeed when the feed actually changes — doing
    // it here ran before the new content rendered and got clobbered.
    dispatch(sessionActions.search(tag))
    dispatch(sessionActions.setFeed(tag))
    dispatch(sessionActions.setSubFeed('taggedStories'))
  }


  const navToOurStory = (tag) => {
    history.push('/about');
    return
  }

  const navToFeedStory = (tag) => {
    dispatch(sessionActions.setFeed('for you'))
    dispatch(sessionActions.setSubFeed(null))
    history.push('/home');
    return
  }




  const staffPicks = stories ? stories.slice(7, 17).filter(Boolean) : [];

  return (
    <>
      {!loaded && (
      <div className="sidepanel-container">
      <div className='sidepanel-banner-cover'></div>

    <div className="sidepanel-staff-picks-container flexcenter align-left">

      <div className="sidepanel-staff-picks-header flexcenter align-left memo-text">
        <div >Staff Picks of the Month:</div>
      </div>


        <div className="sidepanel-staff-picks-content flex">
          <StoryTileTwoSkeleton />
          <StoryTileTwoSkeleton />
          <StoryTileTwoSkeleton />
          <StoryTileTwoSkeleton />
          <StoryTileTwoSkeleton />
          <StoryTileTwoSkeleton />
          <StoryTileTwoSkeleton />

        </div>
  
      

    </div>



    <div className="sidepanel-tags-container">          
    <div className='flexcenter'>
      <div className={`sidepanel-tag-header  memo-text ${showTags ? 'extended' : ''}`}>
        Discover more of what matters to you
      </div>

    </div>

    <div className={showTags ? 'sidepanel-tags-extended' : 'sidepanel-tags'}>
            {Array.from({ length: 40 }).map((_, i) => (
                    <div key={i} className="skeleton-tag"></div>
                  ))}
    </div>

    <div className="see-more-topics" {...clickable(() => setShowtags(!showTags))}>
      {showTags ? 'See less topics' : 'See more topics'}
    </div>


    <div className="sidepanel-footer">
      <div className="main-page-footer-item" {...clickable(navToOurStory)}>Help</div>
      <div className="main-page-footer-item" {...clickable(navToOurStory)}>Status</div>
      <div className="main-page-footer-item" {...clickable(navToFeedStory)}>Writers</div>
      <div className="main-page-footer-item" {...clickable(navToFeedStory)}>Blog</div>
      <div className="main-page-footer-item" {...clickable(navToOurStory)}>Careers</div>
      <div className="main-page-footer-item" {...clickable(navToOurStory)}>Privacy</div>
      <div className="main-page-footer-item" {...clickable(navToOurStory)}>Terms</div>
      <div className="main-page-footer-item" {...clickable(navToOurStory)}>About</div>
    </div>

  </div>

  </div> 
    )}
    {loaded && (
      <div className="sidepanel-container">
      <div className='sidepanel-banner-cover'></div>

    <div className="sidepanel-staff-picks-container flexcenter align-left">

      <div className="sidepanel-staff-picks-header flexcenter align-left memo-text">
        <div >Staff Picks of the Month:</div>
      </div>


        {/* WCAG 2.1.1: this list scrolls, so it needs to be reachable and
            scrollable from the keyboard. tabIndex makes it focusable; the
            group role + label stop it being an unlabelled stop in the order. */}
        <div
          className="sidepanel-staff-picks-content flex"
          tabIndex={0}
          role="group"
          aria-label="Staff picks of the month"
        >
          {staffPicks.map((story) => (
            <StoryTileThree key={story.id} story={story} />
          ))}
        </div>
  
      

    </div>



    <div className="sidepanel-tags-container">          
    <div className='flexcenter'>
      <div className={`sidepanel-tag-header  memo-text ${showTags ? 'extended' : ''}`}>
        Discover more of what matters to you
      </div>

    </div>

    <div className={showTags ? 'sidepanel-tags-extended' : 'sidepanel-tags'}>
      {tags && tags.map((tag, i) => {
        return <div key={i} className="main-page-tag memo-text" {...clickable(()=>searchTag(tag))}>{tag}</div>;
      })}
    </div>

    <div className="see-more-topics" {...clickable(() => setShowtags(!showTags))}>
      {showTags ? 'See less topics' : 'See more topics'}
    </div>


    <div className="sidepanel-footer">
      <div className="main-page-footer-item" {...clickable(navToOurStory)}>Help</div>
      <div className="main-page-footer-item" {...clickable(navToOurStory)}>Status</div>
      <div className="main-page-footer-item" {...clickable(navToFeedStory)}>Writers</div>
      <div className="main-page-footer-item" {...clickable(navToFeedStory)}>Blog</div>
      <div className="main-page-footer-item" {...clickable(navToOurStory)}>Careers</div>
      <div className="main-page-footer-item" {...clickable(navToOurStory)}>Privacy</div>
      <div className="main-page-footer-item" {...clickable(navToOurStory)}>Terms</div>
      <div className="main-page-footer-item" {...clickable(navToOurStory)}>About</div>
    </div>

  </div>

  </div> 
    )}
    
    </>
       
  );
};
export default SidePanel;

