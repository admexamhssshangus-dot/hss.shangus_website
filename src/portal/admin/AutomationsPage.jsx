import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Send, PhoneCall, Plus, Trash2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import appsScriptApi from '../../services/appsScriptApi';

export default function AutomationsPage() {
  // Bulk Email State
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [targetClass, setTargetClass] = useState('All');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Whitelist State
  const [whitelistEmail, setWhitelistEmail] = useState('');
  const [whitelistMobile, setWhitelistMobile] = useState('');
  const [whitelistReason, setWhitelistReason] = useState('');
  const [whitelistedMobiles, setWhitelistedMobiles] = useState([]);
  const [loadingWhitelist, setLoadingWhitelist] = useState(false);

  const [alert, setAlert] = useState(null);

  // Fetch Whitelisted Mobiles
  const fetchWhitelist = useCallback(async () => {
    setLoadingWhitelist(true);
    try {
      const res = await appsScriptApi.call('getWhitelistedMobiles');
      setWhitelistedMobiles(Array.isArray(res) ? res : res?.mobiles || []);
    } catch (err) {
      console.error('Fetch whitelist error:', err);
    } finally {
      setLoadingWhitelist(false);
    }
  }, []);

  useEffect(() => {
    fetchWhitelist();
  }, [fetchWhitelist]);

  // Send Bulk Email
  const handleSendBulkEmail = async (e) => {
    e.preventDefault();
    if (!emailSubject || !emailBody) {
      setAlert({ type: 'error', text: 'Email subject and body are required.' });
      return;
    }
    setSendingEmail(true);
    setAlert(null);
    try {
      const res = await appsScriptApi.call('sendBulkEmail', {
        subject: emailSubject,
        body: emailBody,
        className: targetClass,
      });
      if (res && res.success !== false) {
        setAlert({ type: 'success', text: 'Bulk email dispatched successfully to selected target group.' });
        setEmailSubject('');
        setEmailBody('');
      } else {
        setAlert({ type: 'error', text: res?.message || 'Failed to dispatch bulk email.' });
      }
    } catch (err) {
      console.error('Bulk email error:', err);
      setAlert({ type: 'error', text: err.userMessage || err.message || 'Failed to send bulk email.' });
    } finally {
      setSendingEmail(false);
    }
  };

  // Add Mobile Whitelist
  const handleAddWhitelist = async (e) => {
    e.preventDefault();
    if (!whitelistEmail || !whitelistMobile) {
      alert('Email and Mobile number are required.');
      return;
    }
    try {
      const res = await appsScriptApi.call('addMobileWhitelist', {
        email: whitelistEmail.trim(),
        mobile: whitelistMobile.trim(),
        reason: whitelistReason.trim(),
      });
      if (res && res.success !== false) {
        setWhitelistEmail('');
        setWhitelistMobile('');
        setWhitelistReason('');
        fetchWhitelist();
        alert('Mobile number whitelisted successfully.');
      }
    } catch (err) {
      console.error('Add whitelist error:', err);
      alert('Failed to whitelist mobile number.');
    }
  };

  // Remove Mobile Whitelist
  const handleRemoveWhitelist = async (email, mobile) => {
    if (!window.confirm(`Remove ${mobile} from whitelist?`)) return;
    try {
      await appsScriptApi.call('removeMobileWhitelist', { email, mobile });
      fetchWhitelist();
    } catch (err) {
      console.error('Remove whitelist error:', err);
      alert('Failed to remove mobile from whitelist.');
    }
  };

  return (
    <div className="space-y-4 text-xs animate-fadeIn text-slate-900 dark:text-slate-100">
      {/* Alert Notification */}
      {alert && (
        <div className={`p-3.5 rounded-2xl font-black flex items-start gap-2.5 ${
          alert.type === 'error' ? 'bg-red-700 text-white' : 'bg-emerald-700 text-white'
        }`}>
          {alert.type === 'error' ? <AlertCircle size={16} className="flex-shrink-0" /> : <CheckCircle2 size={16} className="flex-shrink-0" />}
          <span>{alert.text}</span>
        </div>
      )}

      {/* Responsive Mobile-First Grid: Bulk Email + Whitelist Manager */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bulk Email Composer */}
        <form onSubmit={handleSendBulkEmail} className="p-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md space-y-3">
          <div className="flex items-center gap-2 font-black text-sm text-teal-700 dark:text-teal-400">
            <Mail size={16} /> Group Email Composer
          </div>

          <div className="space-y-1">
            <label className="font-black text-slate-900 dark:text-slate-100">Target Class *</label>
            <select
              value={targetClass}
              onChange={(e) => setTargetClass(e.target.value)}
              className="w-full px-3 py-2 rounded-xl font-black border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              <option value="All">All Registered Students</option>
              <option value="12th">12th Class Students</option>
              <option value="11th">11th Class Students</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-black text-slate-900 dark:text-slate-100">Email Subject *</label>
            <input
              type="text"
              required
              placeholder="e.g. Important Notice Regarding Admission Verification"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-xl font-black border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-500"
            />
          </div>

          <div className="space-y-1">
            <label className="font-black text-slate-900 dark:text-slate-100">Email Message Body *</label>
            <textarea
              rows={4}
              required
              placeholder="Write your email announcement message here..."
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              className="w-full px-3 py-2 rounded-xl font-black border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-500"
            />
          </div>

          <button
            type="submit"
            disabled={sendingEmail}
            className="w-full py-3 px-5 rounded-xl font-black text-white bg-teal-700 hover:bg-teal-600 shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {sendingEmail ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
            <span>Dispatch Bulk Email</span>
          </button>
        </form>

        {/* Mobile Whitelist Manager */}
        <div className="p-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md space-y-3">
          <div className="flex items-center gap-2 font-black text-sm text-indigo-700 dark:text-indigo-400">
            <PhoneCall size={16} /> Staff Mobile Whitelist Manager
          </div>

          <form onSubmit={handleAddWhitelist} className="space-y-2.5 p-3 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
            <input
              type="email"
              required
              placeholder="Staff Email"
              value={whitelistEmail}
              onChange={(e) => setWhitelistEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-xl font-black border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs placeholder-slate-500"
            />
            <input
              type="tel"
              required
              maxLength={10}
              placeholder="10-Digit Mobile No"
              value={whitelistMobile}
              onChange={(e) => setWhitelistMobile(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full px-3 py-2 rounded-xl font-mono font-black border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs placeholder-slate-500"
            />
            <input
              type="text"
              placeholder="Designation / Reason (Optional)"
              value={whitelistReason}
              onChange={(e) => setWhitelistReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl font-black border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs placeholder-slate-500"
            />
            <button type="submit" className="w-full py-2.5 rounded-xl font-black text-white bg-indigo-700 hover:bg-indigo-600 shadow-md cursor-pointer flex items-center justify-center gap-1">
              <Plus size={14} /> Whitelist Number
            </button>
          </form>

          {/* Whitelisted List */}
          {loadingWhitelist ? (
            <div className="p-3 text-center text-slate-500 font-bold">Loading Whitelisted Mobiles...</div>
          ) : whitelistedMobiles.length > 0 ? (
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {whitelistedMobiles.map((item, idx) => (
                <div key={idx} className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
                  <div>
                    <div className="font-mono font-black text-indigo-700 dark:text-indigo-400">{item.mobile}</div>
                    <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{item.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveWhitelist(item.email, item.mobile)}
                    className="p-1.5 text-red-600 hover:bg-red-700 hover:text-white rounded-lg cursor-pointer transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-3 text-slate-500 font-bold">No staff mobile numbers whitelisted.</div>
          )}
        </div>
      </div>
    </div>
  );
}
