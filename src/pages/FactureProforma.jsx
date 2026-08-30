import { useState, useEffect, useRef } from 'react';
import ArticlesTable from '../components/ArticlesTable';
import ClientSelect from '../components/ClientSelect';
import PhoneSection from '../components/PhoneSection';
import { numberToWordsFR } from '../utils/numberToWords';
import { buildFacturePdf } from '../utils/pdfTemplate';
import { useLang } from '../App';
import { t } from '../utils/i18n';
import ExportButton from '../components/ExportButton';
import { saveToHistory } from '../utils/history';
import { todayIso, saveClientIfNew } from '../utils/helpers';
import { validateDoc } from '../utils/validation';

export default function FactureProforma({ settings, showToast, pendingLoad, onLoadConsumed }) {
  const { lang } = useLang();
  const T = (k) => t(lang, k);

  const [clients, setClients] = useState([]);
  const [num, setNum] = useState('');
  const [date, setDate] = useState(todayIso());
  const [client, setClient] = useState({ nom: '', adresse: '', telephones: [''], agrement: '', nif: '', articlesImp: '', nis: '' });
  const [articles, setArticles] = useState([]);
  const [tvaEnabled, setTvaEnabled] = useState(false);
  const [tvaTaux, setTvaTaux] = useState(19);
  const [modeReglement, setModeReglement] = useState('espece');
  const [docTitle, setDocTitle] = useState('FACTURE PROFORMA');
  const [showArrete, setShowArrete] = useState(true);
  const [showModeReglement, setShowModeReglement] = useState(true);
  const [loading, setLoading] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);
  const autoNumRef = useRef('');

  useEffect(() => { loadData(); }, []);

  // Load from history if pendingLoad is set
  useEffect(() => {
    if (!pendingLoad) return;
    const d = pendingLoad;
    if (d.client)  setClient(d.client);
    if (d.articles) setArticles(d.articles);
    if (d.modeReglement) setModeReglement(d.modeReglement);
    if (d.docTitle) setDocTitle(d.docTitle);
    if (d.totaux) {
      if (d.totaux.tvaEnabled !== undefined) setTvaEnabled(d.totaux.tvaEnabled);
      if (d.totaux.tvaTaux)  setTvaTaux(d.totaux.tvaTaux);
    }
    if (d.showArrete !== undefined) setShowArrete(d.showArrete);
    if (d.showModeReglement !== undefined) setShowModeReglement(d.showModeReglement);
    if (d.date) setDate(d.date);
    if (d.numero) setNum(d.numero);
    onLoadConsumed?.();
    showToast(T('doc_loaded_from_history'));
  }, [pendingLoad]);

  async function loadData() {
    const list = await window.api.storeGet('clients', []);
    setClients(list || []);
    const counters = await window.api.storeGet('counters', {});
    const auto = String((counters.facture || 0) + 1).padStart(4, '0');
    autoNumRef.current = auto;
    setNum(auto);
  }

  function calcTimbre(base) {
    if (base < 300) return 0;
    const tranches = Math.ceil(base / 100);
    let t;
    if (base < 30000)       t = tranches * 1;
    else if (base < 100000) t = tranches * 1.5;
    else                    t = tranches * 2;
    return Math.max(5, t);
  }

  const ht    = articles.reduce((s, a) => s + (parseFloat(a.montant) || 0), 0);
  const tva   = tvaEnabled ? ht * (tvaTaux / 100) : 0;
  const htTva = ht + tva;
  const timbre = modeReglement === 'espece' ? calcTimbre(htTva) : 0;
  const ttc   = htTva + timbre;
  const totaux = { ht, tva, tvaEnabled, tvaTaux, timbre, timbreEnabled: modeReglement === 'espece', ttc };

  async function exportDoc(format) {
    const { valid, errors } = validateDoc({ client, articles, lang });
    if (!valid) {
      setValidationErrors(errors);
      showToast(errors[0], 'error');
      return;
    }
    setValidationErrors([]);
    const counters = await window.api.storeGet('counters', {});
    const newNum = (counters.facture || 0) + 1;
    const isManual = num.trim() !== autoNumRef.current;
    const finalNum = isManual ? num.trim() : String(newNum).padStart(4, '0');
    const docData = { client, articles, totaux, date, numero: finalNum, modeReglement, docTitle, showArrete, showModeReglement, settings };
    const safeName = docTitle.replace(/\s+/g, '-');
    const filePath = await window.api.saveDialog({
      defaultName: `${safeName}-${finalNum}.${format}`,
      filters: format === 'docx' ? [{ name: 'Word Document', extensions: ['docx'] }] : [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (!filePath) return;
    setLoading(format);
    try {
      let result;
      if (format === 'docx') {
        result = await window.api.exportDocx({ type: 'facture-proforma', data: docData, filePath });
      } else {
        result = await window.api.exportPdf({ htmlContent: buildFacturePdf(docData, settings), filePath });
      }
      if (result.success) {
        await saveClientIfNew(client);
        // Only increment counter if number was auto-generated
        if (!isManual) {
          await window.api.storeSet('counters', { ...counters, facture: newNum });
          const nextAuto = String(newNum + 1).padStart(4, '0');
          autoNumRef.current = nextAuto;
          setNum(nextAuto);
        }
        // Save to history
        await saveToHistory({ type: 'facture', numero: finalNum, date, client, articles, montant: ttc, totaux, modeReglement, docTitle, showArrete, showModeReglement });
        showToast(`${T('title_facture')} — ${T('exported_ok')} ${format.toUpperCase()} ${T('exported_success')}`);
      } else {
        showToast(`${T('export_error')}: ${result.error}`, 'error');
      }
    } finally { setLoading(''); }
  }

  const docColor = settings?.couleur || '#0f2044';

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{color:"var(--text-primary)"}}>{T('title_facture')}</h1>
          <p className="text-slate-500 text-sm mt-1">{T('sub_facture')}</p>
        </div>
        <div className="flex gap-2">
          {validationErrors.length > 0 && (
            <ul className="validation-errors list-disc list-inside">
              {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          <ExportButton onExport={exportDoc} loading={loading} color={docColor} htmlContent={buildFacturePdf({ client, articles, totaux, date, numero: num, modeReglement, docTitle, showArrete, showModeReglement, settings }, settings)} T={T} />
        </div>
      </div>

      <div className="space-y-6">
        {/* Document info */}
        <div className="card">
          <h2 className="section-title">{T('sec_doc_info')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">{T('field_doc_title')}</label>
              <div className="flex rounded-lg overflow-hidden border border-slate-200">
                {['FACTURE PROFORMA', 'FACTURE'].map(opt => (
                  <button key={opt} onClick={() => setDocTitle(opt)}
                    className="flex-1 py-2 text-xs font-bold transition-all"
                    style={{
                      background: docTitle === opt ? (settings?.couleur || '#0f2044') : 'var(--bg-input)',
                      color: docTitle === opt ? 'white' : 'var(--text-secondary)',
                      borderRight: opt === 'FACTURE PROFORMA' ? '1px solid var(--border-input)' : 'none',
                    }}>
                    {opt === 'FACTURE PROFORMA' ? T('doc_title_proforma') : T('doc_title_facture')}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="form-label">{T('field_numero_facture')}</label>
              <input className="form-input font-mono" value={num} onChange={e => setNum(e.target.value)} placeholder="0001" />
            </div>
            <div>
              <label className="form-label">{T('field_date')}</label>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative">
                  <input type="checkbox" checked={showArrete} onChange={e => setShowArrete(e.target.checked)} className="sr-only peer" />
                  <div className="w-10 h-5 rounded-full transition-colors peer-checked:bg-blue-600 bg-slate-300"></div>
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5"></div>
                </div>
                <span className="text-sm" style={{color:"var(--text-secondary)"}}>{T('show_arrete')}</span>
              </label>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative">
                  <input type="checkbox" checked={showModeReglement} onChange={e => setShowModeReglement(e.target.checked)} className="sr-only peer" />
                  <div className="w-10 h-5 rounded-full transition-colors peer-checked:bg-blue-600 bg-slate-300"></div>
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5"></div>
                </div>
                <span className="text-sm" style={{color:"var(--text-secondary)"}}>{T('show_mode_reglement')}</span>
              </label>
            </div>
          </div>
        </div>

        {/* Client */}
        <div className="card">
          <h2 className="section-title">{T('sec_client_info')}</h2>
          <ClientSelect clients={clients} value={client} onChange={setClient} />
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">{T('field_nom')}</label>
              <input className="form-input" value={client.nom} onChange={e => setClient(c => ({ ...c, nom: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">{T('field_adresse')}</label>
              <input className="form-input" value={client.adresse} onChange={e => setClient(c => ({ ...c, adresse: e.target.value }))} />
            </div>
            <PhoneSection phones={client.telephones || ['']} onChange={tt => setClient(c => ({ ...c, telephones: tt }))} />
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="form-label mb-3">{T('sec_client_fiscal')}</p>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="form-label">{T('field_agrement')}</label>
                <input className="form-input" value={client.agrement} onChange={e => setClient(c => ({ ...c, agrement: e.target.value }))} /></div>
              <div><label className="form-label">{T('field_nif')}</label>
                <input className="form-input" value={client.nif} onChange={e => setClient(c => ({ ...c, nif: e.target.value }))} /></div>
              <div><label className="form-label">{T('field_articles_imp')}</label>
                <input className="form-input" value={client.articlesImp} onChange={e => setClient(c => ({ ...c, articlesImp: e.target.value }))} /></div>
              <div><label className="form-label">{T('field_nis')}</label>
                <input className="form-input" value={client.nis} onChange={e => setClient(c => ({ ...c, nis: e.target.value }))} /></div>
            </div>
          </div>
        </div>

        {/* Articles */}
        <div className="card">
          <h2 className="section-title">{T('sec_articles')}</h2>
          <ArticlesTable articles={articles} onChange={setArticles} showNum={true} />
        </div>

        {/* Totaux */}
        <div className="card">
          <h2 className="section-title">{T('sec_totaux')}</h2>
          <div className="flex flex-col items-end gap-3 mt-2">
            <div className="w-80 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">{T('total_ht')}</span>
                <span className="font-semibold">{ht.toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} DA</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="tva" checked={tvaEnabled} onChange={e => setTvaEnabled(e.target.checked)} className="w-4 h-4 cursor-pointer" />
                <label htmlFor="tva" className="text-sm text-slate-700 cursor-pointer flex-1">{T('total_tva')}</label>
                {tvaEnabled && (
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" max="100" step="0.5" className="form-input w-16 text-right py-1 text-sm" value={tvaTaux} onChange={e => setTvaTaux(e.target.value)} />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                )}
                {tvaEnabled && <span className="text-sm font-medium w-32 text-right">{tva.toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} DA</span>}
              </div>
              {modeReglement === 'espece' && timbre > 0 && (
                <div className="flex justify-between text-sm items-center">
                  <span className="text-slate-600 flex items-center gap-1">
                    {T('total_timbre')}
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-alt)', color: 'var(--text-muted)' }}>auto</span>
                  </span>
                  <span className="font-medium">{timbre.toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} DA</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t-2" style={{ borderColor: docColor }}>
                <span className="font-bold text-sm ttc-label" style={{ color: docColor }}>{T('total_ttc')}</span>
                <span className="font-bold text-base ttc-label" style={{ color: docColor }}>{ttc.toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} DA</span>
              </div>
            </div>

            {ttc > 0 && (
              <div className="w-full mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-xs text-blue-700 font-medium">{T('arrete_phrase')}</p>
                <p className="text-sm font-bold text-blue-900 mt-1 capitalize">{numberToWordsFR(ttc)}</p>
              </div>
            )}

            {showModeReglement && (
            <div className="w-full mt-2 p-4 border border-slate-200 rounded-lg bg-slate-50">
              <p className="form-label mb-2">{T('mode_reglement')}</p>
              <div className="flex gap-4">
                {[{ value: 'espece', labelKey: 'mode_espece' }, { value: 'cheque', labelKey: 'mode_cheque' }].map(({ value, labelKey }) => (
                  <label key={value} className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="radio" name="modeReglement" value={value} checked={modeReglement === value}
                      onChange={() => setModeReglement(value)} className="w-4 h-4 cursor-pointer" style={{ accentColor: docColor }} />
                    <span className="text-sm font-medium text-slate-700">{T(labelKey)}</span>
                  </label>
                ))}
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
