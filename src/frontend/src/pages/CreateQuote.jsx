import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const UNIT_TYPES = ['hour', 'day', 'item', 'service', 'm²', 'kg'];

const STEP_LABELS = ['Customer Details', 'Line Items', 'Preview & Send'];

function StepBar({ current }) {
  return (
    <div className="flex items-center mb-8">
      {STEP_LABELS.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <React.Fragment key={step}>
            <div className="flex items-center gap-2">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                done   ? 'bg-blue-600 border-blue-600 text-white' :
                active ? 'border-blue-600 text-blue-600' :
                         'border-slate-300 text-slate-400'
              }`}>
                {done ? '✓' : step}
              </span>
              <span className={`text-sm font-medium ${active ? 'text-slate-900' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`flex-1 mx-3 h-px ${done ? 'bg-blue-600' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function CreateQuote() {
  const { token }  = useAuth();
  const navigate   = useNavigate();

  const [step, setStep]       = useState(1);
  const [services, setServices] = useState([]);
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '' });
  const [lineItems, setLineItems] = useState([]);
  const [customRow, setCustomRow] = useState({ item_name: '', description: '', custom_price: '', quantity: 1 });

  const [saving, setSaving]   = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError]     = useState('');
  const [sendResult, setSendResult] = useState(null); // { ok, message }

  useEffect(() => {
    fetch('/api/catalog/services', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setServices(d.services || []))
      .catch(() => {});
  }, [token]);

  /* ── Line item helpers ── */

  const addFromCatalog = (e) => {
    const svc = services.find(s => s.id === parseInt(e.target.value));
    if (!svc) return;
    e.target.value = '';
    setLineItems(prev => [...prev, {
      _id:         Date.now(),
      item_name:   svc.item_name,
      description: svc.description || '',
      custom_price: Number(svc.base_price),
      quantity:    1
    }]);
  };

  const addCustomRow = () => {
    if (!customRow.item_name.trim() || !customRow.custom_price) return;
    setLineItems(prev => [...prev, {
      _id:          Date.now(),
      item_name:    customRow.item_name.trim(),
      description:  customRow.description.trim(),
      custom_price: Number(customRow.custom_price),
      quantity:     Number(customRow.quantity) || 1
    }]);
    setCustomRow({ item_name: '', description: '', custom_price: '', quantity: 1 });
  };

  const updateItem = (id, field, val) =>
    setLineItems(prev => prev.map(it => it._id === id ? { ...it, [field]: val } : it));

  const removeItem = (id) =>
    setLineItems(prev => prev.filter(it => it._id !== id));

  const total = lineItems.reduce((s, it) => s + (Number(it.custom_price) * Number(it.quantity)), 0);

  /* ── API calls ── */

  const buildPayload = () => ({
    customer_name:  customer.name  || null,
    customer_email: customer.email || null,
    customer_phone: customer.phone || null,
    line_items: lineItems.map(({ item_name, description, custom_price, quantity }) =>
      ({ item_name, description, custom_price: Number(custom_price), quantity: Number(quantity) })),
    total
  });

  const saveAsDraft = async () => {
    setSaving(true); setError('');
    try {
      const res  = await fetch('/api/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(buildPayload())
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const sendViaEmail = async () => {
    if (!customer.email) { setError('Customer email is required to send via email.'); return; }
    setSending(true); setError(''); setSendResult(null);
    try {
      // Step A: create draft
      const createRes  = await fetch('/api/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(buildPayload())
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || 'Failed to create proposal');

      const proposalId = createData.proposal.id;

      // Step B: send
      const sendRes  = await fetch(`/api/proposal/${proposalId}/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const sendData = await sendRes.json();

      if (sendRes.ok) {
        setSendResult({ ok: true, message: `Proposal sent to ${customer.email}!` });
        setTimeout(() => navigate('/dashboard'), 2000);
      } else {
        // Proposal saved as Draft but email failed
        setSendResult({ ok: false, message: sendData.error || 'Email delivery failed. Proposal saved as Draft.' });
        setSending(false);
      }
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  };

  /* ── Render ── */

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">New Quote</h1>

      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <StepBar current={step} />

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* ── Step 1: Customer Details ── */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-slate-800 mb-2">Customer Details</h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                value={customer.name}
                onChange={e => setCustomer(p => ({ ...p, name: e.target.value }))}
                placeholder="Jane Smith / Acme Ltd."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={customer.email}
                onChange={e => setCustomer(p => ({ ...p, email: e.target.value }))}
                placeholder="jane@example.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">Required to send via email</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="tel"
                value={customer.phone}
                onChange={e => setCustomer(p => ({ ...p, phone: e.target.value }))}
                placeholder="+353 1 234 5678"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setStep(2)}
                disabled={!customer.name.trim()}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition-colors"
              >
                Next: Add Items →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Line Items ── */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-base font-semibold text-slate-800">Line Items</h2>

            {/* Add from catalog */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Add from Catalog</label>
              <select
                onChange={addFromCatalog}
                defaultValue=""
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">— Select a saved service —</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.item_name} · €{Number(s.base_price).toFixed(2)} / {s.unit_type}
                  </option>
                ))}
              </select>
            </div>

            {/* Add custom on-the-spot */}
            <div className="border border-dashed border-slate-300 rounded-lg p-4 bg-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Or add a one-off item
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Item name *"
                  value={customRow.item_name}
                  onChange={e => setCustomRow(p => ({ ...p, item_name: e.target.value }))}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={customRow.description}
                  onChange={e => setCustomRow(p => ({ ...p, description: e.target.value }))}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Unit price (€) *"
                  value={customRow.custom_price}
                  onChange={e => setCustomRow(p => ({ ...p, custom_price: e.target.value }))}
                  min="0"
                  step="0.01"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Qty"
                  value={customRow.quantity}
                  onChange={e => setCustomRow(p => ({ ...p, quantity: e.target.value }))}
                  min="1"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={addCustomRow}
                disabled={!customRow.item_name.trim() || !customRow.custom_price}
                className="px-4 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:bg-slate-300 transition-colors"
              >
                + Add Item
              </button>
            </div>

            {/* Current line items */}
            {lineItems.length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-2">Item</th>
                      <th className="text-center px-2 py-2 w-20">Qty</th>
                      <th className="text-right px-2 py-2 w-28">Unit Price</th>
                      <th className="text-right px-2 py-2 w-28">Subtotal</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lineItems.map(it => (
                      <tr key={it._id} className="bg-white">
                        <td className="px-4 py-2">
                          <p className="font-medium text-slate-800">{it.item_name}</p>
                          {it.description && <p className="text-xs text-slate-400">{it.description}</p>}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input
                            type="number"
                            value={it.quantity}
                            onChange={e => updateItem(it._id, 'quantity', e.target.value)}
                            min="1"
                            className="w-16 text-center px-1 py-1 border border-slate-200 rounded text-sm"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number"
                            value={it.custom_price}
                            onChange={e => updateItem(it._id, 'custom_price', e.target.value)}
                            min="0"
                            step="0.01"
                            className="w-24 text-right px-1 py-1 border border-slate-200 rounded text-sm"
                          />
                        </td>
                        <td className="px-2 py-2 text-right font-medium text-slate-800">
                          €{(Number(it.custom_price) * Number(it.quantity)).toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => removeItem(it._id)}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                            title="Remove"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-right font-bold text-slate-900">
                  Total: €{total.toFixed(2)}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(1)} className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm transition-colors">
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={lineItems.length === 0}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition-colors"
              >
                Next: Preview →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Preview & Send ── */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-base font-semibold text-slate-800">Preview & Send</h2>

            {sendResult && (
              <div className={`px-4 py-3 rounded-lg text-sm ${sendResult.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
                {sendResult.message}
              </div>
            )}

            {/* Customer summary */}
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Customer</p>
              <p className="font-medium text-slate-900">{customer.name}</p>
              {customer.email && <p className="text-sm text-slate-600">{customer.email}</p>}
              {customer.phone && <p className="text-sm text-slate-600">{customer.phone}</p>}
            </div>

            {/* Line items summary */}
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2">Item</th>
                    <th className="text-center px-2 py-2">Qty</th>
                    <th className="text-right px-2 py-2">Unit Price</th>
                    <th className="text-right px-4 py-2">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineItems.map(it => (
                    <tr key={it._id} className="bg-white">
                      <td className="px-4 py-2">
                        <p className="font-medium text-slate-800">{it.item_name}</p>
                        {it.description && <p className="text-xs text-slate-400">{it.description}</p>}
                      </td>
                      <td className="px-2 py-2 text-center text-slate-600">{it.quantity}</td>
                      <td className="px-2 py-2 text-right text-slate-600">€{Number(it.custom_price).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-medium text-slate-800">
                        €{(Number(it.custom_price) * Number(it.quantity)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-right font-bold text-lg text-slate-900">
                Total: €{total.toFixed(2)}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 gap-3">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm transition-colors"
              >
                ← Back
              </button>
              <div className="flex gap-3">
                <button
                  onClick={saveAsDraft}
                  disabled={saving || sending || !!sendResult?.ok}
                  className="px-5 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving…' : 'Save as Draft'}
                </button>
                <button
                  onClick={sendViaEmail}
                  disabled={sending || saving || !!sendResult?.ok || !customer.email}
                  className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:bg-slate-300 transition-colors"
                  title={!customer.email ? 'Customer email required' : undefined}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {sending ? 'Sending…' : 'Send via Email'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
