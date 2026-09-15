import { isSuperAdminEmail } from './authRoles';

/**
 * Authoritatively checks if a Super Admin is currently logged in.
 * When Super Admin is authenticated, all developer tools, shortcuts,
 * and context menus are fully unlocked.
 */
export function isSuperAdminLoggedIn() {
  if (typeof window === 'undefined') return false;

  try {
    // 1. Check Session Manager stored user
    const rawUser = sessionStorage.getItem('hss_session_user') || localStorage.getItem('hss_session_user');
    if (rawUser) {
      const user = JSON.parse(rawUser);
      if (user.role === 'SuperAdmin' || user.isSuperAdmin || user.role === 'superadmin') return true;
      if (user.email && isSuperAdminEmail(user.email)) return true;
    }

    // 2. Check Admin Portal legacy storage session
    if (sessionStorage.getItem('isAdminAuthenticated') === 'true') {
      const rawAdmin = sessionStorage.getItem('adminUser');
      if (rawAdmin) {
        const admin = JSON.parse(rawAdmin);
        if (admin.role === 'SuperAdmin' || admin.isSuperAdmin || (admin.email && isSuperAdminEmail(admin.email))) {
          return true;
        }
      }
    }

    // 3. Check Auth state flags
    const authState = localStorage.getItem('hss_auth_state');
    if (authState) {
      const parsed = JSON.parse(authState);
      if (parsed.email && isSuperAdminEmail(parsed.email)) return true;
      if (parsed.role === 'SuperAdmin') return true;
    }
  } catch (_) {}

  return false;
}

// Backward-compat alias
export const isAdminLoggedIn = isSuperAdminLoggedIn;

let activeToastTimeout = null;

/**
 * Displays a sleek, modern on-screen Security & Intellectual Property warning banner/modal
 */
export function showSecurityWarningNotice() {
  if (typeof document === 'undefined') return;

  const existingNotice = document.getElementById('security-warning-notice-toast');
  if (existingNotice) {
    existingNotice.remove();
  }

  if (activeToastTimeout) {
    clearTimeout(activeToastTimeout);
  }

  const toast = document.createElement('div');
  toast.id = 'security-warning-notice-toast';
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.style.cssText = `
    position: fixed;
    top: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(-10px) scale(0.95);
    z-index: 999999;
    background: rgba(15, 23, 42, 0.96);
    border: 1px solid rgba(239, 68, 68, 0.6);
    box-shadow: 0 20px 30px -5px rgba(0, 0, 0, 0.7), 0 0 25px rgba(239, 68, 68, 0.25);
    border-radius: 14px;
    padding: 16px 22px;
    color: #f8fafc;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 540px;
    width: calc(100% - 32px);
    opacity: 0;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: auto;
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  `;

  toast.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 14px;">
      <div style="font-size: 24px; flex-shrink: 0; line-height: 1.1;">🛑</div>
      <div style="flex-grow: 1;">
        <div style="color: #ef4444; font-size: 14.5px; font-weight: 800; letter-spacing: -0.01em; margin-bottom: 6px; font-family: system-ui, sans-serif;">
          SECURITY WARNING & INTELLECTUAL PROPERTY NOTICE
        </div>
        <div style="color: #93c5fd; font-size: 13px; font-weight: 500; line-height: 1.45; font-family: system-ui, sans-serif;">
          This application, its source code, design assets, and interface are protected by copyright law and security guardrails.<br/>
          <span style="color: #94a3b8; font-weight: 400; font-size: 12px;">Unauthorized inspect, scraping, cloning, or code extraction is strictly monitored and prohibited.</span>
        </div>
      </div>
      <button id="close-security-toast-btn" style="background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; padding: 0 4px; line-height: 1; margin-left: 4px;" title="Dismiss">&times;</button>
    </div>
  `;

  document.body.appendChild(toast);

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

  activeToastTimeout = setTimeout(() => {
    if (toast && document.body.contains(toast)) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-10px) scale(0.95)';
      setTimeout(() => toast.remove(), 250);
    }
  }, 4500);
}

/**
 * Initializes frontend anti-tamper security guardrails.
 * Full access is preserved for authenticated Super Admins.
 * Legitimate text selection and copying are permitted for all users.
 */
export function initSecurityGuardrails() {
  if (typeof window === 'undefined') return () => {};

  const printConsoleWarning = () => {
    if (isSuperAdminLoggedIn()) return;
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

  // 1. Right-Click Context Menu Protection
  // Allows copying selected text or typing in input/textarea, blocks inspect on code & elements
  const handleContextMenu = (e) => {
    if (isSuperAdminLoggedIn()) return;

    const tag = e.target.tagName?.toLowerCase();
    const isInput = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
    const selectedText = window.getSelection()?.toString()?.trim();

    // If user has highlighted text to copy, or is interacting with an input field: allow standard context menu
    if (isInput || (selectedText && selectedText.length > 0)) {
      return;
    }

    // Otherwise block right click (preventing "Inspect", "View Page Source", asset theft)
    e.preventDefault();
    showSecurityWarningNotice();
    printConsoleWarning();
  };

  // 2. Developer Keyboard Shortcuts Deterrence
  const handleKeyDown = (e) => {
    if (isSuperAdminLoggedIn()) return true;

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

    // Shortcuts using Ctrl or Cmd
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
      // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C (DevTools Console & Elements)
      if (e.shiftKey && (key === 'i' || key === 'j' || key === 'c' || keyCode === 73 || keyCode === 74 || keyCode === 67)) {
        e.preventDefault();
        showSecurityWarningNotice();
        printConsoleWarning();
        return false;
      }
    }
  };

  // 3. Image Drag & Drop Prevention
  const handleDragStart = (e) => {
    if (isSuperAdminLoggedIn()) return;
    if (e.target && e.target.tagName && e.target.tagName.toLowerCase() === 'img') {
      e.preventDefault();
      showSecurityWarningNotice();
      return false;
    }
  };

  // 4. DevTools Menu Detection via Window Outer-Inner Dimension Threshold
  let lastThresholdTrigger = 0;
  const handleResize = () => {
    if (isSuperAdminLoggedIn()) return;
    const widthThreshold = window.outerWidth - window.innerWidth > 160;
    const heightThreshold = window.outerHeight - window.innerHeight > 160;

    if (widthThreshold || heightThreshold) {
      const now = Date.now();
      if (now - lastThresholdTrigger > 8000) {
        lastThresholdTrigger = now;
        printConsoleWarning();
        try { console.clear(); } catch (_) {}
      }
    }
  };

  // Attach event listeners
  document.addEventListener('contextmenu', handleContextMenu);
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('dragstart', handleDragStart);
  window.addEventListener('resize', handleResize, { passive: true });

  return () => {
    document.removeEventListener('contextmenu', handleContextMenu);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('dragstart', handleDragStart);
    window.removeEventListener('resize', handleResize);
  };
}
