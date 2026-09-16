import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

/**
 * Keeps <title> in step with the route.
 *
 * WCAG 2.4.2 (Page Titled). Every route reported the same static "Shmedium"
 * from index.html, because nothing updates the title on a client-side
 * navigation. For a screen-reader user that makes the tab, the history menu and
 * the window list useless for telling pages apart — and title is the first
 * thing announced after a route change.
 *
 * Routes whose subject is loaded data (a story, an author, a search) take their
 * title from that data once it arrives, and fall back to a generic label while
 * it is still in flight so the title is never stale from the previous page.
 */

const SITE = 'Shmedium';

const STATIC_TITLES = {
  '/': 'Shmedium — Stay curious',
  '/home': 'Your feed',
  '/about': 'Our story',
  '/write': 'Start a blog',
  '/drafts': 'Your drafts',
  '/notifications': 'Notifications',
  '/create': 'Write a story',
};

function DocumentTitle() {
  const location = useLocation();
  const currentStory = useSelector((state) => state.story.currentStory);
  const authorProfile = useSelector((state) => state.story.authorProfile);

  useEffect(() => {
    const { pathname, search } = location;
    let title;

    if (STATIC_TITLES[pathname]) {
      title = STATIC_TITLES[pathname];
    } else if (pathname.startsWith('/story/')) {
      title = currentStory?.title || 'Story';
    } else if (pathname.startsWith('/author/')) {
      title = authorProfile
        ? `${authorProfile.firstName || ''} ${authorProfile.lastName || ''}`.trim() || 'Author'
        : 'Author';
    } else if (pathname === '/search') {
      const q = new URLSearchParams(search).get('q');
      title = q ? `Search: ${q}` : 'Search';
    } else if (pathname.startsWith('/create/')) {
      title = 'Edit story';
    } else {
      title = 'Page not found';
    }

    document.title = title === STATIC_TITLES['/'] ? title : `${title} · ${SITE}`;
  }, [location, currentStory, authorProfile]);

  return null;
}

export default DocumentTitle;
