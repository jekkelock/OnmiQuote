import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export default function ProposalFeedback() {
  const { hash } = useParams();
  const [proposal, setProposal]       = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [error, setError]             = useState('');

  useEffect(() => {
    fetch(`/api/proposals/${hash}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setProposal(data.proposal); setLoading(false); })
      .catch(() => { setError('Proposal not found.'); setLoading(false); });
  }, [hash]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    setError(''); setSubmitting(true);
    try {
      const res = await fetch(`/api/proposals/${hash}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedbackText.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
      <p className="text-slate-500 dark:text-slate-400 text-sm">Loading…</p>
    </div>
  );

  if (error && !proposal) return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-8 text-center max-w-sm">
        <p className="text-red-500 dark:text-red-400 font-medium">{error}</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-10 text-center max-w-md w-full">
        <div className="w-14 h-14 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Revision Request Submitted</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Thank you! Your notes have been recorded and the team has been notified.
          They'll be in touch shortly.
        </p>
        <a href={`/proposal/${hash}`} className="inline-block mt-6 text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline">
          ← Back to proposal
        </a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 py-10 px-4">
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="mb-6 text-center">
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">OmniQuote</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Request a Revision</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">Request Revision</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Proposal for <strong>{proposal?.customer_name || 'you'}</strong>
            {' '}· Ref #{hash?.slice(0, 8).toUpperCase()}
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                What changes would you like?
              </label>
              <textarea
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                placeholder="Please describe the specific changes, pricing adjustments, or questions you have about this proposal…"
                required
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{feedbackText.length} characters</p>
            </div>

            <button
              type="submit"
              disabled={submitting || !feedbackText.trim()}
              className="w-full py-2.5 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 disabled:bg-slate-300 transition-colors"
            >
              {submitting ? 'Submitting…' : 'Submit Revision Request'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 text-center">
            <a href={`/proposal/${hash}`} className="text-slate-400 dark:text-slate-500 text-xs hover:text-slate-600 dark:hover:text-slate-300 hover:underline">
              ← Back to proposal
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
