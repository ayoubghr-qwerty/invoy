import { useState, useEffect, useRef } from 'react';
import { Package } from 'lucide-react';
import ArticlesTable from '../components/ArticlesTable';
import ClientSelect from '../components/ClientSelect';
import PageSizeSelect from '../components/PageSizeSelect';
import PhoneSection from '../components/PhoneSection';
import { buildBonLivraisonPdf } from '../utils/pdfTemplate';
import { useLang } from '../App';
import { t } from '../utils/i18n';
import ExportButton from '../components/ExportButton';
import EmptyState from '../components/EmptyState';
import { saveToHistory } from '../utils/history';
import { todayIso, saveClientIfNew } from '../utils/helpers';
import { validateDoc } from '../utils/validation';

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
  const [validationErrors, setValidationErrors] = useState([]);
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
    showToast(T('doc_loaded_from_history_bl'));
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

  async function exportDoc(format) {
    const { valid, errors } = validateDoc({ client, articles, lang });
    if (!valid) {
      setValidationErrors(errors);
      showToast(errors[0], 'error');
      return;
    }
    setValidationErrors([]);
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
        await saveClientIfNew(client);
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
    <div className="max-w-5xl mx-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between py-4 mb-6 -mx-8 px-8" style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)' }}>
        <div>
          <h1 className="text-2xl font-bold" style={{color:"var(--text-primary)"}}>{T('title_livraison')}</h1>
          <p className="text-slate-500 text-sm mt-1">{T('sub_livraison')}</p>
        </div>
        <div className="flex gap-2">
          {validationErrors.length > 0 && (
            <ul className="validation-errors list-disc list-inside">
              {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          <ExportButton onExport={exportDoc} loading={loading} color={docColor} htmlContent={buildBonLivraisonPdf({ client, articles, total, date, numero: num, settings, pageSize }, settings)} T={T} client={client} docTitle={T('title_livraison')} num={num} showToast={showToast} />
        </div>
      </div>

      <div className="space-y-6">
        <div className="card">
          <h2 className="section-title">{T('sec_doc_info')}</h2>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="form-label">{T('field_numero')}</label>
              <input className="form-input font-mono" value={num} onChange={e => setNum(e.target.value)} placeholder="0001" /></div>
            <div><label className="form-label">{T('field_date')}</label>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} placeholder="JJ/MM/AAAA" /></div>
            <div>
              <PageSizeSelect value={pageSize} onChange={setPageSize} color={docColor} />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">{T('sec_client_info')}</h2>
          <ClientSelect clients={clients} value={client} onChange={setClient} />
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div><label className="form-label">{T('field_nom')}</label>
              <input className="form-input" value={client.nom} onChange={e => setClient(c => ({ ...c, nom: e.target.value }))} placeholder="Ex: Société ABC" /></div>
            <div><label className="form-label">{T('field_adresse')}</label>
              <input className="form-input" value={client.adresse} onChange={e => setClient(c => ({ ...c, adresse: e.target.value }))} placeholder="Ex: 123 Rue Didouche Mourad, Alger" /></div>
            <PhoneSection phones={client.telephones || ['']} onChange={tt => setClient(c => ({ ...c, telephones: tt }))} />
            <div>
              <label className="form-label">{T('field_email')}</label>
              <input className="form-input" type="email" value={client.email || ''} onChange={e => setClient(c => ({ ...c, email: e.target.value }))} placeholder="Ex: contact@entreprise.dz" />
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
