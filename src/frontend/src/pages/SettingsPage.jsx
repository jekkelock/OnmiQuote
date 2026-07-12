import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const SMTP_BLANK = { smtp_host: '', smtp_port: 587, smtp_user: '', smtp_password: '', from_name: '' };
const GENERAL_BLANK = {
  company_name: '',
  company_email: '',
  company_phone: '',
  company_address: '',
  currency: 'EUR',
  primary_color: '#3B82F6',
  logo_url: ''
};

const TABS = [
  { id: 'general', label: 'General', icon: '⚙️' },
  { id: 'security', label: 'Security', icon: '🔒' },
  { id: 'email', label: 'Email', icon: '✉️' },
  { id: 'privacy', label: 'Privacy', icon: '🛡️' },
];

export default function SettingsPage() {
  const { token }  = useAuth();
  const [activeTab, setActiveTab] = useState('general');

  // SMTP state
  const [smtpForm, setSmtpForm] = useState(SMTP_BLANK);
  const [smtpLoading, setSmtpLoading] = useState(true);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpSaved, setSmtpSaved] = useState(false);
  const [smtpError, setSmtpError] = useState('');
  const [smtpTestResult, setSmtpTestResult] = useState(null);

  // General state
  const [generalForm, setGeneralForm] = useState(GENERAL_BLANK);
  const [generalLoading, setGeneralLoading] = useState(true);
  const [generalSaving, setGeneralSaving] = useState(false);
  const [generalSaved, setGeneralSaved] = useState(false);
  const [generalError, setGeneralError] = useState('');

  // Load SMTP settings on mount
  useEffect(() => {
    fetch('/api/settings/smtp', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.settings) {
          setSmtpForm({ ...SMTP_BLANK, ...data.settings, smtp_password: '' });
        }
        setSmtpLoading(false);
      })
      .catch(() => setSmtpLoading(false));
  }, [token]);

  // Load General settings on mount
  useEffect(() => {
    fetch('/api/settings/general', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.settings) {
          setGeneralForm(data.settings);
        }
        setGeneralLoading(false);
      })
      .catch(() => setGeneralLoading(false));
  }, [token]);

  const handleSmtpChange = (e) => {
    const { name, value } = e.target;
    setSmtpForm(prev => ({
      ...prev,
      [name]: name === 'smtp_port' ? (parseInt(value, 10) || '') : value
    }));
    setSmtpSaved(false);
    setSmtpTestResult(null);
  };

  const handleGeneralChange = (e) => {
    const { name, value } = e.target;
    setGeneralForm(prev => ({ ...prev, [name]: value }));
    setGeneralSaved(false);
  };

  const handleSmtpSubmit = async (e) => {
    e.preventDefault();
    setSmtpError(''); setSmtpSaved(false); setSmtpSaving(true);
    try {
      const res = await fetch('/api/settings/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(smtpForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save SMTP settings');
      setSmtpSaved(true);
      setSmtpForm(prev => ({ ...prev, smtp_password: '' }));
    } catch (err) {
      setSmtpError(err.message);
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleGeneralSubmit = async (e) => {
    e.preventDefault();
    setGeneralError(''); setGeneralSaved(false); setGeneralSaving(true);
    try {
      const res = await fetch('/api/settings/general', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(generalForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save general settings');
      setGeneralSaved(true);
    } catch (err) {
      setGeneralError(err.message);
    } finally {
      setGeneralSaving(false);
    }
  };

  const testConnection = async () => {
    setSmtpError(''); setSmtpTestResult(null); setSmtpTesting(true);
    try {
      const res = await fetch('/api/settings/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(smtpForm)
      });
      const data = await res.json();
      setSmtpTestResult({
        ok: res.ok,
        message: res.ok
          ? `Connection successful — test email sent to ${smtpForm.smtp_user}`
          : (data.error || 'Connection test failed')
      });
    } catch (err) {
      setSmtpTestResult({ ok: false, message: err.message });
    } finally {
      setSmtpTesting(false);
    }
  };

  if (smtpLoading || generalLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 dark:text-slate-500 text-sm">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Configure your application preferences
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="flex gap-6">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'general' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">General Settings</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              Company profile information.
            </p>

            {generalSaved && (
              <div className="mb-4 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm rounded-lg">
                ✓ Settings saved successfully.
              </div>
            )}
            {generalError && (
              <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg">
                {generalError}
              </div>
            )}

            <form onSubmit={handleGeneralSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company Name</label>
                <input
                  type="text"
                  name="company_name"
                  value={generalForm.company_name}
                  onChange={handleGeneralChange}
                  placeholder="Your Company Ltd"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company Email</label>
                <input
                  type="email"
                  name="company_email"
                  value={generalForm.company_email}
                  onChange={handleGeneralChange}
                  placeholder="contact@yourcompany.com"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company Phone</label>
                <input
                  type="tel"
                  name="company_phone"
                  value={generalForm.company_phone}
                  onChange={handleGeneralChange}
                  placeholder="+353 1 234 5678"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company Address</label>
                <input
                  type="text"
                  name="company_address"
                  value={generalForm.company_address}
                  onChange={handleGeneralChange}
                  placeholder="123 Business Street, Dublin, Ireland"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Currency</label>
                  <select
                    name="currency"
                    value={generalForm.currency}
                    onChange={handleGeneralChange}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  >
                    <option value="EUR">EUR - Euro</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="CAD">CAD - Canadian Dollar</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Primary Color</label>
                  <input
                    type="color"
                    name="primary_color"
                    value={generalForm.primary_color}
                    onChange={handleGeneralChange}
                    className="w-full h-10 px-1 py-1 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Logo URL</label>
                <input
                  type="url"
                  name="logo_url"
                  value={generalForm.logo_url}
                  onChange={handleGeneralChange}
                  placeholder="https://yourdomain.com/logo.png"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">URL to your company logo for proposal headers</p>
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="submit"
                  disabled={generalSaving}
                  className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition-colors"
                >
                  {generalSaving ? 'Saving…' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Security Settings</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Security preferences will be available here.</p>
          </div>
        )}

        {activeTab === 'email' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Email Settings</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Configure outbound email settings for proposal delivery.</p>

              {smtpSaved && (
                <div className="mb-4 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm rounded-lg">
                  ✓ Settings saved successfully.
                </div>
              )}
              {smtpError && (
                <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg">
                  {smtpError}
                </div>
              )}
              {smtpTestResult && (
                <div className={`mb-4 px-4 py-3 text-sm rounded-lg border ${
                  smtpTestResult.ok
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                }`}>
                  {smtpTestResult.ok ? '✓ ' : '✗ '}{smtpTestResult.message}
                </div>
              )}

              <form onSubmit={handleSmtpSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SMTP Host *</label>
                    <input
                      type="text"
                      name="smtp_host"
                      value={smtpForm.smtp_host}
                      onChange={handleSmtpChange}
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
                      value={smtpForm.smtp_port}
                      onChange={handleSmtpChange}
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
                    value={smtpForm.smtp_user}
                    onChange={handleSmtpChange}
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
                    value={smtpForm.smtp_password}
                    onChange={handleSmtpChange}
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
                    value={smtpForm.from_name}
                    onChange={handleSmtpChange}
                    placeholder="Your Company Name"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Displayed as the sender name in the customer's inbox</p>
                </div>

                <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="submit"
                    disabled={smtpSaving}
                    className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition-colors"
                  >
                    {smtpSaving ? 'Saving…' : 'Save Config'}
                  </button>
                  <button
                    type="button"
                    onClick={testConnection}
                    disabled={smtpTesting || !smtpForm.smtp_host || !smtpForm.smtp_user}
                    className="px-6 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
                  >
                    {smtpTesting ? 'Testing…' : 'Test Connection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Privacy Settings</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Privacy preferences will be available here.</p>
          </div>
        )}
      </div>
    </div>
  );
}