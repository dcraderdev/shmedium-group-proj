const SET_NOTIFICATIONS = 'notifications/SET_NOTIFICATIONS';
const MARK_ALL_READ = 'notifications/MARK_ALL_READ';
const MARK_ONE_READ = 'notifications/MARK_ONE_READ';
const UPDATE_DIGEST = 'notifications/UPDATE_DIGEST';

const setNotifications = (notifications, unreadCount) => ({
  type: SET_NOTIFICATIONS,
  payload: { notifications, unreadCount },
});

const markAllReadAction = () => ({ type: MARK_ALL_READ });
const markOneReadAction = (id) => ({ type: MARK_ONE_READ, payload: id });
const updateDigestAction = (freq) => ({ type: UPDATE_DIGEST, payload: freq });

const initialState = { notifications: [], unreadCount: 0 };

export const fetchNotifications = () => async (dispatch) => {
  const res = await fetch('/api/notifications/');
  if (res.ok) {
    const data = await res.json();
    dispatch(setNotifications(data.notifications, data.unreadCount));
  }
};

export const fetchAllNotifications = () => async (dispatch) => {
  const res = await fetch('/api/notifications/all');
  if (res.ok) {
    const data = await res.json();
    dispatch(setNotifications(data.notifications, data.unreadCount));
  }
};

export const markAllRead = () => async (dispatch) => {
  const res = await fetch('/api/notifications/read', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.ok) dispatch(markAllReadAction());
};

export const markOneRead = (id) => async (dispatch) => {
  const res = await fetch(`/api/notifications/${id}/read`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.ok) dispatch(markOneReadAction(id));
};

export const updateDigestFrequency = (frequency) => async (dispatch) => {
  const res = await fetch('/api/notifications/digest', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frequency }),
  });
  if (res.ok) {
    const data = await res.json();
    dispatch(updateDigestAction(data.digestFrequency));
    return data;
  }
  return null;
};

export default function reducer(state = initialState, action) {
  switch (action.type) {
    case SET_NOTIFICATIONS:
      return {
        ...state,
        notifications: action.payload.notifications,
        unreadCount: action.payload.unreadCount,
      };
    case MARK_ALL_READ:
      return {
        ...state,
        unreadCount: 0,
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
      };
    case MARK_ONE_READ:
      return {
        ...state,
        unreadCount: Math.max(0, state.unreadCount - 1),
        notifications: state.notifications.map((n) =>
          n.id === action.payload ? { ...n, read: true } : n
        ),
      };
    case UPDATE_DIGEST:
      return { ...state, digestFrequency: action.payload };
    default:
      return state;
  }
}
