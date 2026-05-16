// frontend/src/components/Navigation/index.js
import React, { useEffect, useRef, useContext, useState, useCallback } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';

import './Navigation.css';
import { WindowContext } from '../../context/WindowContext';
import { ModalContext } from '../../context/ModalContext';
import * as sessionActions from '../../store/session';
import mediumLogoSmall from '../../public/medium-logo-circles-white.svg';
import mediumLogoLarge from '../../public/medium-logo-with-cirlces.svg';

import openBook from '../../public/open-book.png';
import quill from '../../public/quill.png';
import userOutline from '../../public/user-outline.png';
import fountainPen from '../../public/fountain-pen.png';

import writeIcon from '../../public/write-icon.svg';
import bellIcon from '../../public/bell-icon.svg';
// import blackBellIcon from '../../public/black-bell.svg';
import magnifyGlass from '../../public/magnify-glass.svg';
import magnifyGlassBlack from '../../public/magnify-glass-black.svg';

const colorSchemes = {
  '/': ['nav-yellow', 'nav-white', 'button-black', 'button-green'],
  '/home': ['nav-white', 'nav-white', 'button-black', 'button-green'],
  '/write': ['nav-red', 'nav-white', 'button-black', 'button-black'],
  '/about': ['nav-white', 'nav-white', 'button-black', 'button-black'],
  '/search': ['nav-white', 'nav-white', 'button-black', 'button-black'],
  default: ['nav-white', 'nav-white', 'button-black', 'button-black'],
};

const profileImages = {
  quill: quill,
  'user-outline': userOutline,
  'open-book': openBook,
  'fountain-pen': fountainPen,
};

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/** Highlight query terms in a plain-text string — returns safe HTML. */
function hlText(text, q) {
  if (!text) return '';
  const escaped = escHtml(text);
  if (!q) return escaped;
  const terms = [...new Set(q.trim().split(/\s+/).filter(Boolean))]
    .sort((a, b) => b.length - a.length); // longest first prevents "py" inside "python"
  if (!terms.length) return escaped;
  // Escape query terms too so they match against the HTML-escaped text
  const pattern = new RegExp(
    '(' + terms.map((t) => escHtml(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')',
    'gi'
  );
  return escaped.replace(pattern, '<mark>$1</mark>');
}

function Navigation() {
  const { openModal, closeModal, setUpdateObj } =
    useContext(ModalContext);

  const history = useHistory();
  const dispatch = useDispatch();
  const location = useLocation();
  const [buttonStylings, setButtonStylings] = useState('');
  const [search, setSearch] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [suggestions, setSuggestions] = useState({ stories: [], authors: [], tags: [] });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const suggestTimer = useRef(null);
  const searchContainerRef = useRef(null);

  // const state = useSelector((state) => state);
  const user = useSelector((state) => state.session.user);
  // const searchResults = useSelector((state) => state.session.search);


  const { scrollPosition, windowSize, searchInputRef } =
    useContext(WindowContext);

  const colorScheme = useRef(
    colorSchemes[location.pathname] || colorSchemes.default
  );
  const [navColor, setNavColor] = useState(colorScheme[0]);
  const [buttonStyle, setButtonStyle] = useState(colorScheme[2]);
  const [profileImageSrc, setProfileImageSrc] = useState('');
  // const [isTagUrl, setIsTagUrl] = useState(false);
  const [isLandingPage, setIsLandingPage] = useState(false);
  const [isWritePage, setIsWritePage] = useState(false);
  const [isHomePage, setIsHomePage] = useState(false);
  const [showWriteButton, setShowWriteButton] = useState(true);

  useEffect(() => {
    const colors = colorScheme.current;

    if(!isHomePage){

      if (scrollPosition <= 370) {
        setNavColor(colors[0]);
        setButtonStyle(colors[2]);
      }
      if (scrollPosition > 370) {
        setNavColor(colors[1]);
        setButtonStyle(colors[3]);
      }
    }




  }, [scrollPosition]);

  // Keep nav input in sync with the /search page URL
  useEffect(() => {
    clearTimeout(suggestTimer.current);
    setSuggestions({ stories: [], authors: [], tags: [] });
    setShowSuggestions(false);
    if (location.pathname === '/search') {
      const params = new URLSearchParams(location.search);
      setSearch(params.get('q') || '');
    } else {
      setSearch('');
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    setIsLoaded(false);
    setIsLandingPage(false);
    setIsWritePage(false);
    setIsHomePage(false);


    if (location.pathname === '/') {
      setIsLandingPage(true);
    }
    if (location.pathname === '/write') {
      setIsWritePage(true);
    }
    if (location.pathname === '/home') {
      setIsHomePage(true);
    }

  console.log(navColor);


    // Initialize with the default color scheme
    let newColorScheme =
      colorSchemes[location.pathname] || colorSchemes.default;

    if (colorSchemes[location.pathname]) {
      newColorScheme = colorSchemes[location.pathname];
    }

    // console.log(newColorScheme);

    colorScheme.current = newColorScheme;
    setNavColor(newColorScheme[0]);
    setButtonStyle(newColorScheme[2]);

    if (!user) {
      if (location.pathname === '/write' || location.pathname === '/about') {
        setButtonStylings('show');
      } else {
        setButtonStylings('');
      }
    }

    if (location.pathname.slice(0, 7) === '/create') {
      setShowWriteButton(false);
    } else {
      setShowWriteButton(true);
    }

    setIsLoaded(true);
  }, [location.pathname, user]);

  const getProfileImageSrc = (profileImage) => {
    return profileImages[profileImage] || profileImage;
  };

  useEffect(() => {
    if (user) {
      setProfileImageSrc(getProfileImageSrc(user.profileImage));
    }
  }, [user]);

  const handleLogoClick = () => {
    colorScheme.current = colorSchemes['/'];
    window.scrollTo({ top: 0, behavior: 'smooth' });
    dispatch(sessionActions.setFeed('for you'));
    dispatch(sessionActions.setSubFeed('stories'));
    if (user) {
      history.push('/home');
      return;
    }
    history.push('/');
    return;
  };

  const handleStoryClick = () => {
    history.push('/about');
    colorScheme.current = colorSchemes['/about'];
  };

  const handleWriteClick = () => {
    if (!user) {
      history.push('/write');
    }
    if (user) {
      history.push('/create');
    }
  };

  const handleSigninClick = () => {
    openModal('signin');
  };

  const handleSignupClick = () => {
    openModal('signup');
  };
  const handleProfileClick = () => {
    if (!user) {
      openModal('signup');
    }
    if (user) {
      openModal('profileModal');
    }
  };

  const demoUser = async (e) => {
    e.preventDefault();
    const response = await dispatch(
      sessionActions.signin({ email: 'demo@dcrader.dev', password: 'demouser' })
    );
    if (response.status === 200) {
      setUpdateObj(null);
      closeModal();
      history.push('/home');
    }
  };

  // Debounced suggest fetch — fires 300 ms after the user stops typing
  const debouncedFetch = useCallback((q) => {
    clearTimeout(suggestTimer.current);
    if (!q || q.length < 2) {
      setSuggestions({ stories: [], authors: [], tags: [] });
      setShowSuggestions(false);
      return;
    }
    suggestTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
        setShowSuggestions(
          data.stories.length > 0 || data.authors.length > 0 || data.tags.length > 0
        );
        setHighlightedIdx(-1);
      }
    }, 300);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    debouncedFetch(val);
  };

  const allSuggestions = [
    ...suggestions.stories.map((s) => ({ ...s, _kind: 'story' })),
    ...suggestions.authors.map((a) => ({ ...a, _kind: 'author' })),
    ...suggestions.tags.map((t) => ({ ...t, _kind: 'tag' })),
  ];

  const commitSearch = (q) => {
    if (!q || !q.trim()) return;
    setShowSuggestions(false);
    clearTimeout(suggestTimer.current);
    // URL sync effect handles updating the input value on /search
    history.push(`/search?q=${encodeURIComponent(q.trim())}&type=stories`);
  };

  const handleSuggestKeyDown = (e) => {
    if (!showSuggestions) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx((i) => Math.min(i + 1, allSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setHighlightedIdx(-1);
    } else if (e.key === 'Enter' && highlightedIdx >= 0) {
      e.preventDefault();
      const item = allSuggestions[highlightedIdx];
      if (item._kind === 'story') commitSearch(item.title);
      else if (item._kind === 'author') commitSearch(item.name);
      else commitSearch(item.tag);
    }
  };

  // Legacy newSearch kept for home feed pill compatibility
  const newSearch = () => {
    commitSearch(search);
  };

  if (!isLoaded) {
    return null;
  }

  return (
    <>
      {/* // For user logged in */}
      {user && (
        <nav
          className={`nav-bar ${isHomePage ? 'logged' : ''} flexcenter ${navColor}`}
        >
          <div className={`nav-buttons memo-text ${buttonStylings}`}>
            <div className="flexcenter">
              <div className="logo small" onClick={handleLogoClick}>
                <img src={mediumLogoSmall} alt="medium cirlce logo" />
              </div>

              <div
                className={`nav-search ${
                  isLandingPage || isWritePage ? 'black' : ''
                }`}
                ref={searchContainerRef}
                style={{ position: 'relative' }}
              >
                {isWritePage && (
                  <div
                    className="maginfy-container scaled-down"
                    onClick={newSearch}
                  >
                    <img src={magnifyGlassBlack} alt="medium cirlce logo" />
                  </div>
                )}
                {!isWritePage && (
                  <div className="maginfy-container" onClick={newSearch}>
                    <img
                      className=""
                      src={magnifyGlass}
                      alt="medium cirlce logo"
                    />
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    newSearch();
                  }}
                >
                  <label>
                    <input
                      ref={searchInputRef}
                      className={`search-field ${
                        isLandingPage || isWritePage ? 'black' : ''
                      }`}
                      type="search"
                      value={search}
                      onChange={handleSearchChange}
                      onKeyDown={handleSuggestKeyDown}
                      onFocus={() => search.length >= 2 && setShowSuggestions(
                        suggestions.stories.length > 0 || suggestions.authors.length > 0 || suggestions.tags.length > 0
                      )}
                      placeholder={'Search Medium'}
                      autoComplete="off"
                    />
                  </label>
                </form>

                {showSuggestions && (
                  <div className="suggest-dropdown">
                    {suggestions.stories.length > 0 && (
                      <div className="suggest-group">
                        <div className="suggest-group-label">Stories</div>
                        {suggestions.stories.map((s, i) => (
                          <div
                            key={s.id}
                            className={`suggest-item${allSuggestions.findIndex(x => x._kind === 'story' && x.id === s.id) === highlightedIdx ? ' highlighted' : ''}`}
                            onMouseDown={() => commitSearch(s.title)}
                          >
                            <span className="suggest-title" dangerouslySetInnerHTML={{ __html: hlText(s.title, search) }} />
                            <span className="suggest-meta">{s.authorName}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {suggestions.authors.length > 0 && (
                      <div className="suggest-group">
                        <div className="suggest-group-label">Authors</div>
                        {suggestions.authors.map((a) => (
                          <div
                            key={a.id}
                            className={`suggest-item${allSuggestions.findIndex(x => x._kind === 'author' && x.id === a.id) === highlightedIdx ? ' highlighted' : ''}`}
                            onMouseDown={() => commitSearch(a.name)}
                          >
                            <span className="suggest-title" dangerouslySetInnerHTML={{ __html: hlText(a.name, search) }} />
                            <span className="suggest-meta">@{a.username}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {suggestions.tags.length > 0 && (
                      <div className="suggest-group">
                        <div className="suggest-group-label">Tags</div>
                        <div className="suggest-tags-row">
                          {suggestions.tags.map((t) => (
                            <span
                              key={t.id}
                              className={`suggest-tag${allSuggestions.findIndex(x => x._kind === 'tag' && x.id === t.id) === highlightedIdx ? ' highlighted' : ''}`}
                              onMouseDown={() => commitSearch(t.tag)}
                              dangerouslySetInnerHTML={{ __html: hlText(t.tag, search) }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    <div
                      className="suggest-see-all"
                      onMouseDown={() => commitSearch(search)}
                    >
                      See all results for "{search}" →
                    </div>
                  </div>
                )}
              </div>
            </div>

            {isWritePage ? (
              <div className={`nav-user-buttons `}>
                <div className={`nav-bell`} onClick={demoUser}></div>
                <div
                  className={`nav-write ${!showWriteButton ? 'hidden' : ''} ${
                    isWritePage ? 'black' : ''
                  }`}
                  onClick={handleWriteClick}
                >
                  <div className={`write-icon-container`}></div>

                  <div className=" memo-text "></div>
                </div>
                <div className="bell-icon-container"></div>

                <div
                  className={`nav-user-profile-div`}
                  onClick={handleProfileClick}
                >
                  {user && user.profileImage && (
                    <div className={`profile-div`} onClick={handleProfileClick}>
                      <img src={profileImageSrc} alt="user profile icon" />
                    </div>
                  )}

                  {user && !user.profileImage && (
                    <div className={`profile-div`} onClick={handleProfileClick}>
                      <img src={quill} alt="user profile icon" />
                    </div>
                  )}

                  {!user && (
                    <div className={`profile-div`} onClick={userOutline}>
                      <img src={profileImageSrc} alt="user profile icon" />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={`nav-user-buttons `}>
                <div className={`nav-bell`} onClick={demoUser}></div>
                <div
                  className={`nav-write ${!showWriteButton ? 'hidden' : ''} ${
                    isWritePage ? 'black' : ''
                  }`}
                  onClick={handleWriteClick}
                >
                  <div className={`write-icon-container`}>
                    <img
                      className={`write-icon`}
                      src={writeIcon}
                      alt="write symbol"
                    ></img>
                  </div>

                  <div className=" memo-text ">Write</div>
                </div>
                <div className="bell-icon-container">
                  {showWriteButton && (
                    <img src={bellIcon} alt="write symbol"></img>
                  )}
                </div>

                <div
                  className={`nav-user-profile-div`}
                  onClick={handleProfileClick}
                >
                  {user && user.profileImage && (
                    <div className={`profile-div`} onClick={handleProfileClick}>
                      <img src={profileImageSrc} alt="user profile icon" />
                    </div>
                  )}

                  {user && !user.profileImage && (
                    <div className={`profile-div`} onClick={handleProfileClick}>
                      <img src={quill} alt="user profile icon" />
                    </div>
                  )}

                  {!user && (
                    <div className={`profile-div`} onClick={userOutline}>
                      <img src={profileImageSrc} alt="user profile icon" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </nav>
      )}






      

      {/* // For no user and on any page other than landing */}

      {!user && !isLandingPage && (
        <nav className={`nav-bar logged flexcenter ${navColor}`}>
          <div className={`nav-buttons memo-text ${buttonStylings}`}>
            <div className="flexcenter">
              <div className="logo small" onClick={handleLogoClick}>
                <img src={mediumLogoSmall} alt="medium cirlce logo" />
              </div>

              {windowSize > 700 && (
                <div
                  className={`nav-search ${isWritePage ? 'black' : ''}`}
                  style={{ position: 'relative' }}
                  ref={searchContainerRef}
                >
                  {isWritePage && (
                    <div
                      className="maginfy-container scaled-down"
                      onClick={newSearch}
                    >
                      <img src={magnifyGlassBlack} alt="medium cirlce logo" />
                    </div>
                  )}
                  {!isWritePage && (
                    <div className="maginfy-container" onClick={newSearch}>
                      <img
                        className=""
                        src={magnifyGlass}
                        alt="medium cirlce logo"
                      />
                    </div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      newSearch();
                    }}
                  >
                    <label>
                      <input
                        ref={searchInputRef}
                        className={`search-field ${isWritePage ? 'black' : ''}`}
                        type="search"
                        value={search}
                        onChange={handleSearchChange}
                        onKeyDown={handleSuggestKeyDown}
                        onFocus={() => search.length >= 2 && setShowSuggestions(
                          suggestions.stories.length > 0 || suggestions.authors.length > 0 || suggestions.tags.length > 0
                        )}
                        placeholder={'Search Medium'}
                        autoComplete="off"
                      />
                    </label>
                  </form>

                  {showSuggestions && (
                    <div className="suggest-dropdown">
                      {suggestions.stories.length > 0 && (
                        <div className="suggest-group">
                          <div className="suggest-group-label">Stories</div>
                          {suggestions.stories.map((s) => (
                            <div
                              key={s.id}
                              className={`suggest-item${allSuggestions.findIndex(x => x._kind === 'story' && x.id === s.id) === highlightedIdx ? ' highlighted' : ''}`}
                              onMouseDown={() => commitSearch(s.title)}
                            >
                              <span className="suggest-title" dangerouslySetInnerHTML={{ __html: hlText(s.title, search) }} />
                              <span className="suggest-meta">{s.authorName}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {suggestions.authors.length > 0 && (
                        <div className="suggest-group">
                          <div className="suggest-group-label">Authors</div>
                          {suggestions.authors.map((a) => (
                            <div
                              key={a.id}
                              className={`suggest-item${allSuggestions.findIndex(x => x._kind === 'author' && x.id === a.id) === highlightedIdx ? ' highlighted' : ''}`}
                              onMouseDown={() => commitSearch(a.name)}
                            >
                              <span className="suggest-title" dangerouslySetInnerHTML={{ __html: hlText(a.name, search) }} />
                              <span className="suggest-meta">@{a.username}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {suggestions.tags.length > 0 && (
                        <div className="suggest-group">
                          <div className="suggest-group-label">Tags</div>
                          <div className="suggest-tags-row">
                            {suggestions.tags.map((t) => (
                              <span
                                key={t.id}
                                className={`suggest-tag${allSuggestions.findIndex(x => x._kind === 'tag' && x.id === t.id) === highlightedIdx ? ' highlighted' : ''}`}
                                onMouseDown={() => commitSearch(t.tag)}
                                dangerouslySetInnerHTML={{ __html: hlText(t.tag, search) }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      <div
                        className="suggest-see-all"
                        onMouseDown={() => commitSearch(search)}
                      >
                        See all results for "{search}" →
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {isWritePage ? (
              <div className={`nav-user-buttons `}>
                <div className={`nav-bell`} onClick={demoUser}></div>
                <div
                  className={`nav-write ${!showWriteButton ? 'hidden' : ''} ${
                    isWritePage ? 'black' : ''
                  }`}
                  onClick={handleWriteClick}
                >
                  <div className={`write-icon-container`}></div>

                  <div className=" memo-text "></div>
                </div>
                <div className="bell-icon-container"></div>

                <div
                  className={`nav-user-profile-div`}
                  onClick={handleProfileClick}
                >
                  <div className={`profile-div`} onClick={handleProfileClick}>
                    <img src={userOutline} alt="user profile icon" />
                  </div>
                </div>
              </div>
            ) : (
              <div className={`nav-user-buttons `}>
                <div className={`nav-bell`} onClick={demoUser}></div>
                <div
                  className={`nav-write ${!showWriteButton ? 'hidden' : ''} ${
                    isWritePage ? 'black' : ''
                  }`}
                  onClick={handleWriteClick}
                >
                  <div className={`write-icon-container`}>
                    <img
                      className={`write-icon`}
                      src={writeIcon}
                      alt="write symbol"
                    ></img>
                  </div>

                  <div className=" memo-text ">Write</div>
                </div>
                <div className="bell-icon-container">
                  {showWriteButton && (
                    <img src={bellIcon} alt="write symbol"></img>
                  )}
                </div>

                <div
                  className={`nav-user-profile-div`}
                  onClick={handleProfileClick}
                >
                  <div className={`profile-div`} onClick={handleProfileClick}>
                    <img src={userOutline} alt="user profile icon" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </nav>
      )}

      {/* // For no user and at landing page */}
      {!user && isLandingPage && (
        <nav className={`nav-bar flexcenter ${navColor}`}>
          <div className={`nav-buttons memo-text ${buttonStylings}`}>
            <div className="logo large" onClick={handleLogoClick}>
              <img src={mediumLogoLarge} alt="medium cirlce logo"></img>
            </div>

            <div className={`nav-link-buttons ${buttonStylings}`}>
              <div
                className={`nav-button ${buttonStylings}`}
                onClick={handleStoryClick}
              >
                Our Story
              </div>
              <div
                className={`nav-button ${buttonStylings}`}
                onClick={demoUser}
              >
                Demo User
              </div>
              <div
                className={`nav-button ${buttonStylings}`}
                onClick={handleWriteClick}
              >
                Write
              </div>
              <div
                className={`sign-in-nav-button nav-button2 ${buttonStylings}`}
                onClick={handleSigninClick}
              >
                Sign In
              </div>
              <div
                className={`get-started button ${buttonStyle}`}
                onClick={handleSignupClick}
              >
                Get started
              </div>
            </div>
          </div>
        </nav>
      )}
    </>
  );
}

export default Navigation;
