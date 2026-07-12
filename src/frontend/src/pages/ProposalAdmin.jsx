import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const STATUS_STYLES = {
  'Draft':              'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  'Sent':               'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300',
  'Viewed':             'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300',
  'Accepted':           'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300',
  'Denied':             'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300',
  'Revision Requested': 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300',
};

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function getRevisionHistory(feedbackStr) {
  if (!feedbackStr) return [];
  try {
    const history = JSON.parse(feedbackStr);
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

export default function ProposalAdmin() {
  const { id } = useParams();
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState(null);

useEffect(() => {
    if (!token) {
      setError('Authentication required.');
      setLoading(false);
      return;
    }
    fetch(`/api/proposals/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => {
        if (!r.ok) {
          return r.json().then(d => { throw new Error(d.error || 'Proposal not found'); });
        }
        return r.json();
      })
      .then(data => {
        if (!data.proposal) throw new Error('No proposal data returned');
        setProposal(data.proposal);
        setLoading(false);
      })
      .catch((err) => { setError(err.message || 'Failed to load proposal'); setLoading(false); });
  }, [id, token]);

  const handleAction = async (action) => {
    try {
      const res = await fetch(`/api/proposals/${id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      const isAccept = action === 'accept';
      setActionMsg({ text: isAccept ? 'Accepted successfully.' : 'Denied.', accept: isAccept });
      setProposal(prev => ({ ...prev, status: action === 'accept' ? 'Accepted' : 'Denied' }));
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-slate-500 dark:text-slate-400">
      Loading proposal…
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center py-24">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-8 text-center max-w-sm">
        <p className="text-red-500 font-medium">{error}</p>
        <button onClick={() => navigate('/dashboard')} className="mt-4 text-blue-600 dark:text-blue-400 text-sm hover:underline">
          ← Back to dashboard
        </button>
      </div>
    </div>
  );

  const lineItems = JSON.parse(proposal.line_items || '[]');
  const total = Number(proposal.total) || 0;
  const revisionHistory = getRevisionHistory(proposal.feedback);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Proposal Admin</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Internal management view</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-sm transition-colors"
          >
            ← Dashboard
          </button>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="px-4 py-2 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-sm transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Revision History Panel - shown at top for Revision Requested */}
      {proposal.status === 'Revision Requested' && revisionHistory.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl p-5">
          <p className="text-xs font-semibold text-amber-900 dark:text-amber-300 uppercase tracking-wide mb-3">
            Client Revision Notes (Chronological)
          </p>
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {revisionHistory.map((entry, i) => (
              <div key={i} className="border-l-4 border-amber-400 dark:border-amber-500 pl-3 py-1">
                <p className="text-sm text-amber-900 dark:text-amber-200">{entry.text}</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Submitted: {new Date(entry.submitted_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proposal Details */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="border-b border-slate-200 dark:border-slate-700 pb-4 mb-4">
          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[proposal.status] || STATUS_STYLES['Draft']}`}>
            {proposal.status}
          </span>
        </div>

        {/* Customer Info */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Customer</p>
          <p className="font-medium text-slate-900 dark:text-slate-100">{proposal.customer_name || '—'}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{proposal.customer_email || '—'}</p>
        </div>

        {/* Line Items */}
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Line Items</p>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400 uppercase">
              <tr>
                <th className="text-left px-3 py-1">Item</th>
                <th className="text-right px-3 py-1">Qty</th>
                <th className="text-right px-3 py-1">Price</th>
                <th className="text-right px-3 py-1">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {lineItems.length > 0 ? lineItems.map((it, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{it.item_name}</td>
                  <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{it.quantity}</td>
                  <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">€{Number(it.custom_price).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-900 dark:text-slate-100">
                    €{(Number(it.custom_price) * Number(it.quantity)).toFixed(2)}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">—</td></tr>
              )}
            </tbody>
          </table>
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-right">
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Total: €{total.toLocaleString('en-IE', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

{/* Admin Actions - accept/deny always available */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          Administrative Actions
        </p>
        {actionMsg && (
          <p className={`text-sm mb-3 ${actionMsg.accept ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {actionMsg.text}
          </p>
        )}
        <div className="flex gap-3">
          {(proposal.status === 'Draft' || proposal.status === 'Revision Requested') && (
            <button
              onClick={() => navigate(`/create-quote?edit=${id}`)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Edit Draft
            </button>
          )}
          <button
            onClick={() => handleAction('accept')}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            Mark Accepted
          </button>
          <button
            onClick={() => handleAction('deny')}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            Mark Denied
          </button>
        </div>
      </div>

{actionMsg?.text && (
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center">Ref #{proposal.hash_token?.slice(0, 8).toUpperCase()}</p>
      )}
    </div>
  );
}