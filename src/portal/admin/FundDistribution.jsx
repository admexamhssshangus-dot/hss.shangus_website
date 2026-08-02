import React from 'react';
import { CreditCard, DollarSign, Wallet, ShieldCheck, Download } from 'lucide-react';

export default function FundDistribution() {
  return (
    <div className="space-y-6">
      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
        <div className="p-4 rounded-3xl border space-y-1" style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
          <div className="text-slate-400 font-bold uppercase text-[10px]">Total Fee Collected</div>
          <div className="font-extrabold text-xl text-teal-600">₹ 2,45,000</div>
          <div className="text-[10px] text-slate-500">Academic Session 2025-26</div>
        </div>

        <div className="p-4 rounded-3xl border space-y-1" style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
          <div className="text-slate-400 font-bold uppercase text-[10px]">Development Fund</div>
          <div className="font-extrabold text-xl text-indigo-600">₹ 1,10,000</div>
          <div className="text-[10px] text-slate-500">45% Allocation</div>
        </div>

        <div className="p-4 rounded-3xl border space-y-1" style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
          <div className="text-slate-400 font-bold uppercase text-[10px]">Library & Sports</div>
          <div className="font-extrabold text-xl text-amber-600">₹ 65,000</div>
          <div className="text-[10px] text-slate-500">26% Allocation</div>
        </div>

        <div className="p-4 rounded-3xl border space-y-1" style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
          <div className="text-slate-400 font-bold uppercase text-[10px]">Examination & Misc</div>
          <div className="font-extrabold text-xl text-pink-600">₹ 70,000</div>
          <div className="text-[10px] text-slate-500">29% Allocation</div>
        </div>
      </div>

      <div className="p-8 text-center rounded-3xl border space-y-3" style={{ backgroundColor: 'var(--bg-page, #f8fafc)', borderColor: 'var(--border-ui, #cbd5e1)' }}>
        <CreditCard size={32} className="text-teal-600 mx-auto" />
        <h3 className="font-extrabold text-sm" style={{ color: 'var(--text-main, #0f172a)' }}>
          Fund Distribution & Fee Accounting Portal Active
        </h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          All admission fee receipts are automatically tracked and reconciled against student registration records.
        </p>
      </div>
    </div>
  );
}
