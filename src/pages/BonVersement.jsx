import { useState, useEffect, useRef } from 'react';
import { Package } from 'lucide-react';
import ArticlesTable from '../components/ArticlesTable';
import ClientSelect from '../components/ClientSelect';
import PageSizeSelect from '../components/PageSizeSelect';
import PhoneSection from '../components/PhoneSection';
import { buildBonVersementPdf } from '../utils/pdfTemplate';
import { useLang } from '../App';
import { t } from '../utils/i18n';
import ExportButton from '../components/ExportButton';
import EmptyState from '../components/EmptyState';
import { saveToHistory } from '../utils/history';
import { todayIso, saveClientIfNew } from '../utils/helpers';
import { validateDoc } from '../utils/validation';

export default function BonVersement({ settings, showToast, pendingLoad, onLoadConsumed }) {
  const { lang } = useLang();
  const T = (k) => t(lang, k);

  const [clients, setClients] = useState([]);
  const [num, setNum] = useState('');
  const [date, setDate] = useState(todayIso());
  const [client, setClient] = useState({ nom: '', adresse: '', telephones: [''] });
  const [articles, setArticles] = useState([]);
  const [montantVerse, setMontantVerse] = useState('');
  const [notes, setNotes] = useState('');
  const [pageSize, setPageSize] = useState('A4');
  const [loading, setLoading] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);
  const autoNumRef = useRef('');

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!pendingLoad) return;
    const d = pendingLoad;
    if (d.client)       setClient(d.client);
    if (d.articles)     setArticles(d.articles);
    if (d.montantVerse != null) setMontantVerse(String(d.montantVerse));
    if (d.notes)        setNotes(d.notes);
    if (d.pageSize)     setPageSize(d.pageSize);
    if (d.date)         setDate(d.date);
    if (d.numero)       setNum(d.numero);
    onLoadConsumed?.();
    showToast(T('doc_loaded_from_history_bl'));
  }, [pendingLoad]);

  async function loadData() {
    const list = await window.api.storeGet('clients', []);
    setClients(list || []);
    const counters = await window.api.storeGet('counters', {});
    const auto = String((counters.bonVersement || 0) + 1).padStart(4, '0');
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
    const newNum = (counters.bonVersement || 0) + 1;
    const isManual = num.trim() !== autoNumRef.current;
    const finalNum = isManual ? num.trim() : String(newNum).padStart(4, '0');
    const docData = { client, articles, total, montantVerse: parseFloat(montantVerse) || 0, notes, date, numero: finalNum, settings, pageSize };
    const filePath = await window.api.saveDialog({
      defaultName: `Bon-Versement-${finalNum}.${format}`,
      filters: format === 'docx' ? [{ name: 'Word Document', extensions: ['docx'] }] : [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (!filePath) return;
    setLoading(format);
    try {
      let result;
      if (format === 'docx') {
        result = await window.api.exportDocx({ type: 'bon-versement', data: docData, filePath });
      } else {
        result = await window.api.exportPdf({ htmlContent: buildBonVersementPdf(docData, settings), filePath, pageSize });
      }
      if (result.success) {
        await saveClientIfNew(client);
        if (!isManual) {
          await window.api.storeSet('counters', { ...counters, bonVersement: newNum });
          const nextAuto = String(newNum + 1).padStart(4, '0');
          autoNumRef.current = nextAuto;
          setNum(nextAuto);
        }
        await saveToHistory({ type: 'versement', numero: finalNum, date, client, articles, montant: parseFloat(montantVerse) || total, montantVerse: parseFloat(montantVerse) || 0, notes, pageSize });
        showToast(`${T('title_versement')} — ${T('exported_ok')} ${format.toUpperCase()} ${T('exported_success')}`);
      } else { showToast(`${T('export_error')}: ${result.error}`, 'error'); }
    } finally { setLoading(''); }
  }

  const docColor = settings?.couleur || '#0f2044';
  const solde = total - parseFloat(montantVerse || 0);

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{color:"var(--text-primary)"}}>{T('title_versement')}</h1>
          <p className="text-slate-500 text-sm mt-1">{T('sub_versement')}</p>
        </div>
        <div className="flex gap-2">
          {validationErrors.length > 0 && (
            <ul className="validation-errors list-disc list-inside">
              {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          <ExportButton onExport={exportDoc} loading={loading} color={docColor} htmlContent={buildBonVersementPdf({ client, articles, total, montantVerse: parseFloat(montantVerse) || 0, notes, date, numero: num, settings, pageSize }, settings)} T={T} client={client} docTitle={T('title_versement')} num={num} showToast={showToast} />
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
              <PageSizeSelect value={pageSize} onChange={setPageSize} color={docColor} />
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
            <PhoneSection phones={client.telephones || ['']} onChange={tt => setClient(c => ({ ...c, telephones: tt }))} />
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">{T('sec_articles_section')}</h2>
          {articles.length === 0 ? (
            <EmptyState icon={Package} title={T('empty_articles_title')} subtitle={T('empty_articles_subtitle')} />
          ) : (
            <ArticlesTable articles={articles} onChange={setArticles} />
          )}
        </div>

        <div className="card">
          <h2 className="section-title">{T('sec_versement')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">{T('field_montant_verse')}</label>
              <input type="number" min="0" step="0.01" className="form-input font-bold text-lg"
                style={{ color: docColor }} value={montantVerse} onChange={e => setMontantVerse(e.target.value)} placeholder="0.00" />
            </div>
            <div className="flex items-end">
              {total > 0 && montantVerse && (
                <div className="text-sm p-3 rounded-lg border w-full" style={{ borderColor: docColor, background: 'var(--bg-alt)' }}>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>{T('total_facture')}</span>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{total.toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} DA</span>
                  </div>
                  <div className="flex justify-between mt-1 font-bold" style={{ color: docColor }}>
                    <span>{T('total_verse')}</span>
                    <span>{parseFloat(montantVerse || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} DA</span>
                  </div>
                  {solde > 0 && (
                    <div className="flex justify-between mt-1 text-orange-600">
                      <span>{T('solde_restant')}</span>
                      <span>{solde.toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} DA</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="mt-4">
            <label className="form-label">{T('field_notes')}</label>
            <textarea className="form-input resize-none" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}
