import { useState, useEffect } from 'react';
import { Plus, ChevronDown, X } from 'lucide-react';
import ArticlesTable from '../components/ArticlesTable';
import ClientSelect from '../components/ClientSelect';
import PageSizeSelect from '../components/PageSizeSelect';
import { buildProgrammePdf } from '../utils/pdfTemplate';
import { useLang } from '../App';
import { t } from '../utils/i18n';
import ExportButton from '../components/ExportButton';
import { todayIso } from '../utils/helpers';

const EMPTY_CLIENT = () => ({
  id: Date.now() + Math.random(),
  nom: '', telephone: '', adresse: '',
  horaireDE: '', horaireA: '',
  articles: [], collapsed: false,
});

export default function ProgrammeLivraison({ settings, showToast }) {
  const { lang } = useLang();
  const T = (k) => t(lang, k);

  const [date, setDate] = useState(todayIso());
  const [clients, setClients] = useState([EMPTY_CLIENT()]);
  const [savedClients, setSavedClients] = useState([]);
  const [pageSize, setPageSize] = useState('A4');
  const [loading, setLoading] = useState('');

  useEffect(() => { loadSavedClients(); }, []);

  async function loadSavedClients() {
    const list = await window.api.storeGet('clients', []);
    setSavedClients(list || []);
  }

  function updateClient(i, field, value) {
    setClients(cs => cs.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  }
  function addClient() { setClients(cs => [...cs, EMPTY_CLIENT()]); }
  function removeClient(i) { setClients(cs => cs.filter((_, idx) => idx !== i)); }
  function toggleCollapse(i) { setClients(cs => cs.map((c, idx) => idx === i ? { ...c, collapsed: !c.collapsed } : c)); }

  const grandTotal = clients.reduce((s, c) => s + (c.articles || []).reduce((ss, a) => ss + (parseFloat(a.montant) || 0), 0), 0);

  async function exportDoc(format) {
    if (!clients.some(c => c.articles.length > 0)) { showToast(T('add_article_client_error'), 'error'); return; }
    const counters = await window.api.storeGet('counters', {});
    const newNum = (counters.programme || 0) + 1;
    const docData = { date, clients: clients.filter(c => c.nom || c.articles.length), settings, pageSize };
    const filePath = await window.api.saveDialog({
      defaultName: `Programme-Livraison-${String(newNum).padStart(4,'0')}.${format}`,
      filters: format === 'docx' ? [{ name: 'Word Document', extensions: ['docx'] }] : [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (!filePath) return;
    setLoading(format);
    try {
      let result;
      if (format === 'docx') {
        result = await window.api.exportDocx({ type: 'programme-livraison', data: docData, filePath });
      } else {
        result = await window.api.exportPdf({
          htmlContent: buildProgrammePdf(docData, settings),
          filePath,
          pageSize,
        });
      }
      if (result.success) {
        await window.api.storeSet('counters', { ...counters, programme: newNum });
        showToast(`${T('title_programme')} — ${T('exported_ok')} ${format.toUpperCase()} ${T('exported_success')}`);
      } else { showToast(`${T('export_error')}: ${result.error}`, 'error'); }
    } finally { setLoading(''); }
  }

  const docColor = settings?.couleur || '#0f2044';

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{color:"var(--text-primary)"}}>{T('title_programme')}</h1>
          <p className="text-slate-500 text-sm mt-1">{T('sub_programme')}</p>
        </div>
        <div className="flex gap-2">
          <ExportButton onExport={exportDoc} loading={loading} color={docColor} />
        </div>
      </div>

      <div className="space-y-6">
        {/* Date + taille */}
        <div className="card">
          <h2 className="section-title">{T('sec_general_info')}</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="form-label">{T('field_date_livraison')}</label>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <PageSizeSelect value={pageSize} onChange={setPageSize} color={docColor} />
            </div>
          </div>
        </div>

        {/* Clients */}
        <div className="space-y-4">
          {clients.map((cl, i) => {
            const clTotal = (cl.articles || []).reduce((s, a) => s + (parseFloat(a.montant) || 0), 0);
            return (
              <div key={cl.id} className="card p-0 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 cursor-pointer select-none"
                  style={{ background: 'var(--bg-alt)', borderBottom: '1px solid var(--border-color)' }}
                  onClick={() => toggleCollapse(i)}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ background: docColor }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold" style={{color:"var(--text-primary)"}}>
                      {cl.nom || `${T('client_label')} ${i + 1}`}
                    </span>
                    {cl.adresse && <span className="text-xs text-slate-500 ml-2">— {cl.adresse}</span>}
                    {(cl.horaireDE || cl.horaireA) && (
                      <span className="text-xs text-slate-400 ml-2">⏱ {cl.horaireDE || '?'} → {cl.horaireA || '?'}</span>
                    )}
                  </div>
                  {clTotal > 0 && (
                    <span className="text-sm font-bold" style={{ color: docColor }}>
                      {clTotal.toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} DA
                    </span>
                  )}
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${cl.collapsed ? '-rotate-90' : ''}`} />
                  {clients.length > 1 && (
                    <button onClick={e => { e.stopPropagation(); removeClient(i); }} className="text-red-400 hover:text-red-600 ml-1 p-1">
                      <X size={16} />
                    </button>
                  )}
                </div>

                {!cl.collapsed && (
                  <div className="p-5">
                    <div className="flex gap-3 mb-5">
                      <div className="flex-1 flex flex-col gap-3">
                        <div>
                          <label className="form-label">{T('search_client')}</label>
                          <ClientSelect
                            clients={savedClients}
                            value={{ nom: cl.nom, adresse: cl.adresse }}
                            onChange={c => {
                              const norm = { ...c };
                              if (!norm.telephones) norm.telephones = norm.telephone ? [norm.telephone] : [''];
                              const phone = (norm.telephones || []).filter(Boolean).join(' / ') || norm.telephone || '';
                              setClients(cs => cs.map((x, idx) => idx === i ? { ...x, nom: norm.nom || '', adresse: norm.adresse || '', telephone: phone } : x));
                            }}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="form-label">{T('field_nom')}</label>
                            <input className="form-input" value={cl.nom} onChange={e => updateClient(i, 'nom', e.target.value)} />
                          </div>
                          <div>
                            <label className="form-label">{T('field_telephone')}</label>
                            <input className="form-input" value={cl.telephone} onChange={e => updateClient(i, 'telephone', e.target.value)} />
                          </div>
                          <div>
                            <label className="form-label">{T('field_adresse')}</label>
                            <input className="form-input" value={cl.adresse} onChange={e => updateClient(i, 'adresse', e.target.value)} />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-3" style={{ minWidth: '130px' }}>
                        <div>
                          <label className="form-label">{T('field_horaire_de')}</label>
                          <input type="time" className="form-input" value={cl.horaireDE || ''} onChange={e => updateClient(i, 'horaireDE', e.target.value)} />
                        </div>
                        <div>
                          <label className="form-label">{T('field_horaire_a')}</label>
                          <input type="time" className="form-input" value={cl.horaireA || ''} onChange={e => updateClient(i, 'horaireA', e.target.value)} />
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="section-title">{T('add_article_client')}</p>
                      <ArticlesTable articles={cl.articles} onChange={arts => updateClient(i, 'articles', arts)} showNum={true} />
                    </div>
                    {clTotal > 0 && (
                      <div className="flex justify-end mt-3">
                        <div className="px-5 py-2 rounded-lg text-white font-semibold text-sm" style={{ background: docColor }}>
                          {T('total_client')} : {clTotal.toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} DA
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={addClient}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border-2 border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors w-full justify-center">
          <Plus size={16} /> {T('btn_add_client')}
        </button>

        {clients.some(c => c.articles.length) && (
          <div className="card">
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{color:"var(--text-muted)"}}>
                {clients.filter(c => c.articles.length).length} {T('client_label').toLowerCase()}(s) —{' '}
                {clients.reduce((s, c) => s + c.articles.length, 0)} {T('articles_count')}(s)
              </span>
              <div className="px-6 py-2.5 rounded-lg text-white font-bold" style={{ background: docColor }}>
                {T('total_general')} : {grandTotal.toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} DA
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
