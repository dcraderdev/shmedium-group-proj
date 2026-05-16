const SET_BOOKMARK = 'bookmark/SET_BOOKMARK';

const setBookmarkAction = (data) => ({ type: SET_BOOKMARK, payload: data });

const initialState = {};

export const addBookmark = (storyId) => async (dispatch) => {
	const res = await fetch(`/api/story/${storyId}/bookmark`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
	});
	if (res.ok) {
		const data = await res.json();
		dispatch(setBookmarkAction({ storyId, ...data }));
		return data;
	}
	const data = await res.json();
	return data;
};

export const removeBookmark = (storyId) => async (dispatch) => {
	const res = await fetch(`/api/story/${storyId}/bookmark`, {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
	});
	if (res.ok) {
		const data = await res.json();
		dispatch(setBookmarkAction({ storyId, ...data }));
		return data;
	}
	const data = await res.json();
	return data;
};

export default function reducer(state = initialState, action) {
	switch (action.type) {
		case SET_BOOKMARK: {
			const { storyId, hasBookmarked, bookmarkCount } = action.payload;
			return { ...state, [storyId]: { hasBookmarked, bookmarkCount } };
		}
		default:
			return state;
	}
}
