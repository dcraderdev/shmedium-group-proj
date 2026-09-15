import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";

import configureStore from "./store";
import * as sessionActions from "./store/session";
import App from "./App";

import { WindowProvider } from './context/WindowContext';
import { ModalProvider } from './context/ModalContext';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import reportWebVitals from './reportWebVitals';

import "./index.css";

const store = configureStore();

if (process.env.NODE_ENV !== "production") {
	window.store = store;
	window.sessionActions = sessionActions;
}

function Root() {
	return (
		<ModalProvider>
			<Provider store={store}>
				<BrowserRouter>
					<WindowProvider>
						<App />
					</WindowProvider>
				</BrowserRouter>
			</Provider>
		</ModalProvider>
	);
}

ReactDOM.render(
	<React.StrictMode>
		<Root />
	</React.StrictMode>,
	document.getElementById("root")
);

// Service worker intentionally disabled. The old cache-first worker pinned
// returning visitors to whatever build they first loaded, so deployed fixes
// never reached them (see public/sw.js for the full write-up).
//
// unregister() tears down the worker for clients that already have one; the
// kill-switch in public/sw.js covers clients whose cached main bundle is too
// old to even run this line. Both are needed — keep them until it is certain
// no client is still holding the old worker.
serviceWorkerRegistration.unregister();

// Log Core Web Vitals to the console. Swap console.log for a Sentry/analytics
// sender (e.g. sendToAnalytics) to track regressions in production.
reportWebVitals(console.log);
