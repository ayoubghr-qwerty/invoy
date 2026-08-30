import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Save, Users, X, FileSpreadsheet, ChevronDown, Clock, Receipt, ArrowLeft } from 'lucide-react';
import { useLang } from '../App';
import { t } from '../utils/i18n';
import { getClientHistory } from '../utils/history';
import EmptyState from '../components/EmptyState';

const EMPTY_CLIENT = { nom: '', adresse: '', telephones: [''], agrement: '', nif: '', articlesImp: '', nis: '' };

function normalizeClient(c) {
  if (!c.telephones) return { ...c, telephones: c.telephone ? [c.telephone] : [''], articlesImp: c.articlesImp || '' };
  return { ...c, articlesImp: c.articlesImp || '' };
}

export default function Clients({ settings, showToast, onLoadFromHistory }) {
  const { lang } = useLang();
  const T = (k) => t(lang, k);

  const [view, setView]             = useState('list');
  const [clients, setClients]       = useState([]);
  const [editIdx, setEditIdx]       = useState(null);
  const [form, setForm]             = useState(EMPTY_CLIENT);
  const [activeTab, setActiveTab]   = useState('info');
  const [clientHistory, setClientHistory] = useState([]);
  const [histDetail, setHistDetail] = useState(null);
  const [search, setSearch]         = useState('');
  const [saving, setSaving]         = useState(false);

  const [xlsModal, setXlsModal]         = useState(false);
  const [xlsData, setXlsData]           = useState(null);
  const [xlsLoading, setXlsLoading]     = useState(false);
  const [mapNom, setMapNom]             = useState('');
  const [mapAdresse, setMapAdresse]     = useState('');
  const [mapTel, setMapTel]             = useState('');
  const [xlsImporting, setXlsImporting] = useState(false);

  useEffect(() => { loadClients(); }, []);

  async function loadClients() {
    const list = await window.api.storeGet('clients', []);
    setClients((list || []).map(normalizeClient));
  }

  async function saveClients(list) {
    await window.api.storeSet('clients', list);
    setClients(list);
  }

  async function openDetail(idx, initialTab) {
    setForm(normalizeClient({ ...clients[idx] }));
    setEditIdx(idx);
    setActiveTab(initialTab || 'info');
    setClientHistory([]);
    setView('detail');
    const hist = await getClientHistory(clients[idx].nom);
    setClientHistory(hist);
  }

  function openNew() {
    setForm({ ...EMPTY_CLIENT, telephones: [''] });
    setEditIdx(null);
    setActiveTab('info');
    setClientHistory([]);
    setView('detail');
  }

  function goBack() {
    setView('list');
    setHistDetail(null);
  }

  async function saveClient() {
    if (!form.nom.trim()) { showToast(T('client_name_required'), 'error'); return; }
    setSaving(true);
    try {
      const clean = { ...form, telephones: form.telephones.filter(p => p.trim()) };
      const updated = editIdx === null
        ? [...clients, { ...clean, id: Date.now() }]
        : clients.map((c, i) => i === editIdx ? { ...clean } : c);
      await saveClients(updated);
      showToast(editIdx === null ? T('client_added') : T('client_edited'));
      if (editIdx === null) goBack();
    } finally { setSaving(false); }
  }

  async function deleteClient(idx) {
    if (!confirm(`${T('confirm_delete_client')} "${clients[idx].nom}" ?`)) return;
    await saveClients(clients.filter((_, i) => i !== idx));
    showToast(T('client_deleted'));
    if (view === 'detail') goBack();
  }

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }
  function setPhone(i, val) { const t2 = [...form.telephones]; t2[i] = val; set('telephones', t2); }
  function addPhone() { set('telephones', [...form.telephones, '']); }
  function removePhone(i) { set('telephones', form.telephones.filter((_, idx) => idx !== i)); }

  async function openXlsModal() {
    setXlsLoading(true); setXlsData(null);
    setMapNom(''); setMapAdresse(''); setMapTel('');
    setXlsModal(true);
    try {
      const result = await window.api.readExcel();
      if (!result) { setXlsModal(false); return; }
      if (result.error) {         showToast(T('xls_read_error') + result.error, 'error'); setXlsModal(false); return; }
      setXlsData(result);
      result.headers.forEach(h => {
        const hl = h.toLowerCase();
        if (!mapNom     && (hl.includes('nom') || hl.includes('name') || hl.includes('client'))) setMapNom(h);
        if (!mapAdresse && (hl.includes('adresse') || hl.includes('address') || hl.includes('adr'))) setMapAdresse(h);
        if (!mapTel     && (hl.includes('tel') || hl.includes('phone') || hl.includes('mob'))) setMapTel(h);
      });
    } catch (e) { showToast(T('xls_read_error') + e.message, 'error'); setXlsModal(false);
    } finally { setXlsLoading(false); }
  }

  async function doImport() {
    if (!mapNom) { showToast(T('xls_choose_column'), 'error'); return; }
    setXlsImporting(true);
    try {
      const { headers, data } = xlsData;
      const nomIdx = headers.indexOf(mapNom);
      const adrIdx = mapAdresse ? headers.indexOf(mapAdresse) : -1;
      const telIdx = mapTel ? headers.indexOf(mapTel) : -1;
      const newC = data.map(row => ({
        id: Date.now() + Math.random(), nom: nomIdx >= 0 ? row[nomIdx] : '',
        adresse: adrIdx >= 0 ? row[adrIdx] : '',
        telephones: telIdx >= 0 && row[telIdx] ? [row[telIdx]] : [''],
        agrement: '', nif: '', articlesImp: '', nis: '',
      })).filter(c => c.nom.trim());
      if (!newC.length) { showToast(T('xls_no_valid'), 'error'); return; }
      await saveClients([...clients, ...newC]);
      setXlsModal(false);
      showToast(`${newC.length} ${T('xls_imported_count')}`);
    } catch (e) {       showToast(T('xls_read_error') + e.message, 'error');
    } finally { setXlsImporting(false); }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      (c.nom||'').toLowerCase().includes(q) ||
      (c.adresse||'').toLowerCase().includes(q) ||
      (c.telephones||[]).some(p => p.includes(q))
    );
  }, [clients, search]);

  const primary = settings?.couleurApp || '#0f2044';

  const ColSelect = ({ value, onChange, label, required }) => (
    <div>
      <label className="form-label">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
      <div className="relative">
        <select className="form-input w-full appearance-none pr-8" value={value} onChange={e => onChange(e.target.value)}>
          <option value="">{T('col_select_ignore')}</option>
          {xlsData?.headers.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );

  // ═══════════════ DETAIL PAGE ═══════════════
  if (view === 'detail') {
    return (
      <div className="p-8 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
              <button onClick={goBack}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border transition-colors hover:bg-slate-50"
                style={{color:'var(--text-secondary)',borderColor:'var(--border-color)'}}>
                <ArrowLeft size={16}/> {T('btn_back')}
              </button>
            <div>
              <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>
                {editIdx === null ? T('new_client') : form.nom || T('edit_client')}
              </h1>
              {editIdx !== null && (
                <p className="text-sm mt-0.5" style={{color:'var(--text-muted)'}}>
                  {clientHistory.length} {T('history_count')}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
                {editIdx !== null && (
                  <button onClick={() => deleteClient(editIdx)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                    style={{color:'var(--text-secondary)',borderColor:'var(--border-color)'}}>
                    <Trash2 size={15}/> {T('delete')}
                  </button>
                )}
                {activeTab === 'info' && (
                  <button onClick={saveClient} disabled={saving} className="btn-primary">
                    <Save size={15}/> {saving ? T('btn_saving') : T('btn_save')}
                  </button>
                )}
          </div>
        </div>

        <div className="flex border-b mb-6" style={{borderColor:'var(--border-color)'}}>
          {[
            { id: 'info', label: T('tab_info'), icon: <Save size={14}/> },
            ...(editIdx !== null ? [{ id: 'historique', label: `${T('tab_history')} (${clientHistory.length})`, icon: <Clock size={14}/> }] : []),
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors"
              style={{
                borderColor: activeTab === tab.id ? primary : 'transparent',
                color: activeTab === tab.id ? primary : 'var(--text-secondary)',
              }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'info' && (
          <div className="space-y-6">
            <div className="card">
              <p className="section-title">{T('sec_coord_gen')}</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="form-label">{T('field_nom_required')}</label>
                  <input className="form-input" value={form.nom} onChange={e => set('nom', e.target.value)} autoFocus />
                </div>
                <div className="col-span-2">
                  <label className="form-label">{T('field_adresse')}</label>
                  <input className="form-input" value={form.adresse} onChange={e => set('adresse', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="form-label">{T('field_telephones')}</label>
                  <div className="space-y-2">
                    {form.telephones.map((p, i) => (
                      <div key={i} className="flex gap-2">
                        <input className="form-input flex-1" value={p} onChange={e => setPhone(i, e.target.value)} placeholder={`${T('field_telephone')} ${i+1}`}/>
                        {form.telephones.length > 1 && <button onClick={() => removePhone(i)} className="btn-danger p-2"><Trash2 size={14}/></button>}
                      </div>
                    ))}
                    <button onClick={addPhone} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                      <Plus size={13}/> {T('btn_add_phone')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="card">
              <p className="section-title">{T('sec_coord_fisc')}</p>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="form-label">{T('field_agrement')}</label><input className="form-input" value={form.agrement} onChange={e => set('agrement', e.target.value)}/></div>
                <div><label className="form-label">{T('field_nif')}</label><input className="form-input" value={form.nif} onChange={e => set('nif', e.target.value)}/></div>
                <div><label className="form-label">{T('field_articles_imp')}</label><input className="form-input" value={form.articlesImp} onChange={e => set('articlesImp', e.target.value)}/></div>
                <div><label className="form-label">{T('field_nis')}</label><input className="form-input" value={form.nis} onChange={e => set('nis', e.target.value)}/></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'historique' && (
          <div>
            {clientHistory.length === 0 ? (
              <div className="card">
                <EmptyState icon={Receipt} title={T('empty_history_title')} subtitle={T('empty_history_subtitle')} />
              </div>
            ) : (
              <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{background:'var(--bg-alt)',borderBottom:'1px solid var(--border-color)'}}>
                      <th className="px-4 py-3 text-left font-semibold" style={{color:'var(--text-secondary)'}}>Type</th>
                      <th className="px-4 py-3 text-left font-semibold" style={{color:'var(--text-secondary)'}}>N°</th>
                      <th className="px-4 py-3 text-left font-semibold" style={{color:'var(--text-secondary)'}}>Date</th>
                      <th className="px-4 py-3 text-left font-semibold" style={{color:'var(--text-secondary)'}}>Articles</th>
                      <th className="px-4 py-3 text-right font-semibold" style={{color:'var(--text-secondary)'}}>{T('col_ht')}</th>
                      <th className="px-4 py-3 text-right font-semibold" style={{color:'var(--text-secondary)'}}>{T('col_tva')}</th>
                      <th className="px-4 py-3 text-right font-semibold" style={{color:'var(--text-secondary)'}}>{T('col_ttc')}</th>
                      <th className="px-3 py-3 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientHistory.map((h, i) => {
                      const typeLabel = h.type === 'facture' ? T('type_facture_label') : h.type === 'livraison' ? T('type_bon_livraison_label') : T('type_bon_versement_label');
                      const typeColor = h.type === 'facture' ? '#3b82f6' : h.type === 'livraison' ? '#10b981' : '#f59e0b';
                      const ht = h.totaux?.ht ?? (h.articles||[]).reduce((s,a)=>s+(parseFloat(a.montant)||0),0);
                      const tva = h.totaux?.tvaEnabled ? (h.totaux?.tva||0) : 0;
                      const articleCount = (h.articles||[]).length;
                      return (
                        <tr key={h.id} className={i%2===1?'table-row-alt':''} style={{borderBottom:'1px solid var(--border-color)'}}>
                          <td className="px-4 py-2.5">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{background:typeColor}}>{typeLabel}</span>
                          </td>
                          <td className="px-4 py-2.5 font-mono font-semibold" style={{color:'var(--text-primary)'}}>N° {h.numero}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap" style={{color:'var(--text-secondary)'}}>{new Date(h.date).toLocaleDateString('fr-DZ')}</td>
                          <td className="px-4 py-2.5 text-xs" style={{color:'var(--text-muted)'}}>{articleCount} {T('field_articles')} {articleCount>1?'s':''}</td>
                          <td className="px-4 py-2.5 text-right text-xs" style={{color:'var(--text-secondary)'}}>{ht.toLocaleString('fr-DZ',{minimumFractionDigits:2})}</td>
                          <td className="px-4 py-2.5 text-right text-xs" style={{color:tva>0?'#f59e0b':'var(--text-muted)'}}>{tva>0?tva.toLocaleString('fr-DZ',{minimumFractionDigits:2}):'—'}</td>
                          <td className="px-4 py-2.5 text-right font-bold" style={{color:primary}}>{(h.montant||0).toLocaleString('fr-DZ',{minimumFractionDigits:2})}</td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => setHistDetail(h)}
                              className="text-xs px-2 py-1 rounded-lg border transition-colors hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300"
                              style={{color:'var(--text-secondary)',borderColor:'var(--border-color)'}}>
                              {T('detail_label')}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {histDetail && createPortal((() => {
          const typeLabel = histDetail.type==='facture'?T('type_facture_label'):histDetail.type==='livraison'?T('type_bon_livraison_label'):T('type_bon_versement_label');
          const typeColor = histDetail.type==='facture'?'#3b82f6':histDetail.type==='livraison'?'#10b981':'#f59e0b';
          return (
            <div style={{position:"fixed",top:0,left:0,width:"100vw",height:"100vh",zIndex:60,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px",background:"rgba(0,0,0,0.5)",backdropFilter:"blur(3px)"}}>
              <div className="rounded-2xl shadow-2xl w-full max-w-5xl mx-auto overflow-hidden flex flex-col" style={{maxHeight:'88vh',background:'var(--bg-card)',border:'1px solid var(--border-color)'}}>
                <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{background:typeColor}}>
                  <div>
                    <h2 className="text-white font-bold text-lg">{typeLabel} — N° {histDetail.numero}</h2>
                    <p className="text-white/75 text-sm">{histDetail.clientNom} · {new Date(histDetail.date).toLocaleDateString('fr-DZ')}</p>
                  </div>
                  <button onClick={() => setHistDetail(null)} className="text-white/70 hover:text-white"><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  <div className="rounded-xl p-4" style={{background:'var(--bg-alt)',border:'1px solid var(--border-color)'}}>
                    <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{color:'var(--text-muted)'}}>{T('sec_client_info')}</p>
                    <p className="font-semibold" style={{color:'var(--text-primary)'}}>{histDetail.clientNom}</p>
                    {histDetail.client?.adresse && <p className="text-sm" style={{color:'var(--text-secondary)'}}>{histDetail.client.adresse}</p>}
                    {(histDetail.client?.telephones||[]).filter(Boolean).length > 0 && (
                      <p className="text-sm" style={{color:'var(--text-secondary)'}}>{histDetail.client.telephones.filter(Boolean).join(' / ')}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{color:'var(--text-muted)'}}>{T('sec_articles')}</p>
                    <div className="rounded-xl overflow-hidden border" style={{borderColor:'var(--border-color)'}}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{background:'var(--bg-alt)'}}>
                            <th className="px-3 py-2 text-left font-semibold" style={{color:'var(--text-secondary)'}}>{T('col_designation')}</th>
                            <th className="px-3 py-2 text-center font-semibold w-20" style={{color:'var(--text-secondary)'}}>{T('col_quantite')}</th>
                            <th className="px-3 py-2 text-right font-semibold w-28" style={{color:'var(--text-secondary)'}}>{T('col_prix_unit')}</th>
                            <th className="px-3 py-2 text-right font-semibold w-28" style={{color:'var(--text-secondary)'}}>{T('col_montant')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(histDetail.articles||[]).map((a,i) => (
                            <tr key={i} className={i%2===1?'table-row-alt':''} style={{borderTop:'1px solid var(--border-color)'}}>
                              <td className="px-3 py-2" style={{color:'var(--text-primary)'}}>{a.designation||'—'}</td>
                              <td className="px-3 py-2 text-center" style={{color:'var(--text-secondary)'}}>{a.quantite||0}</td>
                              <td className="px-3 py-2 text-right" style={{color:'var(--text-secondary)'}}>{(parseFloat(a.prixUnitaire)||0).toLocaleString('fr-DZ',{minimumFractionDigits:2})}</td>
                              <td className="px-3 py-2 text-right font-medium" style={{color:'var(--text-primary)'}}>{(parseFloat(a.montant)||0).toLocaleString('fr-DZ',{minimumFractionDigits:2})}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="flex gap-4 items-start flex-wrap">
                    <div className="flex-1 rounded-xl overflow-hidden border min-w-[240px]" style={{borderColor:'var(--border-color)'}}>
                          <div className="px-3 py-2 text-xs font-bold uppercase tracking-wide" style={{background:'var(--bg-alt)',color:'var(--text-muted)',borderBottom:'1px solid var(--border-color)'}}>{T('recap_label')}</div>
                      <div className="flex justify-between px-4 py-2 border-b" style={{borderColor:'var(--border-color)'}}>
                        <span className="text-sm" style={{color:'var(--text-secondary)'}}>{T('total_ht')}</span>
                        <span className="font-medium" style={{color:'var(--text-primary)'}}>
                          {((histDetail.totaux?.ht)??(histDetail.articles||[]).reduce((s,a)=>s+(parseFloat(a.montant)||0),0)).toLocaleString('fr-DZ',{minimumFractionDigits:2})} DA
                        </span>
                      </div>
                      {histDetail.totaux?.tvaEnabled && (
                        <div className="flex justify-between px-4 py-2 border-b" style={{borderColor:'var(--border-color)',background:'#fffbeb'}}>
                          <span className="text-sm font-medium" style={{color:'#b45309'}}>{T('tva_label')} ({histDetail.totaux.tvaTaux}%)</span>
                          <span className="font-semibold" style={{color:'#b45309'}}>{(histDetail.totaux.tva||0).toLocaleString('fr-DZ',{minimumFractionDigits:2})} DA</span>
                        </div>
                      )}
                      {(histDetail.totaux?.timbre>0) && (
                        <div className="flex justify-between px-4 py-2 border-b" style={{borderColor:'var(--border-color)'}}>
                          <span className="text-sm" style={{color:'var(--text-secondary)'}}>{T('droit_timbre')}</span>
                          <span className="font-medium" style={{color:'var(--text-primary)'}}>{histDetail.totaux.timbre.toLocaleString('fr-DZ',{minimumFractionDigits:2})} DA</span>
                        </div>
                      )}
                      <div className="flex justify-between px-4 py-3" style={{background:typeColor+'18'}}>
                        <span className="font-bold text-sm" style={{color:typeColor}}>{T('total_ttc')}</span>
                        <span className="font-bold text-base" style={{color:typeColor}}>{(histDetail.montant||0).toLocaleString('fr-DZ',{minimumFractionDigits:2})} DA</span>
                      </div>
                      {histDetail.montantVerse!=null && (
                        <div className="flex justify-between px-4 py-2 border-t" style={{borderColor:'var(--border-color)'}}>
                          <span className="text-sm" style={{color:'var(--text-secondary)'}}>{T('montant_verse')}</span>
                          <span className="font-semibold" style={{color:'var(--text-primary)'}}>{(histDetail.montantVerse||0).toLocaleString('fr-DZ',{minimumFractionDigits:2})} DA</span>
                        </div>
                      )}
                    </div>
                    {(histDetail.modeReglement||histDetail.notes||histDetail.pageSize) && (
                      <div className="flex flex-col gap-2 min-w-[180px]">
                        {histDetail.modeReglement && (
                          <div className="rounded-lg px-3 py-2 text-sm" style={{background:'var(--bg-alt)',border:'1px solid var(--border-color)'}}>
                            <span style={{color:'var(--text-muted)'}}>{T('mode_reglement')} : </span>
                            <span className="font-medium" style={{color:'var(--text-primary)'}}>{histDetail.modeReglement==='cheque'?T('mode_cheque'):T('mode_espece')}</span>
                          </div>
                        )}
                        {histDetail.pageSize && (
                          <div className="rounded-lg px-3 py-2 text-sm" style={{background:'var(--bg-alt)',border:'1px solid var(--border-color)'}}>
                            <span style={{color:'var(--text-muted)'}}>{T('format_label')}</span>
                            <span className="font-medium" style={{color:'var(--text-primary)'}}>{histDetail.pageSize}</span>
                          </div>
                        )}
                        {histDetail.notes && (
                          <div className="rounded-lg px-3 py-2 text-sm" style={{background:'var(--bg-alt)',border:'1px solid var(--border-color)'}}>
                            <span style={{color:'var(--text-muted)'}}>{T('notes_label')}</span>
                            <span style={{color:'var(--text-primary)'}}>{histDetail.notes}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center gap-3 px-6 py-4 border-t flex-shrink-0" style={{background:'var(--bg-alt)',borderColor:'var(--border-color)'}}>
                  <p className="text-xs" style={{color:'var(--text-muted)'}}>
                    {T('export_info')} {new Date(histDetail.createdAt).toLocaleDateString('fr-DZ')} {T('export_at')} {new Date(histDetail.createdAt).toLocaleTimeString('fr-DZ',{hour:'2-digit',minute:'2-digit'})}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setHistDetail(null)} className="btn-secondary">{T('close')}</button>
                    <button onClick={() => { setHistDetail(null); onLoadFromHistory?.(histDetail); }} className="btn-primary" style={{background:typeColor}}>
                      <Receipt size={14}/> {T('reload_history')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })(), document.body)}
      </div>
    );
  }

  // ═══════════════ LIST VIEW ═══════════════
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>{T('title_clients')}</h1>
          <p className="text-slate-500 text-sm mt-1">{clients.length} {clients.length!==1?T('sub_clients_plural'):T('sub_clients')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openXlsModal} className="btn-secondary"><FileSpreadsheet size={16}/> {T('btn_import_excel')}</button>
          <button onClick={openNew} className="btn-primary"><Plus size={16}/> {T('btn_new_client')}</button>
        </div>
      </div>

      {clients.length > 10 && (
        <div className="mb-4">
          <input className="form-input w-full max-w-sm" value={search} onChange={e => setSearch(e.target.value)} placeholder={T('search_client')}/>
        </div>
      )}

      {clients.length === 0 ? (
        <div className="card text-center py-16">
          <Users size={40} className="mx-auto text-slate-300 mb-4"/>
          <p className="text-slate-500 font-medium">{T('no_clients')}</p>
          <p className="text-slate-400 text-sm mt-1">{T('no_clients_sub')}</p>
          <div className="flex gap-3 justify-center mt-4">
            <button onClick={openXlsModal} className="btn-secondary"><FileSpreadsheet size={16}/> {T('btn_import_excel')}</button>
            <button onClick={openNew} className="btn-primary"><Plus size={16}/> {T('add_first_client')}</button>
          </div>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{background:primary}}>
                <th className="table-header text-left">{T('th_nom')}</th>
                <th className="table-header text-left">{T('th_adresse')}</th>
                <th className="table-header text-left">{T('th_telephones')}</th>
                <th className="table-header text-left">{T('th_nif')}</th>
                <th className="table-header text-left">{T('th_articles')}</th>
                <th className="table-header w-44 text-center">{T('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400 italic">{T('client_history_empty')} «&nbsp;{search}&nbsp;»</td></tr>
              )}
              {filtered.map((c, i) => (
                <tr key={c.id||i} className={`hover:bg-slate-50 cursor-pointer${i%2===1?' table-row-alt':''}`}
                  onClick={() => openDetail(clients.indexOf(c))}>
                  <td className="table-cell font-medium text-slate-800">{c.nom}</td>
                  <td className="table-cell text-slate-600">{c.adresse||'—'}</td>
                  <td className="table-cell text-slate-600">{(c.telephones||[]).filter(Boolean).join(' / ')||'—'}</td>
                  <td className="table-cell text-slate-500 font-mono text-xs">{c.nif||'—'}</td>
                  <td className="table-cell text-slate-500 font-mono text-xs">{c.articlesImp||'—'}</td>
                  <td className="table-cell text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openDetail(clients.indexOf(c), 'historique')}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200">
                        <Clock size={13}/> {T('btn_histo')}
                      </button>
                      <button onClick={() => deleteClient(clients.indexOf(c))}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-red-50 text-red-500 hover:bg-red-100 border border-red-200">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {xlsModal && (
        <div style={{position:"fixed",top:0,left:0,width:"100vw",height:"100vh",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px",background:"rgba(0,0,0,0.45)",backdropFilter:"blur(3px)"}}>
          <div className="rounded-2xl shadow-2xl w-full max-w-2xl mx-auto overflow-hidden flex flex-col" style={{maxHeight:'88vh',background:'var(--bg-card)',border:'1px solid var(--border-color)'}}>
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{background:primary}}>
              <h2 className="text-white font-bold text-lg flex items-center gap-2"><FileSpreadsheet size={18}/> {T('xls_import_title')}</h2>
              <button onClick={() => setXlsModal(false)} className="text-white/70 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-5">
              {xlsLoading && <div className="text-center py-8 text-slate-500">{T('xls_reading')}</div>}
              {!xlsLoading && !xlsData && <div className="text-center py-4 text-slate-400">{T('xls_no_file')}</div>}
              {!xlsLoading && xlsData && (
                <>
                  <div>
                    <p className="section-title mb-4">{T('xls_select_col')}</p>
                    <div className="space-y-3">
                      <ColSelect label={T('col_nom')} value={mapNom} onChange={setMapNom} required/>
                      <ColSelect label={T('col_adresse')} value={mapAdresse} onChange={setMapAdresse}/>
                      <ColSelect label={T('col_telephone')} value={mapTel} onChange={setMapTel}/>
                    </div>
                  </div>
                  <div>
                    <p className="section-title mb-3">{T('xls_preview_title')}</p>
                    <div className="overflow-x-auto rounded-lg border" style={{borderColor:'var(--border-color)'}}>
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{background:'var(--bg-alt)'}}>
                            {xlsData.headers.map(h => (
                              <th key={h} className="px-3 py-2 text-left font-semibold" style={{color:'var(--text-secondary)',borderBottom:'1px solid var(--border-color)'}}>
                                {h}
                                {h===mapNom && <span className="ml-1 text-blue-500">←Nom</span>}
                                {h===mapAdresse && <span className="ml-1 text-green-500">←{T('col_adresse')}</span>}
                                {h===mapTel && <span className="ml-1 text-orange-500">←{T('field_telephone')}</span>}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {xlsData.preview.map((row,ri) => (
                            <tr key={ri} className={ri%2===1?'table-row-alt':''}>
                              {row.map((cell,ci) => (
                                <td key={ci} className="px-3 py-1.5" style={{color:'var(--text-primary)',borderBottom:'1px solid var(--border-color)'}}>{cell||'—'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">{xlsData.data.length} {T('xls_total_rows')}</p>
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t flex-shrink-0" style={{background:'var(--bg-alt)',borderColor:'var(--border-color)'}}>
              <button onClick={() => setXlsModal(false)} className="btn-secondary">{T('btn_cancel')}</button>
              {xlsData && (
                  <button onClick={doImport} disabled={!mapNom||xlsImporting} className="btn-primary">
                    <FileSpreadsheet size={14}/> {xlsImporting?T('xls_importing'):`${T('xls_import_count_prefix')}${xlsData.data.length}${T('xls_import_count_suffix')}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
