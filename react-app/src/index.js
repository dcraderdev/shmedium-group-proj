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

// Cache the app shell offline with Workbox (production only).
serviceWorkerRegistration.register();

// Log Core Web Vitals to the console. Swap console.log for a Sentry/analytics
// sender (e.g. sendToAnalytics) to track regressions in production.
reportWebVitals(console.log);
