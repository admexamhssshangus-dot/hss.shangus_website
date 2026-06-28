import React, { useEffect, useState, useRef } from 'react';
import { Lock, Unlock, AlertCircle, RefreshCw, Trash2, Eye, EyeOff } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, getDocs, query, orderBy, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';

async function hashPassword(plainText, saltHex = null) {
  if (saltHex) {
    try {
      const encoder = new TextEncoder();
      const passwordBuffer = encoder.encode(plainText);
      const saltBuffer = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
      
      const baseKey = await window.crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );
      
      const derivedBits = await window.crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltBuffer,
          iterations: 100000,
          hash: 'SHA-256'
        },
        baseKey,
        256
      );
      
      const hashArray = Array.from(new Uint8Array(derivedBits));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.error('PBKDF2 hashing failed, falling back to SHA-256:', e);
    }
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(plainText);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}


export default function AdminMessages() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [authControlsLoading, setAuthControlsLoading] = useState(true);
  const [adminsList, setAdminsList] = useState(() => {
    try {
      const saved = localStorage.getItem('site_admins');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Load admins list from Firestore, server, or localStorage
  useEffect(() => {
    async function fetchAdmins() {
      // 1. Try Firestore
      try {
        const snap = await getDoc(doc(db, 'site', 'admins'));
        if (snap.exists()) {
          const data = snap.data();
          if (data && Array.isArray(data.items) && data.items.length > 0) {
            setAdminsList(data.items);
            localStorage.setItem('site_admins', JSON.stringify(data.items));
            return;
          }
        }
      } catch (e) {
        console.warn('Firestore admins read failed on messages board:', e);
      }

      // 2. Try static JSON fallback
      try {
        const r = await fetch('/slides/admins.json?t=' + Date.now(), { cache: 'no-cache' });
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data) && data.length > 0) {
            setAdminsList(data);
            localStorage.setItem('site_admins', JSON.stringify(data));
          }
        }
      } catch (e) {
        // ignore
      }
    }
    fetchAdmins();
  }, []);

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

  // Track Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthControlsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Firebase Auth Error:', err);
    }
  };

  const handleFirebaseSignOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error('Firebase Sign-out Error:', err);
    }
  };

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
    } else if (reason === 'sync_logout') {
      setAuthError('');
    } else {
      localStorage.removeItem('admin_active_session_id');
      try {
        const channel = new BroadcastChannel('hss_admin_session');
        channel.postMessage({ type: 'LOGOUT', reason: 'sync_logout' });
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

    let isValid = false;
    const currentAdmins = adminsList.length > 0 ? adminsList : [
      {
        email: 'adm.exam.hss.shangus@gmail.com',
        passwordHash: '337c3ede57bd0445487f19ce491960c04e86b801c2b26655e9241b9d539e7482',
        hashAlgo: 'sha256'
      }
    ];

    for (const adm of currentAdmins) {
      const usePBKDF2 = !!(adm.hashAlgo === 'pbkdf2' || adm.salt);
      const inputHash = usePBKDF2 ? await hashPassword(password, adm.salt) : await hashPassword(password);
      if (inputHash === adm.passwordHash) {
        isValid = true;
        break;
      }
    }

    if (isValid) {
      localStorage.removeItem('admin_failed_attempts');
      localStorage.removeItem('admin_last_failed_time');
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
      const now = Date.now();
      const lastFailedTime = parseInt(localStorage.getItem('admin_last_failed_time') || '0');
      let currentAttempts = parseInt(localStorage.getItem('admin_failed_attempts') || '0');

      // Reset count if last failed attempt was more than 15 minutes ago
      if (now - lastFailedTime > 15 * 60 * 1000) {
        currentAttempts = 0;
      }

      const attempts = currentAttempts + 1;
      localStorage.setItem('admin_failed_attempts', attempts.toString());
      localStorage.setItem('admin_last_failed_time', now.toString());
      
      if (attempts >= 6) {
        const lockoutUntilTime = now + 15 * 60 * 1000;
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
          handleLogout(event.data.reason || 'sync_logout');
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

    async function loadMessages() {
      try {
        const local = JSON.parse(localStorage.getItem('site_messages') || '[]');
        let firestoreMessages = [];

        // 1. Try fetching from Firestore (Production Priority)
        if (db) {
          try {
            const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach((doc) => {
              firestoreMessages.push({ id: doc.id, ...doc.data() });
            });
          } catch (err) {
            console.warn('Could not load messages from Firestore:', err);
          }
        }

        if (!mounted) return;

        // Combine, deduplicate by createdAt/email/message, and sort
        const allMessages = [...firestoreMessages, ...local];
        const uniqueMessagesMap = new Map();
        allMessages.forEach(m => {
          const key = `${m.createdAt}-${m.email}-${m.name}`;
          if (!uniqueMessagesMap.has(key)) {
            uniqueMessagesMap.set(key, m);
          }
        });

        const sortedMessages = Array.from(uniqueMessagesMap.values()).sort((a, b) => {
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });

        setMessages(sortedMessages);
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadMessages();

    return () => { mounted = false; };
  }, [isAuthenticated, firebaseUser]);

  const handleDeleteMessage = async (msg) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;

    // 1. Delete from Firestore if db is active and msg has a Firestore id
    if (db && msg.id) {
      if (!firebaseUser) {
        alert("You must sign in with Google (Firebase) to delete messages from the live database.");
        return;
      }
      try {
        await deleteDoc(doc(db, 'messages', msg.id));
      } catch (err) {
        console.error("Failed to delete from Firestore:", err);
        alert("Failed to delete from live database. You might not have the correct permissions.");
        return;
      }
    }

    // 2. Delete from local backend (if applicable)
    try {
      await fetch(`/api/messages`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ createdAt: msg.createdAt, email: msg.email, name: msg.name })
      });
    } catch (err) {
      // ignore
    }

    // 3. Delete from localStorage
    try {
      const local = JSON.parse(localStorage.getItem('site_messages') || '[]');
      const filtered = local.filter(m => !(m.createdAt === msg.createdAt && m.email === msg.email && m.name === msg.name));
      localStorage.setItem('site_messages', JSON.stringify(filtered));
    } catch (err) {
      // ignore
    }

    // 4. Update UI State
    setMessages(prev => prev.filter(m => !(m.createdAt === msg.createdAt && m.email === msg.email && m.name === msg.name)));
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Glow Effects in Background */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[var(--teal-accent)]/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[10s]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#961c14]/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[8s]" />

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
          .refresh-spin-hover:hover svg {
            transform: rotate(180deg);
          }
          .refresh-spin-hover svg {
            transition: transform 0.4s ease-in-out;
          }
        `}} />
        <div className="w-full max-w-md bg-slate-900 rounded-3xl border border-slate-800 p-6 sm:p-9 shadow-2xl animate-in fade-in zoom-in-95 duration-200 relative z-10">
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-4 flex justify-center">
              <div className="w-16 h-16 rounded-full theme-accent-badge border flex items-center justify-center text-[var(--teal-accent)] transition-all duration-500 hover:scale-105 relative group">
                <div className="absolute inset-[-4px] rounded-full border border-[var(--teal-accent)]/20 animate-ping opacity-75 group-hover:opacity-100" />
                <Lock size={26} className="transition-transform duration-300 group-hover:-translate-y-0.5" />
              </div>
            </div>
            <h2 className="text-2xl font-black text-center font-title tracking-wider text-[var(--teal-accent)] uppercase">
              Govt. HSS Shangus
            </h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 text-center">
              Administrative Messages
            </p>
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
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Administrative Password</label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 group-focus-within:text-[var(--teal-accent)] transition-colors">
                    <Lock size={16} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-655 focus:outline-none focus:border-[var(--teal-accent)] focus:ring-1 focus:ring-[var(--teal-accent)] transition-all"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-505 hover:text-[var(--teal-accent)] transition-colors"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Security CAPTCHA</label>
                <div className="flex items-center gap-2">
                  <div className={`relative select-none pointer-events-none bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-center overflow-hidden h-[42px] w-28 sm:w-32 flex-shrink-0 transition-transform ${isShuffling ? 'captcha-animate-shuffle' : ''}`}>
                    <svg className="absolute inset-0 w-full h-full opacity-25" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <pattern id="captcha-grid" width="6" height="6" patternUnits="userSpaceOnUse">
                          <path d="M 6 0 L 0 0 0 6" fill="none" stroke="#475569" strokeWidth="0.5" />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#captcha-grid)" />
                      <path d="M 0 12 Q 25 2, 50 18 T 100 8 T 150 20" fill="none" stroke="var(--teal-accent)" strokeWidth="1.2" />
                      <path d="M 0 25 Q 35 30, 70 10 T 140 18" fill="none" stroke="#961c14" strokeWidth="1" />
                    </svg>
                    <span className="font-mono text-base font-black tracking-widest text-slate-100 relative z-10 select-none filter drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]" style={{ transform: 'rotate(-2deg)' }}>
                      {isShuffling ? shuffleValue : `${captcha.num1} ${captcha.operation} ${captcha.num2}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={generateCaptcha}
                    className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-[var(--teal-accent)] transition-all border border-slate-800 flex items-center justify-center h-[42px] w-[42px] active:scale-90 refresh-spin-hover"
                    title="Refresh CAPTCHA challenge"
                  >
                    <RefreshCw size={16} className={isShuffling ? 'animate-spin' : ''} />
                  </button>
                  <input
                    type="text"
                    required
                    placeholder="Answer..."
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    className="flex-grow min-w-0 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-655 focus:outline-none focus:border-[var(--teal-accent)] focus:ring-1 focus:ring-[var(--teal-accent)] font-mono text-sm h-[42px] transition-all"
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
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[var(--teal-accent)] to-[var(--teal-accent-hover)] hover:brightness-110 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-950/20 active:scale-[0.98] mt-3"
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
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4">
            {!authControlsLoading && (
              <div className="flex items-center gap-3 border-r border-slate-800 pr-4">
                {firebaseUser ? (
                  <>
                    <div className="text-[10px] text-slate-400 text-right">
                      Live Sync:<br/><span className="text-emerald-400 font-mono">{firebaseUser.email}</span>
                    </div>
                    <button onClick={handleFirebaseSignOut} className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold transition-colors">
                      Sign Out
                    </button>
                  </>
                ) : (
                  <button onClick={handleGoogleSignIn} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition-colors flex items-center gap-1.5">
                    <RefreshCw size={12} /> Sync Database
                  </button>
                )}
              </div>
            )}
            <button
              onClick={() => handleLogout()}
              className="px-3 py-2 rounded-lg btn-outline-theme text-xs font-semibold whitespace-nowrap"
            >
              Lock Console
            </button>
          </div>
        </div>

        {!firebaseUser && (
          <div className="mb-6 p-4 rounded-xl bg-orange-950/30 border border-orange-500/20 text-orange-200 text-sm flex items-start gap-3">
            <AlertCircle className="flex-shrink-0 text-orange-400 mt-0.5" size={18} />
            <div>
              <p className="font-semibold mb-1">Live Database Disconnected</p>
              <p className="text-xs text-orange-200/80">You are currently viewing locally cached messages. To view the latest messages from the contact form and to permanently delete them, please <strong>Sync Database</strong> using your authorized Google account.</p>
            </div>
          </div>
        )}

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
                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <div className="text-[10px] font-mono text-slate-500">{new Date(m.createdAt || Date.now()).toLocaleString()}</div>
                      <button
                        onClick={() => handleDeleteMessage(m)}
                        className="p-1.5 rounded bg-slate-950 text-slate-500 hover:text-red-400 hover:bg-red-950/20 transition-all active:scale-95"
                        title="Delete Message"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-slate-400 whitespace-pre-wrap leading-relaxed border-t border-slate-850/50 pt-2.5">
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
