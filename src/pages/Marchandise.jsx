import { useState, useEffect } from 'react';
import { Download, Plus, X, ShoppingCart, Trash2, ChevronLeft, Clock } from 'lucide-react';
import { buildMarchandisePdf } from '../utils/pdfTemplate';
import { useLang } from '../App';
import { t } from '../utils/i18n';
import { todayIso } from '../utils/helpers';
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('fr-DZ');
}

const emptyProduit = () => ({ id: Date.now() + Math.random(), designation: '', quantite: '', description: '', lieuAchat: '' });

export default function Marchandise({ settings, showToast }) {
  const { lang } = useLang();
  const T = (k) => t(lang, k);

  // views: 'list' | 'form'
  const [view, setView] = useState('list');
  const [historique, setHistorique] = useState([]);
  const [num, setNum] = useState('');
  const [date, setDate] = useState(todayIso());
  const [produits, setProduits] = useState([emptyProduit()]);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const hist = await window.api.storeGet('marchandise', []);
    setHistorique(hist || []);
    const counters = await window.api.storeGet('counters', {});
    setNum(String((counters.marchandise || 0) + 1).padStart(4, '0'));
  }

  function startNew() {
    setEditId(null);
    setDate(todayIso());
    setProduits([emptyProduit()]);
    loadData().then(() => setView('form'));
  }

  function openRecord(rec) {
    setEditId(rec.id);
    setNum(rec.numero);
    setDate(rec.date);
    setProduits(rec.produits.length ? rec.produits : [emptyProduit()]);
    setView('form');
  }

  function addProduit() {
    setProduits(p => [...p, emptyProduit()]);
  }

  function updateProduit(id, field, value) {
    setProduits(p => p.map(x => x.id === id ? { ...x, [field]: value } : x));
  }

  function removeProduit(id) {
    setProduits(p => p.length > 1 ? p.filter(x => x.id !== id) : p);
  }

  async function saveRecord() {
    const validProduits = produits.filter(p => p.designation.trim());
    if (!validProduits.length) { showToast(T('add_article_error'), 'error'); return; }

    const counters = await window.api.storeGet('counters', {});
    let newNum = num;
    let newCounterVal = counters.marchandise || 0;

    if (!editId) {
      newCounterVal = (counters.marchandise || 0) + 1;
      newNum = String(newCounterVal).padStart(4, '0');
      await window.api.storeSet('counters', { ...counters, marchandise: newCounterVal });
    }

    const record = {
      id: editId || Date.now(),
      numero: newNum,
      date,
      produits: validProduits,
      createdAt: editId ? undefined : new Date().toISOString(),
    };

    const existing = await window.api.storeGet('marchandise', []);
    let updated;
    if (editId) {
      updated = existing.map(r => r.id === editId ? { ...r, ...record } : r);
    } else {
      updated = [record, ...existing];
    }
    await window.api.storeSet('marchandise', updated);
    setHistorique(updated);
    if (!editId) setNum(String(newCounterVal + 1).padStart(4, '0'));
    showToast(T('marchandise_saved'));
  }

  async function deleteRecord(id) {
    const existing = await window.api.storeGet('marchandise', []);
    const updated = existing.filter(r => r.id !== id);
    await window.api.storeSet('marchandise', updated);
    setHistorique(updated);
    showToast(T('marchandise_deleted'));
  }

  async function exportPdf() {
    const validProduits = produits.filter(p => p.designation.trim());
    if (!validProduits.length) { showToast(T('add_article_error'), 'error'); return; }
    // Validate each product has a name
    const errs = [];
    validProduits.forEach((p, i) => {
      if (!p.designation.trim()) errs.push(`${T('validation_article_designation_required')} (${i + 1})`);
    });
    if (errs.length) { setValidationErrors(errs); showToast(errs[0], 'error'); return; }
    setValidationErrors([]);
    const filePath = await window.api.saveDialog({
      defaultName: `Marchandise-${num}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (!filePath) return;
    setLoading('pdf');
    try {
      const docData = { date, numero: num, produits: validProduits };
      const result = await window.api.exportPdf({
        htmlContent: buildMarchandisePdf(docData, settings),
        filePath,
        pageSize: 'A4',
      });
      if (result.success) {
        showToast(T('marchandise_exported'));
      } else { showToast(`${T('export_error')}: ${result.error}`, 'error'); }
    } finally { setLoading(''); }
  }

  const docColor = settings?.couleur || '#0f2044';

  // ─── LIST VIEW ──────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between py-4 mb-6 -mx-8 px-8" style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{T('title_marchandise')}</h1>
            <p className="text-slate-500 text-sm mt-1">{T('sub_marchandise')}</p>
          </div>
          <button onClick={startNew} className="btn-primary">
            <Plus size={16} /> {T('btn_new_marchandise')}
          </button>
        </div>

        {historique.length === 0 ? (
          <div className="card flex flex-col items-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${docColor}18` }}>
              <ShoppingCart size={28} style={{ color: docColor }} />
            </div>
            <p className="font-semibold text-slate-700">{T('no_marchandise')}</p>
            <p className="text-slate-500 text-sm mt-1">{T('no_marchandise_sub')}</p>
            <button onClick={startNew} className="btn-primary mt-6">
              <Plus size={15} /> {T('btn_new_marchandise')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {historique.map(rec => (
              <div key={rec.id} className="card flex items-center justify-between gap-4 cursor-pointer hover:shadow-md transition-all"
                onClick={() => openRecord(rec)}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${docColor}18` }}>
                    <ShoppingCart size={18} style={{ color: docColor }} />
                  </div>
                  <div>
                    <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Bon N° {rec.numero}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {fmtDate(rec.date)} — {rec.produits.length} produit{rec.produits.length > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); deleteRecord(rec.id); }}
                  className="btn-danger p-2 flex-shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── FORM VIEW ──────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between py-4 mb-6 -mx-8 px-8" style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setView('list')} className="btn-secondary p-2">
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {editId ? `Bon N° ${num}` : T('btn_new_marchandise')}
            </h1>
            <p className="text-slate-500 text-sm mt-1">{T('sub_marchandise')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {validationErrors.length > 0 && (
            <ul className="validation-errors list-disc list-inside">
              {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          <button onClick={() => setView('list')} className="btn-secondary">
            <Clock size={16} /> {T('btn_historique')}
          </button>
          <button onClick={exportPdf} disabled={!!loading} className="btn-secondary">
            <Download size={16} /> {loading === 'pdf' ? T('btn_exporting') : T('btn_export_pdf')}
          </button>
          <button onClick={saveRecord} className="btn-primary">
            {T('btn_save')}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Doc info */}
        <div className="card">
          <h2 className="section-title">{T('sec_doc_info')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="form-label">{T('field_numero')}</label>
              <input className="form-input font-mono" value={num} onChange={e => setNum(e.target.value)} placeholder="0001" /></div>
            <div><label className="form-label">{T('field_date')}</label>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} placeholder="JJ/MM/AAAA" /></div>
          </div>
        </div>

        {/* Produits */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">{T('sec_produits')}</h2>
            <button onClick={addProduit} className="btn-primary" style={{ padding: '6px 14px', fontSize: '13px' }}>
              <Plus size={14} /> {T('btn_add')}
            </button>
          </div>

          <div className="space-y-3">
            {produits.map((p, idx) => (
              <div key={p.id} className="rounded-xl border p-4 relative" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-alt)' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                    {T('badge_produit')} {idx + 1}
                  </span>
                  {produits.length > 1 && (
                    <button onClick={() => removeProduit(p.id)} className="btn-danger p-1.5">
                      <X size={13} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">{T('field_designation')}</label>
                    <input className="form-input" value={p.designation}
                      onChange={e => updateProduit(p.id, 'designation', e.target.value)}
                      placeholder={T('placeholder_produit_nom')} />
                  </div>
                  <div>
                    <label className="form-label">{T('field_quantite')}</label>
                    <input className="form-input" value={p.quantite}
                      onChange={e => updateProduit(p.id, 'quantite', e.target.value)}
                      placeholder={T('placeholder_produit_qty')} />
                  </div>
                  <div>
                    <label className="form-label">{T('field_description_produit')}</label>
                    <input className="form-input" value={p.description}
                      onChange={e => updateProduit(p.id, 'description', e.target.value)}
                      placeholder={T('placeholder_produit_desc')} />
                  </div>
                  <div>
                    <label className="form-label">{T('field_lieu_achat')}</label>
                    <input className="form-input" value={p.lieuAchat}
                      onChange={e => updateProduit(p.id, 'lieuAchat', e.target.value)}
                      placeholder={T('placeholder_produit_source')} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={addProduit}
            className="mt-4 w-full py-3 rounded-xl border-2 border-dashed text-sm font-medium transition-all"
            style={{ borderColor: `${docColor}50`, color: docColor, background: `${docColor}08` }}>
            <Plus size={14} className="inline mr-1" /> {T('btn_add_produit')}
          </button>
        </div>
      </div>
    </div>
  );
}
