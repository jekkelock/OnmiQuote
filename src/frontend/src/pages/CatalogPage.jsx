import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const BLANK = { item_name: '', description: '', base_price: '', unit_type: 'hour' };
const UNITS  = ['hour', 'day', 'item', 'service', 'm²', 'kg'];

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export default function CatalogPage() {
  const { token }  = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const [modal, setModal]   = useState(null); // null | 'add' | 'edit'
  const [form, setForm]     = useState(BLANK);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving]   = useState(false);

  const load = () => {
    fetch('/api/catalog/services', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setServices(d.services || []); setLoading(false); })
      .catch(() => { setError('Failed to load catalog.'); setLoading(false); });
  };

  useEffect(() => { load(); }, [token]);

  const openAdd = () => { setForm(BLANK); setEditing(null); setModal('add'); };
  const openEdit = (svc) => { setForm({ ...svc, base_price: String(svc.base_price) }); setEditing(svc); setModal('edit'); };
  const closeModal = () => { setModal(null); setError(''); };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    const url    = editing ? `/api/catalog/services/${editing.id}` : '/api/catalog/services';
    const method = editing ? 'PUT' : 'POST';
    try {
      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, base_price: parseFloat(form.base_price) || 0 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      if (editing) {
        setServices(prev => prev.map(s => s.id === editing.id ? data.service : s));
      } else {
        setServices(prev => [...prev, data.service]);
      }
      closeModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this service from the catalog?')) return;
    try {
      await fetch(`/api/catalog/services/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setServices(prev => prev.filter(s => s.id !== id));
    } catch {
      setError('Failed to delete service.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Items Catalog</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Saved services available in the quote builder</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Service
        </button>
      </div>

      {error && !modal && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg">{error}</div>
      )}

      {/* Services table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 text-sm">Loading catalog…</div>
        ) : services.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-slate-400 dark:text-slate-500 text-sm">No services yet.</p>
            <button onClick={openAdd} className="mt-2 text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline">
              Add your first service →
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              <tr>
                <th className="text-left px-6 py-3">Service Name</th>
                <th className="text-left px-6 py-3">Description</th>
                <th className="text-right px-6 py-3">Base Price</th>
                <th className="text-left px-6 py-3">Unit</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {services.map(svc => (
                <tr key={svc.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                  <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">{svc.item_name}</td>
                  <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{svc.description || <span className="italic">—</span>}</td>
                  <td className="px-6 py-3 text-right font-medium text-slate-800 dark:text-slate-200">
                    €{Number(svc.base_price).toFixed(2)}
                  </td>
                  <td className="px-6 py-3">
                    <span className="inline-flex px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-full">
                      {svc.unit_type}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => openEdit(svc)} className="text-blue-600 dark:text-blue-400 hover:underline mr-4">Edit</button>
                    <button onClick={() => handleDelete(svc.id)} className="text-red-500 dark:text-red-400 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modal && (
        <Modal title={modal === 'edit' ? 'Edit Service' : 'Add Service'} onClose={closeModal}>
          {error && (
            <div className="mb-4 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg">{error}</div>
          )}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Service Name *</label>
              <input
                type="text"
                name="item_name"
                value={form.item_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                placeholder="e.g. Consulting Session"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
              <input
                type="text"
                name="description"
                value={form.description}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                placeholder="Short description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Base Price (€) *</label>
                <input
                  type="number"
                  name="base_price"
                  value={form.base_price}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Unit Type *</label>
                <select
                  name="unit_type"
                  value={form.unit_type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition-colors">
                {saving ? 'Saving…' : modal === 'edit' ? 'Update Service' : 'Add Service'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
