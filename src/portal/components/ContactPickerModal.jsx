import React, { useState } from 'react';
import { Phone, MessageSquare, Send, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * ContactPickerModal — Interactive Contact Picker for Portal Footer.
 * Supports direct call links and custom WhatsApp message sending.
 */
export default function ContactPickerModal() {
  const [activeType, setActiveType] = useState(null); // 'call' | 'whatsapp' | null
  const [customMsg, setCustomMsg] = useState('Hi, I have a query regarding admission.');

  const numbers = [
    { num: '7006537425', label: 'Office Helpdesk 1' },
    { num: '7006034501', label: 'Office Helpdesk 2' },
    { num: '9596165142', label: 'Admission Desk' },
  ];

  const handleToggle = (type) => {
    if (activeType === type) {
      setActiveType(null);
    } else {
      setActiveType(type);
    }
  };

  const handleWhatsAppSend = (num) => {
    const encoded = encodeURIComponent(customMsg || 'Hi, I have a query regarding admission.');
    window.open(`https://api.whatsapp.com/send?phone=91${num}&text=${encoded}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="w-full pt-4 border-t border-slate-200 dark:border-slate-800 text-center space-y-3">
      <div className="text-xs font-medium" style={{ color: 'var(--text-muted, #64748b)' }}>
        For any admission queries, contact admission office
      </div>

      {/* Toggle Bar */}
      <div className="max-w-xs mx-auto flex items-center justify-between p-1 rounded-2xl border shadow-sm transition-all" style={{ backgroundColor: 'var(--bg-secondary, #f8fafc)', borderColor: 'var(--border-ui, #e2e8f0)' }}>
        <button
          type="button"
          onClick={() => handleToggle('call')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeType === 'call' ? 'bg-teal-500 text-white shadow-md' : 'hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
          style={activeType !== 'call' ? { color: 'var(--text-main, #1e293b)' } : {}}
        >
          <Phone size={14} />
          <span>Call Office</span>
          {activeType === 'call' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--border-ui, #cbd5e1)' }} />

        <button
          type="button"
          onClick={() => handleToggle('whatsapp')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeType === 'whatsapp' ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-emerald-500/10 hover:text-emerald-600'
          }`}
          style={activeType !== 'whatsapp' ? { color: 'var(--text-main, #1e293b)' } : {}}
        >
          <MessageSquare size={14} className={activeType === 'whatsapp' ? 'text-white' : 'text-emerald-500'} />
          <span>WhatsApp</span>
          {activeType === 'whatsapp' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Expanded Contact Details */}
      {activeType && (
        <div className="max-w-xs mx-auto p-3.5 rounded-2xl border text-left space-y-2.5 animate-fadeIn" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #e2e8f0)', boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}>
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-teal-600 dark:text-teal-400">
            {activeType === 'call' ? 'Select Phone Number to Call' : 'Select WhatsApp Contact'}
          </div>

          {activeType === 'whatsapp' && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium" style={{ color: 'var(--text-muted, #64748b)' }}>
                Message Preset:
              </label>
              <input
                type="text"
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                placeholder="Type your message..."
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-teal-500"
                style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)', color: 'var(--text-main, #0f172a)' }}
              />
            </div>
          )}

          <div className="space-y-1.5">
            {numbers.map(({ num, label }) => (
              activeType === 'call' ? (
                <a
                  key={num}
                  href={`tel:+91${num}`}
                  className="flex items-center justify-between p-2 rounded-xl border hover:border-teal-500 transition-all text-xs font-semibold"
                  style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #e2e8f0)', color: 'var(--text-main, #0f172a)' }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-600">
                      <Phone size={13} />
                    </div>
                    <div>
                      <div className="font-mono text-xs">{num}</div>
                      <div className="text-[10px] font-normal" style={{ color: 'var(--text-muted, #64748b)' }}>{label}</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-teal-600">Call Now</span>
                </a>
              ) : (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleWhatsAppSend(num)}
                  className="w-full flex items-center justify-between p-2 rounded-xl border hover:border-emerald-500 transition-all text-xs font-semibold text-left cursor-pointer"
                  style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #e2e8f0)', color: 'var(--text-main, #0f172a)' }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                      <MessageSquare size={13} />
                    </div>
                    <div>
                      <div className="font-mono text-xs">{num}</div>
                      <div className="text-[10px] font-normal" style={{ color: 'var(--text-muted, #64748b)' }}>{label}</div>
                    </div>
                  </div>
                  <Send size={13} className="text-emerald-500" />
                </button>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
