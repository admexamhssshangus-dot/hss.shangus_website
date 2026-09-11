import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShieldCheck, AlertTriangle, ArrowLeft } from 'lucide-react';
import { publicLookup } from '../services/backendEndpoint';
import ModernLoader from '../components/ModernLoader';
import SEO from '../components/SEO';

export default function StudentVerificationPage() {
  const [parameters] = useSearchParams();
  const query = parameters.toString();
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    const p = new URLSearchParams(query);
    setState({ loading: true });
    publicLookup('lookup-student', { regNo: p.get('reg') || '', formNo: p.get('fNo') || '',
      certificateNo: p.get('cert') || '', documentType: p.get('doc') || '',
      className: p.get('class') || '', session: p.get('session') || '' }, controller.signal)
      .then(result => { if (!controller.signal.aborted) setState({ loading: false, ...result }); })
      .catch(error => { if (!controller.signal.aborted) setState({ loading: false, error: error.message, status: error.status }); });
    return () => controller.abort();
  }, [query]);
  const student = state.student;
  return <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-8 text-slate-900 dark:text-slate-100">
    <SEO title="Official Record Verification | HSS Shangus" description="Verify a student enrollment or an issued school certificate." noindex />
    <div className="max-w-xl mx-auto space-y-5">
      <Link to="/" className="inline-flex items-center gap-2 text-sm"><ArrowLeft size={16} />School homepage</Link>
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 sm:p-8 shadow-sm" aria-live="polite">
        <p className="text-sm text-slate-600 dark:text-slate-300">Government Higher Secondary School Shangus</p>
        <h1 className="text-2xl font-bold mt-2 mb-6">Official record verification</h1>
        {state.loading ? <ModernLoader text="Checking the school registry…" /> : state.error ? <div role="alert" className="space-y-3">
          <AlertTriangle className="text-amber-600" size={32} />
          <h2 className="text-lg font-semibold">{state.status === 404 ? 'Record could not be verified' : 'Verification unavailable'}</h2>
          <p>{state.error}</p><p className="text-sm">Contact the school office if you need help verifying this document.</p>
        </div> : student ? <>
          <div className="flex items-center gap-3 text-emerald-800 dark:text-emerald-300 mb-5"><ShieldCheck size={32} />
            <h2 className="font-bold">{state.verification.kind === 'certificate' ? 'Certificate issued and active' : 'Enrollment verified'}</h2>
          </div>
          {state.verification.kind === 'enrollment' && <p className="text-sm mb-5">This confirms enrollment only. Certificate issuance requires its own registry record.</p>}
          <dl className="space-y-3">{[
            ['Student', student.name], ['Parent / guardian', student.fatherName], ['Class', student.className], ['Session', student.session],
            ['Registration number', student.boardRegNo], ['Form number', student.formNo],
            ['Document', state.verification.documentType], ['Certificate number', state.verification.certificateNo], ['Issue date', state.verification.issuedAt]
          ].filter(([, value]) => value).map(([label, value]) => <div key={label} className="grid grid-cols-2 gap-3 border-b border-slate-100 dark:border-slate-800 pb-2">
            <dt className="text-sm text-slate-600 dark:text-slate-400">{label}</dt><dd className="text-sm font-semibold break-words">{String(value)}</dd>
          </div>)}</dl>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-6">Checked against the current school registry. Compare these details with the document presented.</p>
        </> : null}
      </section>
    </div>
  </main>;
}
