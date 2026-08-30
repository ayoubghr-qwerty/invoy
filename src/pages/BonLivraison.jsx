import { useState, useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import ArticlesTable from '../components/ArticlesTable';
import ClientSelect from '../components/ClientSelect';
import { buildBonLivraisonPdf } from '../utils/pdfTemplate';
import { useLang } from '../App';
import { t } from '../utils/i18n';
import ExportButton from '../components/ExportButton';
import { saveToHistory } from '../utils/history';

function todayIso() { return new Date().toISOString().slice(0, 10); }

export default function BonLivraison({ settings, showToast, pendingLoad, onLoadConsumed }) {
  const { lang } = useLang();
  const T = (k) => t(lang, k);

  const [clients, setClients] = useState([]);
  const [num, setNum] = useState('');
  const [date, setDate] = useState(todayIso());
  const [client, setClient] = useState({ nom: '', adresse: '', telephones: [''] });
  const [articles, setArticles] = useState([]);
  const [pageSize, setPageSize] = useState('A4');
  const [loading, setLoading] = useState('');
  const autoNumRef = useRef('');

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!pendingLoad) return;
    const d = pendingLoad;
    if (d.client)   setClient(d.client);
    if (d.articles) setArticles(d.articles);
    if (d.pageSize) setPageSize(d.pageSize);
    if (d.date)     setDate(d.date);
    if (d.numero)   setNum(d.numero);
    onLoadConsumed?.();
    showToast('Document chargé depuis l\'historique');
  }, [pendingLoad]);

  async function loadData() {
    const list = await window.api.storeGet('clients', []);
    setClients(list || []);
    const counters = await window.api.storeGet('counters', {});
    const auto = String((counters.bonLivraison || 0) + 1).padStart(4, '0');
    autoNumRef.current = auto;
    setNum(auto);
  }

  const total = articles.reduce((s, a) => s + (parseFloat(a.montant) || 0), 0);

  async function saveClientIfNew() {
    if (!client.nom.trim()) return;
    const existing = await window.api.storeGet('clients', []);
    if (!existing.find(c => c.nom.toLowerCase() === client.nom.toLowerCase())) {
      await window.api.storeSet('clients', [...existing, { ...client, id: Date.now() }]);
    }
  }

  async function exportDoc(format) {
    if (!articles.length) { showToast(T('add_article_error'), 'error'); return; }
    const counters = await window.api.storeGet('counters', {});
    const newNum = (counters.bonLivraison || 0) + 1;
    const isManual = num.trim() !== autoNumRef.current;
    const finalNum = isManual ? num.trim() : String(newNum).padStart(4, '0');
    const docData = { client, articles, total, date, numero: finalNum, settings, pageSize };
    const filePath = await window.api.saveDialog({
      defaultName: `Bon-Livraison-${finalNum}.${format}`,
      filters: format === 'docx' ? [{ name: 'Word Document', extensions: ['docx'] }] : [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (!filePath) return;
    setLoading(format);
    try {
      let result;
      if (format === 'docx') {
        result = await window.api.exportDocx({ type: 'bon-livraison', data: docData, filePath });
      } else {
        result = await window.api.exportPdf({ htmlContent: buildBonLivraisonPdf(docData, settings), filePath, pageSize });
      }
      if (result.success) {
        await saveClientIfNew();
        if (!isManual) {
          await window.api.storeSet('counters', { ...counters, bonLivraison: newNum });
          const nextAuto = String(newNum + 1).padStart(4, '0');
          autoNumRef.current = nextAuto;
          setNum(nextAuto);
        }
        await saveToHistory({ type: 'livraison', numero: finalNum, date, client, articles, montant: total, pageSize });
        showToast(`${T('title_livraison')} — ${T('exported_ok')} ${format.toUpperCase()} ${T('exported_success')}`);
      } else { showToast(`${T('export_error')}: ${result.error}`, 'error'); }
    } finally { setLoading(''); }
  }

  const docColor = settings?.couleur || '#0f2044';

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{color:"var(--text-primary)"}}>{T('title_livraison')}</h1>
          <p className="text-slate-500 text-sm mt-1">{T('sub_livraison')}</p>
        </div>
        <div className="flex gap-2">
          <ExportButton onExport={exportDoc} loading={loading} color={docColor} />
        </div>
      </div>

      <div className="space-y-6">
        <div className="card">
          <h2 className="section-title">{T('sec_doc_info')}</h2>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="form-label">{T('field_numero')}</label>
              <input className="form-input font-mono" value={num} onChange={e => setNum(e.target.value)} /></div>
            <div><label className="form-label">{T('field_date')}</label>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div>
              <label className="form-label">{T('field_taille_pdf')}</label>
              <div className="flex gap-2 mt-1">
                {['A4', 'A5'].map(s => (
                  <button key={s} onClick={() => setPageSize(s)}
                    className="flex-1 py-2 rounded-lg border text-sm font-bold transition-all"
                    style={{
                      background: pageSize === s ? docColor : 'var(--bg-input)',
                      color: pageSize === s ? 'white' : 'var(--text-secondary)',
                      borderColor: pageSize === s ? docColor : 'var(--border-input)',
                    }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">{T('sec_client_info')}</h2>
          <ClientSelect clients={clients} value={client} onChange={setClient} />
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div><label className="form-label">{T('field_nom')}</label>
              <input className="form-input" value={client.nom} onChange={e => setClient(c => ({ ...c, nom: e.target.value }))} /></div>
            <div><label className="form-label">{T('field_adresse')}</label>
              <input className="form-input" value={client.adresse} onChange={e => setClient(c => ({ ...c, adresse: e.target.value }))} /></div>
            <div className="col-span-2">
              <label className="form-label">{T('field_telephones')}</label>
              <div className="space-y-2">
                {(client.telephones || ['']).map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="form-input flex-1" value={p} onChange={e => {
                      const tt = [...(client.telephones || [''])]; tt[i] = e.target.value;
                      setClient(c => ({ ...c, telephones: tt }));
                    }} placeholder={`${T('field_telephone')} ${i + 1}`} />
                    {(client.telephones || []).length > 1 && (
                      <button onClick={() => setClient(c => ({ ...c, telephones: c.telephones.filter((_, idx) => idx !== i) }))} className="btn-danger p-2"><X size={14} /></button>
                    )}
                  </div>
                ))}
                <button onClick={() => setClient(c => ({ ...c, telephones: [...(c.telephones || ['']), ''] }))}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                  <Plus size={13} /> {T('btn_add_phone')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">{T('sec_articles_livres')}</h2>
          <ArticlesTable articles={articles} onChange={setArticles} />
        </div>

        {total > 0 && (
          <div className="card">
            <div className="flex justify-end">
              <div className="w-72 flex justify-between items-center py-3 px-4 rounded-lg text-white font-bold text-lg" style={{ background: docColor }}>
                <span>{T('total')}</span>
                <span>{total.toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} DA</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
