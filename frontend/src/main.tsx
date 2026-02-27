import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import './index.css';
import { autoSetupLocalRelay } from './lib/relayConfig';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // non-fatal
    });
  });
}

// Auto-detect local relay on startup (non-blocking)
autoSetupLocalRelay().then((enabled) => {
  if (enabled) {
    console.log('[NostrMaxi] Local relay detected and enabled for caching');
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
