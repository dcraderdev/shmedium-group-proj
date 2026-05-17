import React, { useState, useEffect, useContext, useCallback, lazy, Suspense } from 'react';
import { useDispatch } from 'react-redux';
import { Route, Switch, useLocation } from 'react-router-dom';

import { authenticate } from './store/session';
import { initialLoad } from './store/story';
import Navigation from './components/Navigation';
import { ModalContext } from './context/ModalContext';

// Route-level chunks — each becomes its own JS file, loaded only when visited
const NotFound = lazy(() => import(/* webpackChunkName: "notfound" */ './components/NotFound'));
const HomePage = lazy(() => import(/* webpackChunkName: "home" */ './components/HomePage'));
const FeedPage = lazy(() => import(/* webpackChunkName: "feed", webpackPrefetch: true */ './components/FeedPage'));
const OurStoryPage = lazy(() => import(/* webpackChunkName: "about" */ './components/OurStoryPage'));
const WritePage = lazy(() => import(/* webpackChunkName: "write" */ './components/WritePage'));
const StoryPage = lazy(() => import(/* webpackChunkName: "story", webpackPrefetch: true */ './components/StoryPage'));
const CreateStoryPage = lazy(() => import(/* webpackChunkName: "create" */ './components/CreateStoryPage'));
const SearchPage = lazy(() => import(/* webpackChunkName: "search" */ './components/SearchPage'));
const NotificationsPage = lazy(() => import(/* webpackChunkName: "notifications" */ './components/NotificationsPage'));
const AuthorProfilePage = lazy(() => import(/* webpackChunkName: "author-profile", webpackPrefetch: true */ './components/AuthorProfilePage'));
const DraftsPage = lazy(() => import(/* webpackChunkName: "drafts" */ './components/DraftsPage'));

// Modal chunks — only fetched when the user triggers one
const SearchModal = lazy(() => import(/* webpackChunkName: "modal-search" */ './components/SearchModal'));
const SigninModal = lazy(() => import(/* webpackChunkName: "modal-auth" */ './components/SigninModal'));
const SignupModal = lazy(() => import(/* webpackChunkName: "modal-auth" */ './components/SignupModal'));
const ProfileButtonModal = lazy(() => import(/* webpackChunkName: "modal-profile" */ './components/ProfileButtonModal'));
const StoryOptionsModal = lazy(() => import(/* webpackChunkName: "modal-options" */ './components/StoryOptionsModal'));

// Wraps routes in a keyed div so CSS page-enter animation fires on every navigation
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-enter">
      <Switch location={location}>
        <Route path="/home" exact><FeedPage /></Route>
        <Route path="/about" exact><OurStoryPage /></Route>
        <Route path="/write" exact><WritePage /></Route>
        <Route path="/story/:id" exact><StoryPage /></Route>
        <Route path="/author/:id" exact><AuthorProfilePage /></Route>
        <Route path="/drafts" exact><DraftsPage /></Route>
        <Route path="/create" exact><CreateStoryPage /></Route>
        <Route path="/create/:id/edit" exact><CreateStoryPage /></Route>
        <Route path="/search" exact><SearchPage /></Route>
        <Route path="/notifications" exact><NotificationsPage /></Route>
        <Route path="/" exact><HomePage /></Route>
        <Route><NotFound /></Route>
      </Switch>
    </div>
  );
}

function App() {
  const dispatch = useDispatch();
  const [searchOpen, setSearchOpen] = useState(false);
  const { modal } = useContext(ModalContext);

  useEffect(() => {
    // Fire story data fetch immediately — public endpoint, no auth needed.
    // Runs in parallel with authenticate so FeedPage has data ready by the
    // time the auth check resolves and isLoaded flips to true.
    dispatch(initialLoad());
    dispatch(authenticate());
  }, [dispatch]);

  const openSearch  = useCallback(() => setSearchOpen(true),  []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  // cmd-K / ctrl-K global shortcut + custom event from nav
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    const handleEvent = () => setSearchOpen(true);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('open-search-modal', handleEvent);
    return () => {
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('open-search-modal', handleEvent);
    };
  }, []);

  return (
    <>
      {searchOpen && (
        <Suspense fallback={null}>
          <SearchModal onClose={closeSearch} />
        </Suspense>
      )}

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

      <Navigation />
      <Suspense fallback={null}>
        <AnimatedRoutes />
      </Suspense>
    </>
  );
}

export default App;
