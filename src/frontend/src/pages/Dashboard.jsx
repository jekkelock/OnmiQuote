import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

function getRevisionNotes(feedbackStr) {
  if (!feedbackStr) return null;
  try {
    const history = JSON.parse(feedbackStr);
    if (!Array.isArray(history) || history.length === 0) return null;
    const lastEntry = history[history.length - 1];
    return lastEntry?.text || null;
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const { token, user } = useAuth();
  const navigate        = useNavigate();
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [expandedNotes, setExpandedNotes] = useState(null); // proposal id being expanded

  useEffect(() => {
    fetch('/api/proposal', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setProposals(data.proposals || []); setLoading(false); })
      .catch(() => { setError('Failed to load proposals.'); setLoading(false); });
  }, [token]);

  const sent       = proposals.filter(p => p.status !== 'Draft');
  const accepted   = proposals.filter(p => p.status === 'Accepted');
  const pipeline   = proposals.reduce((s, p) => s + (Number(p.total) || 0), 0);
  const conversion = sent.length > 0 ? (accepted.length / sent.length) * 100 : 0;

  const handleDelete = async (id) => {
    if (!confirm('Delete this proposal?')) return;
    await fetch(`/api/proposal/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    setProposals(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {user?.business_name ? `${user.business_name}` : 'Dashboard'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Proposal pipeline overview</p>
        </div>
        <button
          onClick={() => navigate('/create-quote')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Quote
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Quotes Sent</p>
          <p className="text-4xl font-bold text-slate-900 dark:text-slate-100 mt-2">{sent.length}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{proposals.length} total including drafts</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Pipeline Value</p>
          <p className="text-4xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            €{pipeline.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Across all proposals</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Conversion Rate</p>
          <p className="text-4xl font-bold text-slate-900 dark:text-slate-100 mt-2">{conversion.toFixed(1)}%</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{accepted.length} accepted of {sent.length} sent</p>
        </div>
      </div>

      {/* Pipeline table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            Recent Proposals
          </h2>
          <span className="text-xs text-slate-400 dark:text-slate-500">{proposals.length} total</span>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 text-sm">Loading…</div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-red-500 text-sm">{error}</div>
        ) : proposals.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-slate-400 dark:text-slate-500 text-sm">No proposals yet.</p>
            <button
              onClick={() => navigate('/create-quote')}
              className="mt-3 text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline"
            >
              Create your first quote →
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                <th className="text-left px-6 py-3">Customer</th>
                <th className="text-left px-6 py-3">Email</th>
                <th className="text-right px-6 py-3">Value</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-left px-6 py-3">Revision Notes</th>
                <th className="text-left px-6 py-3">Created</th>
                <th className="text-left px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {proposals.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {p.customer_name || <span className="text-slate-400 dark:text-slate-500 italic">No name</span>}
                  </td>
                  <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{p.customer_email || '—'}</td>
                  <td className="px-6 py-3 text-right font-medium text-slate-800 dark:text-slate-200">
                    €{Number(p.total || 0).toLocaleString('en-IE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[p.status] || STATUS_STYLES['Draft']}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    {p.status === 'Revision Requested' ? (
                      <div>
                        <button
                          onClick={() => setExpandedNotes(expandedNotes === p.id ? null : p.id)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/70 transition-colors"
                        >
                          {expandedNotes === p.id ? '▼' : '▶'} Revision Notes
                        </button>
                        {expandedNotes === p.id && (
                          <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg max-w-xs">
                            <p className="text-xs font-semibold text-amber-900 dark:text-amber-300 mb-1 uppercase tracking-wide">Client Notes:</p>
                            <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
                              {getRevisionNotes(p.feedback) || 'No feedback notes provided.'}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500 italic">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{fmt(p.created_at)}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      {p.hash_token && (
                        <>
                          <a
                            href={`/proposal/${p.hash_token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            View
                          </a>
                          <a
                            href={`/proposals/${p.id}/admin`}
                            className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs"
                          >
                            Admin
                          </a>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
