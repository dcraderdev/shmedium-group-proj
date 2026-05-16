const SET_HIGHLIGHTS = 'highlight/SET_HIGHLIGHTS';

const setHighlightsAction = (storyId, highlights) => ({
	type: SET_HIGHLIGHTS,
	payload: { storyId, highlights },
});

const initialState = {};

export const fetchHighlights = (storyId) => async (dispatch) => {
	const res = await fetch(`/api/story/${storyId}/highlights`);
	if (res.ok) {
		const data = await res.json();
		dispatch(setHighlightsAction(storyId, data.highlights));
	}
};

export const clipHighlight = (storyId, text) => async (dispatch) => {
	const res = await fetch(`/api/story/${storyId}/highlight`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ text }),
	});
	const data = await res.json();
	if (res.ok) {
		dispatch(setHighlightsAction(storyId, data.highlights));
		return { ok: true, id: data.id };
	}
	return { ok: false, error: data.error };
};

export const unclipHighlight = (highlightId, storyId) => async (dispatch) => {
	const res = await fetch(`/api/story/highlight/${highlightId}`, {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
	});
	if (res.ok) {
		const data = await res.json();
		dispatch(setHighlightsAction(storyId, data.highlights));
	}
};

export default function reducer(state = initialState, action) {
	switch (action.type) {
		case SET_HIGHLIGHTS: {
			const { storyId, highlights } = action.payload;
			return { ...state, [storyId]: highlights };
		}
		default:
			return state;
	}
}
