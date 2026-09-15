import React, { useEffect, useContext, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import './StoryTileThree.css';
// import mediumLogoCircles from '../../public/medium-logo-circles.jpeg';
import { WindowContext } from '../../context/WindowContext';
import openBook from '../../public/open-book.png';
import quill from '../../public/quill.png';
import userOutline from '../../public/user-outline.png';
import fountainPen from '../../public/fountain-pen.png';
import * as sessionActions from '../../store/session'


  
  
  const StoryTileThree = ({ story }) => {
  const dispatch = useDispatch();
  const history = useHistory();
  const [date, setDate] = useState('Dec 25, 2560')

  const {windowSize} = useContext(WindowContext)
  const [thumbnail, setThumbnail] = useState('')
  const [profileImageSrc, setProfileImageSrc] = useState('');
  const user = useSelector((state) => state.session.user);
  const [storyContent, setStoryContent] = useState('')

  useEffect(()=>{
    if(user && user.profileImage){
      if(user.profileImage === 'quill'){
        setProfileImageSrc(quill)
      }
      else if(user.profileImage === 'user-outline'){
        setProfileImageSrc(userOutline)
      }
      else if(user.profileImage === 'open-book'){
        setProfileImageSrc(openBook)
      }
      else if(user.profileImage === 'fountain-pen'){
        setProfileImageSrc(fountainPen)
      }
      else {
        setProfileImageSrc(user.profileImage)
      }
    }

  },[user]);

  useEffect(()=>{
    if(story){
      // The feed payload from /api/init is the slim one — it omits `content`
      // to save ~9 SELECTs per request, and carries `slicedIntro` instead.
      // Falling back keeps this tile working for both shapes; reading
      // `.replace` off an absent `content` used to throw during render and
      // unmount the whole app (blank page on /home).
      const preview = story.content || story.slicedIntro || ''
      let parsedContent = preview.replace(/<[^>]*>/g, '').slice(0, 80) + '...'
      setStoryContent(parsedContent)
      let month = story?.createdAt?.slice(8,11)
      let day = story?.createdAt?.slice(5,7)
      setDate(`${month} ${day}`)

      const images = story.images || []
      if(!images.length){
        setThumbnail('https://miro.medium.com/v2/resize:fit:1200/1*jfdwtvU6V6g99q3G7gq7dQ.png')
      }
      if(images.length){
        setThumbnail(images[0].url)
      }


    }
  
  },[story])

  const navToFeed = (search, subFeed) => {
    dispatch(sessionActions.search(search))
    dispatch(sessionActions.setFeed(search))
    dispatch(sessionActions.setSubFeed(subFeed))
    history.push('/home');
    return
  }
  
  


  return (
    <div className="story-tile-style3">
      <div className="style3-content">
        <div className="style3-author-container">
          <div className="style3-profile-image">
          {story?.authorInfo?.profileImage && (
                <img
                  src={story?.authorInfo.profileImage}
                  alt="author profile icon"
                  onClick={()=>navToFeed(`${story?.authorInfo?.firstName} ${story?.authorInfo?.lastName}`, 'authors')}
                  loading="lazy"
                  decoding="async"
                ></img>
              )}
          </div>
          <div 
          className="style3-author-name memo-text"
          onClick={()=>navToFeed(`${story?.authorInfo?.firstName} ${story?.authorInfo?.lastName}`, 'authors')}>
            {story?.authorInfo.firstName} {story?.authorInfo.lastName}
          </div>
        </div>
        <div className="style3-story-title-container">
          <div className=" style3-story-title memo-text" onClick={() => history.push(`/story/${story.id}`)}>{story?.title}</div>
        </div>
      </div>
    </div>
  );
};
export default StoryTileThree;


