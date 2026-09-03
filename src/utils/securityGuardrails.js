import { auth } from '../firebase';

/**
 * Checks if an Admin Gmail / Admin account is logged in
 */
function isAdminLoggedIn() {
  if (typeof window === 'undefined') return false;

  // 1. Check Admin Session Storage flags (instant synchronous check)
  if (
    sessionStorage.getItem('isAdminAuthenticated') === 'true' ||
    sessionStorage.getItem('adminUser') ||
    sessionStorage.getItem('hss_session')
  ) {
    return true;
  }

  // 2. Check Firebase Auth user if available
  try {
    if (auth?.currentUser?.email) {
      return true;
    }
  } catch (_) {}

  return false;
}

let activeToastTimeout = null;

/**
 * Displays a styled on-screen Security & Intellectual Property warning banner/toast
 */
function showSecurityWarningNotice() {
  if (typeof document === 'undefined') return;

  // Remove existing notice if already displayed
  const existingNotice = document.getElementById('security-warning-notice-toast');
  if (existingNotice) {
    existingNotice.remove();
  }

  if (activeToastTimeout) {
    clearTimeout(activeToastTimeout);
  }

  const toast = document.createElement('div');
  toast.id = 'security-warning-notice-toast';
  toast.style.cssText = `
    position: fixed;
    top: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(-10px) scale(0.95);
    z-index: 999999;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(239, 68, 68, 0.5);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 0 25px rgba(239, 68, 68, 0.25);
    border-radius: 12px;
    padding: 16px 20px;
    color: #f8fafc;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 560px;
    width: calc(100% - 32px);
    opacity: 0;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: auto;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  `;

  toast.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <div style="font-size: 20px; flex-shrink: 0; line-height: 1.2;">🛑</div>
      <div style="flex-grow: 1;">
        <div style="color: #ef4444; font-size: 15px; font-weight: 800; letter-spacing: -0.01em; margin-bottom: 6px; font-family: system-ui, sans-serif;">
          SECURITY WARNING & INTELLECTUAL PROPERTY NOTICE
        </div>
        <div style="color: #60a5fa; font-size: 13px; font-weight: 500; line-height: 1.45; font-family: system-ui, sans-serif;">
          This application, its source code, design assets, and interface are protected by copyright law and security guardrails.<br/>
          <span style="color: #94a3b8; font-weight: 400;">Unauthorized inspect, scraping, cloning, or code extraction is strictly monitored and prohibited.</span>
        </div>
      </div>
      <button id="close-security-toast-btn" style="background: transparent; border: none; color: #94a3b8; font-size: 18px; cursor: pointer; padding: 0 4px; line-height: 1; margin-left: 4px;" title="Dismiss">&times;</button>
    </div>
  `;

  document.body.appendChild(toast);

  // Trigger animation after render
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0) scale(1)';
  });

  const closeBtn = document.getElementById('close-security-toast-btn');
  if (closeBtn) {
    closeBtn.onclick = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-10px) scale(0.95)';
      setTimeout(() => toast.remove(), 250);
    };
  }

  // Auto-dismiss after 4 seconds
  activeToastTimeout = setTimeout(() => {
    if (toast && document.body.contains(toast)) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-10px) scale(0.95)';
      setTimeout(() => toast.remove(), 250);
    }
  }, 4000);
}

export function initSecurityGuardrails() {
  if (typeof window === 'undefined') return;

  // 1. Console Warning & Tamper Notice
  const printConsoleWarning = () => {
    if (isAdminLoggedIn()) return; // Don't warn if admin is logged in
    try {
      console.log(
        '%c🛑 SECURITY WARNING & INTELLECTUAL PROPERTY NOTICE',
        'color: #ef4444; font-size: 20px; font-weight: 800; font-family: system-ui;'
      );
      console.log(
        '%cThis application, its source code, design assets, and interface are protected by copyright law and security guardrails.\nUnauthorized inspect, scraping, cloning, or code extraction is strictly monitored and prohibited.',
        'color: #3b82f6; font-size: 13px; font-weight: 500; font-family: system-ui;'
      );
    } catch (_) {}
  };

  printConsoleWarning();

  // 2. Right-Click Context Menu Protection (Allows links, text selection, and form inputs)
  const handleContextMenu = (e) => {
    // Allow context menu for logged-in admin
    if (isAdminLoggedIn()) {
      return;
    }

    const tag = e.target.tagName?.toLowerCase();
    const isLink = e.target.closest('a') !== null;
    const isInput = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
    
    // Allow right-click on links, inputs, and form controls so students can "Open in new tab", copy links, etc.
    if (isLink || isInput) {
      return;
    }
    // Block right-click on background images/logos to prevent easy asset theft
    if (tag === 'img' || e.target.closest('.no-right-click')) {
      e.preventDefault();
      showSecurityWarningNotice();
    }
  };

  // 3. Developer Keyboard Shortcuts Deterrence
  const handleKeyDown = (e) => {
    // Allow F12 and inspect shortcuts if admin Gmail / Admin user is logged in
    if (isAdminLoggedIn()) {
      return true;
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const ctrlKey = isMac ? e.metaKey : e.ctrlKey;
    const key = e.key ? e.key.toLowerCase() : '';
    const keyCode = e.keyCode || e.which;

    // F12 (DevTools Inspector)
    if (key === 'f12' || keyCode === 123) {
      e.preventDefault();
      showSecurityWarningNotice();
      printConsoleWarning();
      return false;
    }

    // Shortcuts using Ctrl or Cmd:
    if (ctrlKey) {
      // Ctrl+U (View Source)
      if (key === 'u' || keyCode === 85) {
        e.preventDefault();
        showSecurityWarningNotice();
        printConsoleWarning();
        return false;
      }
      // Ctrl+S (Save Webpage HTML)
      if (key === 's' || keyCode === 83) {
        e.preventDefault();
        showSecurityWarningNotice();
        printConsoleWarning();
        return false;
      }
      // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C (DevTools Console & Element Inspector)
      if (e.shiftKey && (key === 'i' || key === 'j' || key === 'c' || keyCode === 73 || keyCode === 74 || keyCode === 67)) {
        e.preventDefault();
        showSecurityWarningNotice();
        printConsoleWarning();
        return false;
      }
    }
  };

  // 4. Image Drag & Drop Prevention
  const handleDragStart = (e) => {
    if (isAdminLoggedIn()) {
      return;
    }
    if (e.target && e.target.tagName && e.target.tagName.toLowerCase() === 'img') {
      e.preventDefault();
      showSecurityWarningNotice();
      return false;
    }
  };

  // 5. Attach Global Event Listeners
  document.addEventListener('contextmenu', handleContextMenu);
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('dragstart', handleDragStart);

  // Return cleanup function
  return () => {
    document.removeEventListener('contextmenu', handleContextMenu);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('dragstart', handleDragStart);
  };
}
