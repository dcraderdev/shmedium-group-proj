import React, { useState, useEffect, useContext, lazy, Suspense } from 'react';
import { useDispatch } from 'react-redux';
import { Route, Switch } from 'react-router-dom';

import { authenticate } from './store/session';
import Navigation from './components/Navigation';
import { ModalContext } from './context/ModalContext';

// Route-level chunks — each becomes its own JS file, loaded only when visited
const HomePage = lazy(() => import(/* webpackChunkName: "home" */ './components/HomePage'));
const FeedPage = lazy(() => import(/* webpackChunkName: "feed", webpackPrefetch: true */ './components/FeedPage'));
const OurStoryPage = lazy(() => import(/* webpackChunkName: "about" */ './components/OurStoryPage'));
const WritePage = lazy(() => import(/* webpackChunkName: "write" */ './components/WritePage'));
const StoryPage = lazy(() => import(/* webpackChunkName: "story", webpackPrefetch: true */ './components/StoryPage'));
const CreateStoryPage = lazy(() => import(/* webpackChunkName: "create" */ './components/CreateStoryPage'));
const SearchPage = lazy(() => import(/* webpackChunkName: "search" */ './components/SearchPage'));
const NotificationsPage = lazy(() => import(/* webpackChunkName: "notifications" */ './components/NotificationsPage'));
const AuthorProfilePage = lazy(() => import(/* webpackChunkName: "author-profile" */ './components/AuthorProfilePage'));

// Modal chunks — only fetched when the user triggers one
const SigninModal = lazy(() => import(/* webpackChunkName: "modal-auth" */ './components/SigninModal'));
const SignupModal = lazy(() => import(/* webpackChunkName: "modal-auth" */ './components/SignupModal'));
const ProfileButtonModal = lazy(() => import(/* webpackChunkName: "modal-profile" */ './components/ProfileButtonModal'));
const StoryOptionsModal = lazy(() => import(/* webpackChunkName: "modal-options" */ './components/StoryOptionsModal'));

function App() {
  const dispatch = useDispatch();
  const [isLoaded, setIsLoaded] = useState(false);
  const { modal } = useContext(ModalContext);

  useEffect(() => {
    dispatch(authenticate()).then(() => setIsLoaded(true));
  }, [dispatch]);

  return (
    <>
      {(modal === 'signin' ||
        modal === 'signup' ||
        modal === 'profileModal' ||
        modal === 'storyOptionsModal') && (
        <div
          className={
            modal === 'profileModal' || modal === 'storyOptionsModal'
              ? 'modal-container-transparent'
              : 'modal-container'
          }
        >
          <Suspense fallback={null}>
            {modal === 'signin' && <SigninModal />}
            {modal === 'signup' && <SignupModal />}
            {modal === 'profileModal' && <ProfileButtonModal />}
            {modal === 'storyOptionsModal' && <StoryOptionsModal />}
          </Suspense>
        </div>
      )}

      {isLoaded && <Navigation />}
      {isLoaded && (
        <Suspense fallback={null}>
          <Switch>
            <Route path="/home" exact>
              <FeedPage />
            </Route>

            <Route path="/about" exact>
              <OurStoryPage />
            </Route>

            <Route path="/write" exact>
              <WritePage />
            </Route>

            <Route path="/story/:id" exact>
              <StoryPage />
            </Route>

            <Route path="/author/:id" exact>
              <AuthorProfilePage />
            </Route>

            <Route path="/create" exact>
              <CreateStoryPage />
            </Route>

            <Route path="/create/:id/edit" exact>
              <CreateStoryPage />
            </Route>

            <Route path="/search" exact>
              <SearchPage />
            </Route>

            <Route path="/notifications" exact>
              <NotificationsPage />
            </Route>

            <Route path="/" exact>
              <HomePage />
            </Route>
          </Switch>
        </Suspense>
      )}
    </>
  );
}

export default App;
