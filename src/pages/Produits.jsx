import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Package, Check, X } from 'lucide-react';
import { useLang } from '../App';
import { t } from '../utils/i18n';

export default function Produits({ showToast }) {
  const { lang } = useLang();
  const T = (k) => t(lang, k);

  const [produits, setProduits] = useState([]);
  const [newDesig, setNewDesig] = useState('');
  const [search, setSearch] = useState('');
  const [editingIndex, setEditingIndex] = useState(null); // index in filtered list
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef(null);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (editingIndex !== null && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingIndex]);

  async function load() {
    const list = await window.api.storeGet('produits', []);
    setProduits(Array.isArray(list) ? list : []);
  }

  async function add() {
    const val = newDesig.trim();
    if (!val) return;
    const current = await window.api.storeGet('produits', []);
    const list = Array.isArray(current) ? current : [];
    if (list.some(p => p.toLowerCase() === val.toLowerCase())) {
      showToast(T('produit_dup'), 'error');
      return;
    }
    const updated = [...list, val].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
    await window.api.storeSet('produits', updated);
    setProduits(updated);
    setNewDesig('');
    showToast(T('produit_added'));
  }

  async function remove(designation) {
    const updated = produits.filter(p => p !== designation);
    await window.api.storeSet('produits', updated);
    setProduits(updated);
    showToast(T('produit_deleted'));
  }

  function startEdit(originalValue) {
    const idx = filtered.indexOf(originalValue);
    setEditingIndex(idx);
    setEditValue(originalValue);
  }

  async function saveEdit(originalValue) {
    const val = editValue.trim();
    setEditingIndex(null);
    if (!val || val === originalValue) return;
    // Check duplicate
    if (produits.some(p => p !== originalValue && p.toLowerCase() === val.toLowerCase())) {
      showToast(T('produit_dup'), 'error');
      return;
    }
    const updated = produits
      .map(p => p === originalValue ? val : p)
      .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
    await window.api.storeSet('produits', updated);
    setProduits(updated);
    showToast(T('produit_updated'));
  }

  function cancelEdit() {
    setEditingIndex(null);
    setEditValue('');
  }

  const filtered = search.trim()
    ? produits.filter(p => p.toLowerCase().includes(search.trim().toLowerCase()))
    : produits;

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {T('title_produits')}
          </h1>
          <p className="text-slate-500 text-sm mt-1">{T('sub_produits')}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
          style={{ background: 'var(--bg-alt)', color: 'var(--text-secondary)' }}>
          <Package size={14} />
          {produits.length} {T('produits_count')}
        </div>
      </div>

      {/* Add new product */}
      <div className="card mb-6">
        <h2 className="section-title">{T('btn_add_produit')}</h2>
        <div className="flex gap-3">
          <input
            className="form-input flex-1"
            value={newDesig}
            onChange={e => setNewDesig(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder={T('field_designation_produit')}
            maxLength={120}
          />
          <button onClick={add} className="btn-primary" disabled={!newDesig.trim()}>
            <Plus size={16} /> {T('btn_add_produit')}
          </button>
        </div>
      </div>

      {/* Search — no icon */}
      {produits.length > 6 && (
        <div className="mb-4">
          <input
            className="form-input w-full"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={T('search_produit')}
          />
        </div>
      )}

      {/* Products list */}
      {produits.length === 0 ? (
        <div className="card text-center py-12">
          <Package size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="font-semibold text-slate-500">{T('no_produits')}</p>
          <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">{T('no_produits_sub')}</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-alt)', borderBottom: '1px solid var(--border-color)' }}>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {T('field_designation')}
                </th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={2} className="text-center py-8 text-slate-400 italic">
                    {T('no_results')} «&nbsp;{search}&nbsp;»
                  </td>
                </tr>
              ) : filtered.map((p, i) => (
                <tr key={p}
                  className={i % 2 === 1 ? 'table-row-alt' : ''}
                  style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td className="px-4 py-2">
                    {editingIndex === i ? (
                      <input
                        ref={editInputRef}
                        className="form-input w-full py-1 text-sm"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveEdit(p);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        onBlur={() => saveEdit(p)}
                        maxLength={120}
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:underline"
                        style={{ color: 'var(--text-primary)' }}
                        onClick={() => startEdit(p)}
                        title={T('click_to_edit')}
                      >
                        {p}
                      </span>
                    )}
                  </td>
                  <td className="px-3 text-center">
                    {editingIndex === i ? (
                      <div className="flex items-center gap-1 justify-center">
                        <button onMouseDown={() => saveEdit(p)}
                          className="text-green-500 hover:text-green-700 p-1 transition-colors">
                          <Check size={14} />
                        </button>
                        <button onMouseDown={cancelEdit}
                          className="text-slate-400 hover:text-slate-600 p-1 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => remove(p)}
                        className="text-red-400 hover:text-red-600 transition-colors p-1 rounded">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
