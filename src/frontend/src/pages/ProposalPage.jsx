import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const STATUS_STYLES = {
  'Draft':              'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  'Sent':               'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300',
  'Viewed':             'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300',
  'Accepted':           'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300',
  'Denied':             'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300',
  'Revision Requested': 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300',
};

const TERMINAL = ['Accepted', 'Denied', 'Revision Requested'];

export default function ProposalPage() {
  const { hash } = useParams();
  const [proposal, setProposal]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [actionDone, setActionDone] = useState('');   // 'accepted' | 'denied'
  const [actionErr, setActionErr] = useState('');

  useEffect(() => {
    fetch(`/api/proposal/${hash}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(data => { setProposal(data.proposal); setLoading(false); })
      .catch(() => { setError('Proposal not found or link has expired.'); setLoading(false); });
  }, [hash]);

  const doAction = async (action) => {
    setActionErr('');
    try {
      const res = await fetch(`/api/proposal/${hash}/${action}`, { method: 'POST' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Failed to ${action} proposal`);
      }
      setActionDone(action);
      setProposal(prev => ({
        ...prev,
        status: action === 'accept' ? 'Accepted' : 'Denied'
      }));
    } catch (err) {
      setActionErr(err.message);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
      <p className="text-slate-500 dark:text-slate-400">Loading proposal…</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-8 text-center max-w-sm">
        <p className="text-red-500 font-medium">{error}</p>
      </div>
    </div>
  );

  const lineItems = JSON.parse(proposal.line_items || '[]');
  const total     = Number(proposal.total) || 0;
  const status    = proposal.status;
  const isTerminal = TERMINAL.includes(status);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 py-10 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Invoice card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">

          {/* Header bar */}
          <div className="bg-slate-900 dark:bg-slate-950 px-8 py-6 flex items-start justify-between">
            <div>
              <p className="text-lg font-bold text-white tracking-wide">OmniQuote</p>
              <p className="text-slate-400 text-xs mt-1 uppercase tracking-widest">Commercial Proposal</p>
            </div>
            <span className={`mt-1 inline-flex px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[status] || STATUS_STYLES['Draft']}`}>
              {status}
            </span>
          </div>

          {/* Customer block */}
          <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Prepared For</p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{proposal.customer_name || 'Valued Customer'}</p>
            {proposal.customer_email && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{proposal.customer_email}</p>
            )}
            {proposal.customer_phone && (
              <p className="text-sm text-slate-500 dark:text-slate-400">{proposal.customer_phone}</p>
            )}
          </div>

          {/* Line items */}
          <div className="px-8 py-6">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-4">Quote Details</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200 dark:border-slate-600 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  <th className="text-left pb-2">Item</th>
                  <th className="text-left pb-2">Description</th>
                  <th className="text-center pb-2 w-14">Qty</th>
                  <th className="text-right pb-2 w-28">Unit Price</th>
                  <th className="text-right pb-2 w-28">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {lineItems.length > 0 ? lineItems.map((item, i) => (
                  <tr key={i}>
                    <td className="py-3 font-medium text-slate-800 dark:text-slate-200">{item.item_name}</td>
                    <td className="py-3 text-slate-500 dark:text-slate-400">{item.description || item.notes || '—'}</td>
                    <td className="py-3 text-center text-slate-600 dark:text-slate-400">{item.quantity}</td>
                    <td className="py-3 text-right text-slate-600 dark:text-slate-400">
                      €{Number(item.custom_price || 0).toFixed(2)}
                    </td>
                    <td className="py-3 text-right font-medium text-slate-800 dark:text-slate-200">
                      €{(Number(item.custom_price || 0) * Number(item.quantity || 0)).toFixed(2)}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400 dark:text-slate-500">No line items</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Total */}
            <div className="mt-4 pt-4 border-t-2 border-slate-900 dark:border-slate-600 flex justify-end">
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Total: €{total.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* CTA footer */}
          <div className="px-8 py-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700">
            {actionErr && (
              <p className="text-red-500 dark:text-red-400 text-sm mb-4 text-center">{actionErr}</p>
            )}

            {actionDone === 'accept' ? (
              <div className="text-center py-2">
                <p className="text-green-700 dark:text-green-400 font-semibold text-lg">✓ Proposal Accepted</p>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Thank you! Your acceptance has been recorded.</p>
              </div>
            ) : actionDone === 'deny' ? (
              <div className="text-center py-2">
                <p className="text-red-600 dark:text-red-400 font-semibold text-lg">✗ Proposal Declined</p>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Your response has been recorded.</p>
              </div>
            ) : status === 'Accepted' ? (
              <div className="text-center py-2">
                <p className="text-green-700 dark:text-green-400 font-semibold text-lg">✓ Proposal Already Accepted</p>
              </div>
            ) : status === 'Denied' ? (
              <div className="text-center py-2">
                <p className="text-red-600 dark:text-red-400 font-semibold text-lg">✗ Proposal Declined</p>
              </div>
            ) : status === 'Revision Requested' ? (
              <div className="text-center py-2">
                <p className="text-purple-700 dark:text-purple-400 font-semibold text-lg">Revision Requested</p>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Your revision notes have been submitted.</p>
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-center mb-4">
                  Your Response
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-3">
                  <button
                    onClick={() => doAction('accept')}
                    className="flex-1 sm:flex-none sm:w-44 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
                  >
                    ✓ Accept Deal
                  </button>
                  <a
                    href={`/proposal/${hash}/feedback`}
                    className="flex-1 sm:flex-none sm:w-44 py-3 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors text-center"
                  >
                    ✎ Request Revision
                  </a>
                  <button
                    onClick={() => { if (confirm('Decline this proposal?')) doAction('deny'); }}
                    className="flex-1 sm:flex-none sm:w-44 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
                  >
                    ✕ Decline
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">
          Sent via OmniQuote · Ref #{hash?.slice(0, 8).toUpperCase()}
        </p>
      </div>
    </div>
  );
}
