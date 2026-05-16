import React, { useEffect, useContext, lazy, Suspense } from 'react';
// import { useHistory, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { WindowContext } from '../../context/WindowContext';
import { initialLoad } from '../../store/story';
import './FeedPage.css'
import StoryFeed from '../StoryFeed';

const SidePanel = lazy(() => import(/* webpackChunkName: "sidepanel" */ '../SidePanel'));



const FeedPage = () => {
  // const history = useHistory()
  // const location = useLocation();
  const dispatch = useDispatch();

  const { windowSize } = useContext(WindowContext);
  // const user = useSelector(state=>state.session.user)


  useEffect(() => {
    dispatch(initialLoad());
  }, [dispatch]);



    useEffect(()=>{
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },[])
 
  return (
    <>

      {windowSize < 960 &&(
        <div className='feedpage-container flex'>
          <StoryFeed className={`storyfeed-wrapper wide`}/>
        </div>
      )}

      {windowSize > 959 &&(
        <div className='feedpage-container flex'>
          <div className='storyfeed-wrapper'> <StoryFeed/> </div>
          <div className='sidepanel-wrapper'><Suspense fallback={null}><SidePanel/></Suspense></div>
        </div>
      )}

    </>
  )
}
export default FeedPage




