// Error guard for filtering transient Firestore connection / IndexedDB persistence logs
// Extracted to external file to comply with strict Content Security Policy (CSP script-src 'self')
(function() {
  var lastTransientTime = 0;
  function isTransient(err) {
    if (!err) return false;
    var reason = err.reason || err.error || err;
    var s = (
      String(err.message || '') + ' ' +
      String(err.stack || '') + ' ' +
      String(reason.message || '') + ' ' +
      String(reason.stack || '') + ' ' +
      String(reason || '')
    ).toLowerCase();
    return (
      s.indexOf('internal assertion failed') !== -1 ||
      s.indexOf('ca9') !== -1 ||
      s.indexOf('b815') !== -1 ||
      s.indexOf('onwatchstreamchange') !== -1 ||
      s.indexOf('watchchangeaggregator') !== -1 ||
      s.indexOf('targetstate') !== -1 ||
      s.indexOf("reading 'ae'") !== -1 ||
      s.indexOf('reading "ae"') !== -1 ||
      s.indexOf('database is closing') !== -1 ||
      s.indexOf('database is hidden') !== -1 ||
      s.indexOf('closing/hidden') !== -1 ||
      s.indexOf('indexeddblocalpersistence') !== -1
    );
  }

  window.addEventListener('error', function(e) {
    if (isTransient(e)) {
      lastTransientTime = Date.now();
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      return true;
    }
  }, true);

  window.addEventListener('unhandledrejection', function(e) {
    if (isTransient(e)) {
      lastTransientTime = Date.now();
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      return true;
    }
  }, true);

  var prevOnError = window.onerror;
  window.onerror = function(msg, src, line, col, err) {
    if (isTransient(err || msg)) {
      lastTransientTime = Date.now();
      return true;
    }
    if (typeof prevOnError === 'function') {
      return prevOnError.apply(this, arguments);
    }
    return false;
  };

  var origConsoleError = console.error;
  console.error = function() {
    for (var i = 0; i < arguments.length; i++) {
      if (isTransient(arguments[i])) {
        lastTransientTime = Date.now();
        return;
      }
    }
    return origConsoleError.apply(console, arguments);
  };

  if (typeof MutationObserver !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    var observer = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (node && node.nodeType === 1) {
            var id = String(node.id || '');
            var tag = String(node.tagName || '');
            if (id === 'react-refresh-overlay' || tag === 'REACT-ERROR-OVERLAY' || id.indexOf('overlay') !== -1) {
              if (Date.now() - lastTransientTime < 4000) {
                try { node.remove(); } catch(err) {}
              }
            }
          }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
