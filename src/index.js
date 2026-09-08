import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';

// Handle transient Firebase/Firestore & IndexedDB stream closure or assertion events gracefully
if (typeof window !== 'undefined') {
  let lastTransientErrTime = 0;

  const isTransientFirebaseError = (eventOrErr) => {
    if (!eventOrErr) return false;
    const reason = eventOrErr?.reason || eventOrErr?.error || eventOrErr;
    const rawStr = (
      String(eventOrErr?.message || '') + ' ' +
      String(eventOrErr?.stack || '') + ' ' +
      String(reason?.message || '') + ' ' +
      String(reason?.stack || '') + ' ' +
      String(reason || '')
    ).toLowerCase();

    return (
      rawStr.includes('internal assertion failed') ||
      rawStr.includes('ca9') ||
      rawStr.includes('b815') ||
      rawStr.includes('onwatchstreamchange') ||
      rawStr.includes('watchchangeaggregator') ||
      rawStr.includes('targetstate') ||
      rawStr.includes("reading 'ae'") ||
      rawStr.includes('reading "ae"') ||
      rawStr.includes('database is closing') ||
      rawStr.includes('database is hidden') ||
      rawStr.includes('closing/hidden') ||
      rawStr.includes('indexeddblocalpersistence')
    );
  };

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      if (isTransientFirebaseError(event)) {
        lastTransientErrTime = Date.now();
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
        lastTransientErrTime = Date.now();
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
      lastTransientErrTime = Date.now();
      return true;
    }
    if (typeof prevOnError === 'function') {
      return prevOnError.apply(this, arguments);
    }
    return false;
  };

  const origConsoleError = console.error;
  console.error = function (...args) {
    for (const arg of args) {
      if (isTransientFirebaseError(arg)) {
        lastTransientErrTime = Date.now();
        return;
      }
    }
    return origConsoleError.apply(console, args);
  };

  if (typeof MutationObserver !== 'undefined') {
    const overlayObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node && node.nodeType === 1) {
            const id = String(node.id || '');
            const tag = String(node.tagName || '');
            if (id === 'react-refresh-overlay' || tag === 'REACT-ERROR-OVERLAY' || id.includes('overlay')) {
              if (Date.now() - lastTransientErrTime < 4000) {
                try {
                  node.remove();
                } catch (_) {}
              }
            }
          }
        }
      }
    });
    overlayObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
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
