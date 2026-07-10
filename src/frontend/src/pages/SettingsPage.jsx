import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const BLANK = { smtp_host: '', smtp_port: 587, smtp_user: '', smtp_password: '', from_name: '' };

export default function SettingsPage() {
  const { token }  = useAuth();
  const [form, setForm]         = useState(BLANK);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [testing, setTesting]   = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');
  const [testResult, setTestResult] = useState(null); // null | { ok, message }

  useEffect(() => {
    fetch('/api/settings/smtp', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.settings) {
          setForm({ ...BLANK, ...data.settings, smtp_password: '' });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === 'smtp_port' ? (parseInt(value, 10) || '') : value
    }));
    setSaved(false);
    setTestResult(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSaved(false); setSaving(true);
    try {
      const res  = await fetch('/api/settings/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');
      setSaved(true);
      setForm(prev => ({ ...prev, smtp_password: '' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setError(''); setTestResult(null); setTesting(true);
    try {
      const res  = await fetch('/api/settings/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      setTestResult({
        ok: res.ok,
        message: res.ok
          ? `Connection successful — test email sent to ${form.smtp_user}`
          : (data.error || 'Connection test failed')
      });
    } catch (err) {
      setTestResult({ ok: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 dark:text-slate-500 text-sm">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">SMTP Configuration</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Outbound email settings used to deliver proposals to customers
        </p>
      </div>

      {saved && (
        <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm rounded-lg">
          ✓ Settings saved successfully.
        </div>
      )}
      {error && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg">
          {error}
        </div>
      )}
      {testResult && (
        <div className={`px-4 py-3 text-sm rounded-lg border ${
          testResult.ok
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
        }`}>
          {testResult.ok ? '✓ ' : '✗ '}{testResult.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SMTP Host *</label>
            <input
              type="text"
              name="smtp_host"
              value={form.smtp_host}
              onChange={handleChange}
              placeholder="smtp.gmail.com"
              required
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Port *</label>
            <input
              type="number"
              name="smtp_port"
              value={form.smtp_port}
              onChange={handleChange}
              placeholder="587"
              required
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">587 = TLS, 465 = SSL</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SMTP Username *</label>
          <input
            type="text"
            name="smtp_user"
            value={form.smtp_user}
            onChange={handleChange}
            placeholder="sender@yourdomain.com"
            required
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SMTP Password</label>
          <input
            type="password"
            name="smtp_password"
            value={form.smtp_password}
            onChange={handleChange}
            placeholder="Leave blank to keep existing password"
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Stored encrypted (AES-256-CBC)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">From Name</label>
          <input
            type="text"
            name="from_name"
            value={form.from_name}
            onChange={handleChange}
            placeholder="Your Company Name"
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Displayed as the sender name in the customer's inbox</p>
        </div>

        <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Config'}
          </button>
          <button
            type="button"
            onClick={testConnection}
            disabled={testing || !form.smtp_host || !form.smtp_user}
            className="px-6 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
        </div>
      </form>
    </div>
  );
}
