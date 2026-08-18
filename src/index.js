import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';

// Handle transient IndexedDB closure / hidden tab events gracefully
if (typeof window !== 'undefined') {
  const isIdbTransientError = (err) => {
    const msg = String(err?.message || err?.reason?.message || err?.reason || err || '').toLowerCase();
    return msg.includes('database is closing') ||
           msg.includes('database is hidden') ||
           msg.includes('closing/hidden') ||
           msg.includes('indexeddblocalpersistence');
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (isIdbTransientError(event?.reason)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }
  }, true);

  window.addEventListener('error', (event) => {
    if (isIdbTransientError(event?.error || event?.message)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }
  }, true);
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// Register service worker for PWA installability (production only)
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((reg) => {
        console.log('SW registered:', reg.scope);
      })
      .catch((err) => {
        console.log('SW registration failed:', err);
      });
  });
} else if ('serviceWorker' in navigator) {
  // Automatically unregister stale service worker on localhost to prevent dev cache sticking
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      reg.unregister();
    }
  });
}
