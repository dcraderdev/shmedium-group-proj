// frontend/src/components/Navigation/index.js
import React, { useEffect, useRef, useContext, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';

import './Navigation.css';
import { WindowContext } from '../../context/WindowContext';
import { ModalContext } from '../../context/ModalContext';
import * as sessionActions from '../../store/session';
import { fetchNotifications, markAllRead, markOneRead } from '../../store/notifications';
import mediumLogoSmall from '../../public/medium-logo-circles-white.svg';
import mediumLogoLarge from '../../public/medium-logo-with-cirlces.svg';

import openBook from '../../public/open-book.png';
import quill from '../../public/quill.png';
import userOutline from '../../public/user-outline.png';
import fountainPen from '../../public/fountain-pen.png';

import writeIcon from '../../public/write-icon.svg';
import bellIcon from '../../public/bell-icon.svg';
import magnifyGlass from '../../public/magnify-glass.svg';
import magnifyGlassBlack from '../../public/magnify-glass-black.svg';

const colorSchemes = {
  '/': ['nav-yellow', 'nav-white', 'button-black', 'button-green'],
  '/home': ['nav-white', 'nav-white', 'button-black', 'button-green'],
  '/write': ['nav-red', 'nav-white', 'button-black', 'button-black'],
  '/about': ['nav-white', 'nav-white', 'button-black', 'button-black'],
  default: ['nav-white', 'nav-white', 'button-black', 'button-black'],
};

const profileImages = {
  quill: quill,
  'user-outline': userOutline,
  'open-book': openBook,
  'fountain-pen': fountainPen,
};

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function notificationText(n) {
  const actor = n.actorUsername || 'Someone';
  const title = n.storyTitle ? `"${n.storyTitle}"` : 'your story';
  switch (n.type) {
    case 'clap':    return `${actor} clapped for ${title}`;
    case 'comment': return `${actor} commented on ${title}`;
    case 'follow':  return `${actor} started following you`;
    case 'mention': return `${actor} mentioned you in ${title}`;
    case 'reply':   return `${actor} also commented on ${title}`;
    default:        return `${actor} interacted with ${title}`;
  }
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
  const [bellOpen, setBellOpen] = useState(false);

  const user = useSelector((state) => state.session.user);
  const { notifications, unreadCount } = useSelector((s) => s.notifications);

  const { scrollPosition, windowSize, searchInputRef } =
    useContext(WindowContext);

  const colorScheme = useRef(
    colorSchemes[location.pathname] || colorSchemes.default
  );
  const [navColor, setNavColor] = useState(colorScheme[0]);
  const [buttonStyle, setButtonStyle] = useState(colorScheme[2]);
  const [profileImageSrc, setProfileImageSrc] = useState('');
  const [isLandingPage, setIsLandingPage] = useState(false);
  const [isWritePage, setIsWritePage] = useState(false);
  const [isHomePage, setIsHomePage] = useState(false);
  const [showWriteButton, setShowWriteButton] = useState(true);

  const bellRef = useRef(null);

  // Fetch notifications on mount and poll every 30s when logged in
  useEffect(() => {
    if (!user) return;
    dispatch(fetchNotifications());
    const interval = setInterval(() => dispatch(fetchNotifications()), 30000);
    return () => clearInterval(interval);
  }, [dispatch, user]);

  // Close bell dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

    let newColorScheme =
      colorSchemes[location.pathname] || colorSchemes.default;

    if (colorSchemes[location.pathname]) {
      newColorScheme = colorSchemes[location.pathname];
    }

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

  const newSearch = async () => {
    dispatch(sessionActions.search(search));
    dispatch(sessionActions.setFeed(search));
    dispatch(sessionActions.setSubFeed('stories'));
    if (location.pathname !== '/home') {
      history.push(`/home`);
    }
  };

  const handleBellClick = (e) => {
    e.stopPropagation();
    setBellOpen((prev) => !prev);
  };

  const handleMarkAllRead = (e) => {
    e.stopPropagation();
    dispatch(markAllRead());
  };

  const handleNotifItemClick = (n) => {
    if (!n.read) dispatch(markOneRead(n.id));
    setBellOpen(false);
    if (n.targetType === 'story' && n.targetId) {
      history.push(`/story/${n.targetId}`);
    }
  };

  const handleViewAll = () => {
    setBellOpen(false);
    history.push('/notifications');
  };

  const BellButton = ({ className }) => (
    <div className={`bell-icon-container bell-wrapper ${className || ''}`} ref={bellRef}>
      <div className="bell-trigger" onClick={handleBellClick}>
        {showWriteButton && (
          <img src={bellIcon} alt="notifications" />
        )}
        {unreadCount > 0 && (
          <span className="bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </div>

      {bellOpen && (
        <div className="bell-dropdown">
          <div className="bell-dropdown-header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button className="bell-mark-all" onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="bell-dropdown-list">
            {notifications.length === 0 ? (
              <div className="bell-empty">No notifications yet.</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`bell-notif-item ${!n.read ? 'bell-notif-unread' : ''}`}
                  onClick={() => handleNotifItemClick(n)}
                >
                  {!n.read && <span className="bell-notif-dot" />}
                  <div className="bell-notif-body">
                    <span className="bell-notif-text">{notificationText(n)}</span>
                    <span className="bell-notif-time">{timeAgo(n.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="bell-dropdown-footer" onClick={handleViewAll}>
            See all notifications
          </div>
        </div>
      )}
    </div>
  );

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
                    setSearch('');
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
                      onChange={(e) => setSearch(e.target.value)}
                      required
                      placeholder={'Search Medium'}
                    />
                  </label>
                </form>
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
                <BellButton />

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
                <BellButton />

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
                <div className={`nav-search ${isWritePage ? 'black' : ''}`}>
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
                      setSearch('');
                    }}
                  >
                    <label>
                      <input
                        ref={searchInputRef}
                        className={`search-field ${isWritePage ? 'black' : ''}`}
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        required
                        placeholder={'Search Medium'}
                      />
                    </label>
                  </form>
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
