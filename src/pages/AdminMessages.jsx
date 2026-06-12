import React, { useEffect, useState, useRef } from 'react';
import { Lock, Unlock, AlertCircle, RefreshCw } from 'lucide-react';

const ADMIN_PASSWORD_HASH = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'; // SHA-256 of 'admin123'

async function hashPassword(plainText) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plainText);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function AdminMessages() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  // CAPTCHA and rate-limiting lockout states
  const [captcha, setCaptcha] = useState({ num1: 0, num2: 0, operation: '+', result: 0 });
  const [captchaInput, setCaptchaInput] = useState('');
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);
  const [shuffleValue, setShuffleValue] = useState('? + ?');
  const captchaIntervalRef = useRef(null);

  // Helper to generate a dynamic math challenge with a 1-second randomization animation
  const generateCaptcha = () => {
    if (captchaIntervalRef.current) {
      clearInterval(captchaIntervalRef.current);
      captchaIntervalRef.current = null;
    }
    setIsShuffling(true);
    setCaptchaInput('');

    let count = 0;
    const intervalId = setInterval(() => {
      const ops = ['+', '-'];
      const randomOp = ops[ops.length - 1 - Math.floor(Math.random() * ops.length)];
      const r1 = Math.floor(Math.random() * 40) + 1;
      const r2 = Math.floor(Math.random() * 30) + 1;
      setShuffleValue(`${r1} ${randomOp} ${r2}`);
      
      count += 100;
      if (count >= 1000) {
        clearInterval(intervalId);
        if (captchaIntervalRef.current === intervalId) {
          captchaIntervalRef.current = null;
        }
        
        const operations = ['+', '-'];
        const op = operations[Math.floor(Math.random() * operations.length)];
        let n1, n2, res;
        if (op === '+') {
          n1 = Math.floor(Math.random() * 20) + 1;
          n2 = Math.floor(Math.random() * 20) + 1;
          res = n1 + n2;
        } else {
          n1 = Math.floor(Math.random() * 30) + 10;
          n2 = Math.floor(Math.random() * n1) + 1;
          res = n1 - n2;
        }
        setCaptcha({ num1: n1, num2: n2, operation: op, result: res });
        setIsShuffling(false);
      }
    }, 100);
    captchaIntervalRef.current = intervalId;
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (captchaIntervalRef.current) {
        clearInterval(captchaIntervalRef.current);
      }
    };
  }, []);

  // Helper to log out
  const handleLogout = (reason) => {
    sessionStorage.removeItem('isAdminAuthenticated');
    sessionStorage.removeItem('admin_session_id');
    setIsAuthenticated(false);
    generateCaptcha(); // Generate fresh CAPTCHA on logout
    
    if (reason === 'logged_out_elsewhere') {
      setAuthError('You have been logged out because a new session was started in another tab.');
    } else if (reason === 'inactivity') {
      setAuthError('You have been logged out due to inactivity.');
    } else {
      localStorage.removeItem('admin_active_session_id');
      try {
        const channel = new BroadcastChannel('hss_admin_session');
        channel.postMessage({ type: 'LOGOUT' });
        channel.close();
      } catch (err) {
        // ignore
      }
      setAuthError('');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    const lockoutUntil = parseInt(localStorage.getItem('admin_lockout_until') || '0');
    if (lockoutUntil > Date.now()) {
      setAuthError('Console is locked due to too many failed attempts.');
      return;
    }

    if (captchaInput.trim() !== captcha.result.toString()) {
      setAuthError('Incorrect CAPTCHA answer. Please verify and try again.');
      generateCaptcha();
      return;
    }

    const inputHash = await hashPassword(password);
    if (inputHash === ADMIN_PASSWORD_HASH) {
      localStorage.removeItem('admin_failed_attempts');
      localStorage.removeItem('admin_lockout_until');

      const newSessionId = crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2) + Date.now().toString(36));
      sessionStorage.setItem('admin_session_id', newSessionId);
      localStorage.setItem('admin_active_session_id', newSessionId);
      sessionStorage.setItem('isAdminAuthenticated', 'true');

      setIsAuthenticated(true);
      setAuthError('');
      setPassword('');
      setCaptchaInput('');

      try {
        const channel = new BroadcastChannel('hss_admin_session');
        channel.postMessage({ type: 'LOGIN', sessionId: newSessionId });
        channel.close();
      } catch (err) {
        // ignore
      }
    } else {
      const attempts = (parseInt(localStorage.getItem('admin_failed_attempts') || '0')) + 1;
      localStorage.setItem('admin_failed_attempts', attempts.toString());
      
      if (attempts >= 5) {
        const lockoutUntilTime = Date.now() + 15 * 60 * 1000;
        localStorage.setItem('admin_lockout_until', lockoutUntilTime.toString());
        setAuthError('Too many failed attempts. Console locked for 15 minutes.');
      } else {
        setAuthError(`Incorrect administrative password. Attempt ${attempts} of 5. Please try again.`);
      }
      generateCaptcha();
    }
  };

  // Session check on mount
  useEffect(() => {
    const currentSessionId = sessionStorage.getItem('admin_session_id');
    const activeSessionId = localStorage.getItem('admin_active_session_id');

    if (sessionStorage.getItem('isAdminAuthenticated') === 'true') {
      if (currentSessionId && activeSessionId && currentSessionId !== activeSessionId) {
        handleLogout('logged_out_elsewhere');
      } else {
        setIsAuthenticated(true);
      }
    } else {
      generateCaptcha();
    }

    const handleStorageChange = (e) => {
      if (e.key === 'admin_active_session_id') {
        const newSessionId = e.newValue;
        const mySessionId = sessionStorage.getItem('admin_session_id');
        if (newSessionId && mySessionId && newSessionId !== mySessionId) {
          handleLogout('logged_out_elsewhere');
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    let channel;
    try {
      channel = new BroadcastChannel('hss_admin_session');
      channel.onmessage = (event) => {
        const mySessionId = sessionStorage.getItem('admin_session_id');
        if (event.data.type === 'LOGIN' && event.data.sessionId !== mySessionId) {
          handleLogout('logged_out_elsewhere');
        } else if (event.data.type === 'LOGOUT') {
          handleLogout();
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported:', e);
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (channel) {
        channel.close();
      }
    };
  }, []);

  // Monitor lockout
  useEffect(() => {
    const checkLockout = () => {
      const lockoutUntil = parseInt(localStorage.getItem('admin_lockout_until') || '0');
      const now = Date.now();
      if (lockoutUntil > now) {
        setLockoutTimeLeft(Math.ceil((lockoutUntil - now) / 1000));
      } else {
        setLockoutTimeLeft(0);
      }
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, []);

  // Inactivity timeout
  useEffect(() => {
    if (!isAuthenticated) return;

    let inactivityTimer;
    const INACTIVITY_LIMIT = 15 * 60 * 1000;

    const resetTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        handleLogout('inactivity');
      }, INACTIVITY_LIMIT);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [isAuthenticated]);

  // Load messages when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    let mounted = true;

    fetch('/api/messages')
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        const local = JSON.parse(localStorage.getItem('site_messages') || '[]');
        const combined = Array.isArray(data) ? data.concat(local) : local;
        setMessages(combined);
      })
      .catch(() => {
        const local = JSON.parse(localStorage.getItem('site_messages') || '[]');
        setMessages(local);
      })
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes captcha-shake {
            0%, 100% { transform: rotate(-2deg) scale(1); }
            20% { transform: rotate(2deg) scale(1.05) translate(1px, -1px); }
            40% { transform: rotate(-3deg) scale(0.95) translate(-1px, 1px); }
            60% { transform: rotate(3deg) scale(1.03) translate(1px, 1px); }
            80% { transform: rotate(-1deg) scale(0.98) translate(-1px, -1px); }
          }
          .captcha-animate-shuffle {
            animation: captcha-shake 0.3s ease-in-out infinite;
          }
        `}} />
        <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-full theme-accent-badge border flex items-center justify-center mb-4 text-orange-500 animate-pulse">
              <Lock size={32} />
            </div>
            <h2 className="text-xl font-bold text-center font-title tracking-wide text-orange-400">Govt. HSS Shangus</h2>
            <p className="text-xs text-slate-400 uppercase tracking-widest mt-1">Administrative Messages</p>
          </div>

          {lockoutTimeLeft > 0 ? (
            <div className="bg-red-950/40 border border-red-500/30 text-red-400 p-5 rounded-xl text-center space-y-3">
              <AlertCircle size={28} className="mx-auto text-red-500 animate-bounce" />
              <h3 className="font-bold text-sm">Security Lockout Active</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Too many failed password attempts. The administrative console has been locked for security. Please try again after the timer expires.
              </p>
              <div className="font-mono text-xl font-extrabold text-red-400 tracking-widest bg-slate-950/60 py-2 rounded-lg border border-slate-850">
                {Math.floor(lockoutTimeLeft / 60)}:{(lockoutTimeLeft % 60).toString().padStart(2, '0')}
              </div>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Administrative Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Security CAPTCHA</label>
                <div className="flex items-center gap-2">
                  <div className={`relative select-none pointer-events-none bg-slate-950 border border-slate-850 rounded-lg flex items-center justify-center overflow-hidden h-[42px] w-32 flex-shrink-0 transition-transform ${isShuffling ? 'captcha-animate-shuffle' : ''}`}>
                    <svg className="absolute inset-0 w-full h-full opacity-25" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse">
                          <path d="M 8 0 L 0 0 0 8" fill="none" stroke="#334155" strokeWidth="0.5" />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#grid)" />
                      <path d="M 0 15 Q 30 5, 60 20 T 120 10 T 180 25" fill="none" stroke="var(--teal-accent)" strokeWidth="1.5" />
                    </svg>
                    <span className="font-mono text-base font-black tracking-widest text-slate-200 relative z-10 select-none" style={{ transform: 'rotate(-2deg)' }}>
                      {isShuffling ? shuffleValue : `${captcha.num1} ${captcha.operation} ${captcha.num2}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={generateCaptcha}
                    className="p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-orange-400 transition-colors border border-slate-800 flex items-center justify-center h-[42px] w-[42px]"
                    title="Refresh CAPTCHA challenge"
                  >
                    <RefreshCw size={15} />
                  </button>
                  <input
                    type="text"
                    required
                    placeholder="Answer..."
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    className="flex-grow px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-mono text-sm h-[42px]"
                  />
                </div>
              </div>

              {authError && (
                <div className="bg-red-950/50 border border-red-500/30 text-red-400 p-3 rounded-lg text-xs flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-orange-950/20"
              >
                <Unlock size={16} />
                Unlock Console
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 animate-in fade-in duration-200">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-6 mb-8">
          <div>
            <h2 className="text-2xl font-bold font-title tracking-wider text-orange-400">Admin — Messages</h2>
            <p className="text-xs text-slate-400 mt-1">Review contact form submissions</p>
          </div>
          <button
            onClick={() => handleLogout()}
            className="px-3 py-2 rounded-lg btn-outline-theme text-xs font-semibold"
          >
            Lock Console
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-500 text-sm">
            <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mx-auto mb-4" />
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm italic">
            No messages logged in this browser yet.
          </div>
        ) : (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 shadow-xl">
            <ul className="space-y-3">
              {messages.map((m, i) => (
                <li key={i} className="border border-slate-850 bg-slate-900/60 p-4 rounded-lg hover:bg-slate-900 transition-colors">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <div className="font-bold text-sm text-slate-200">{m.subject}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        <span className="font-semibold">{m.name}</span> — <span className="font-mono">{m.phone}</span> {m.email ? `— ${m.email}` : ''}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">{new Date(m.createdAt || Date.now()).toLocaleString()}</div>
                  </div>
                  <div className="mt-3 text-xs text-slate-350 whitespace-pre-wrap leading-relaxed border-t border-slate-850/50 pt-2.5">
                    {m.message}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
