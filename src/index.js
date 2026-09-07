import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';

// Handle transient Firebase/Firestore & IndexedDB stream closure or tab sleep events gracefully
if (typeof window !== 'undefined') {
  const isTransientFirebaseError = (eventOrErr) => {
    if (!eventOrErr) return false;
    const reason = eventOrErr?.reason || eventOrErr?.error || eventOrErr;
    const msg = (
      String(eventOrErr?.message || '') + ' ' +
      String(reason?.message || '') + ' ' +
      String(reason || '')
    ).toLowerCase();
    const stack = (
      String(eventOrErr?.stack || '') + ' ' +
      String(reason?.stack || '')
    ).toLowerCase();

    return (
      msg.includes('database is closing') ||
      msg.includes('database is hidden') ||
      msg.includes('closing/hidden') ||
      msg.includes('indexeddblocalpersistence') ||
      msg.includes("reading 'ae'") ||
      msg.includes('reading "ae"') ||
      msg.includes('b815') ||
      msg.includes('onwatchstreamchange') ||
      stack.includes('onwatchstreamchange') ||
      (msg.includes('internal assertion failed') &&
        (msg.includes('b815') || msg.includes('unexpected state') || stack.includes('onwatchstreamchange')))
    );
  };

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      if (isTransientFirebaseError(event)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
      }
    },
    true
  );

  window.addEventListener(
    'error',
    (event) => {
      if (isTransientFirebaseError(event)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
      }
    },
    true
  );

  const prevOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    if (isTransientFirebaseError(error || message)) {
      return true;
    }
    if (typeof prevOnError === 'function') {
      return prevOnError.apply(this, arguments);
    }
    return false;
  };
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
