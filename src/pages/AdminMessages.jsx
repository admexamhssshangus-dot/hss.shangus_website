import React, { useEffect, useState } from 'react';

export default function AdminMessages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    // load messages from backend first
    fetch('/api/messages')
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        const local = JSON.parse(localStorage.getItem('site_messages') || '[]');
        // merge: backend first, then any local messages not present by timestamp
        const combined = Array.isArray(data) ? data.concat(local) : local;
        setMessages(combined);
      })
      .catch(() => {
        const local = JSON.parse(localStorage.getItem('site_messages') || '[]');
        setMessages(local);
      })
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, []);

  return (
    <div className="w-full bg-slate-50 py-12">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Admin — Messages</h2>
        {loading ? (
          <div className="text-slate-600">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="text-slate-600">No messages yet.</div>
        ) : (
          <div className="bg-white rounded shadow border p-4">
            <ul className="space-y-3">
              {messages.map((m, i) => (
                <li key={i} className="border p-3 rounded-md">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-slate-800">{m.subject}</div>
                      <div className="text-sm text-slate-600">{m.name} — {m.phone} {m.email ? `— ${m.email}` : ''}</div>
                    </div>
                    <div className="text-xs text-slate-500">{new Date(m.createdAt || Date.now()).toLocaleString()}</div>
                  </div>
                  <div className="mt-2 text-slate-700 whitespace-pre-wrap">{m.message}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
