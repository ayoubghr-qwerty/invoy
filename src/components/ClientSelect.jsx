import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useLang } from '../App';
import { t } from '../utils/i18n';

export default function ClientSelect({ clients = [], value = {}, onChange }) {
  const { lang } = useLang();
  const T = (k) => t(lang, k);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      // Show first 8 clients when field is focused but empty
      setFiltered(open ? clients.slice(0, 8) : []);
      return;
    }
    setFiltered(
      clients
        .filter(c =>
          (c.nom || '').toLowerCase().includes(q) ||
          (c.adresse || '').toLowerCase().includes(q) ||
          (c.telephones || []).some(p => p.includes(q))
        )
        .slice(0, 20)
    );
  }, [search, clients, open]);

  useEffect(() => {
    function handleClickOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectClient(c) {
    // normalize telephones
    const norm = { ...c };
    if (!norm.telephones) norm.telephones = norm.telephone ? [norm.telephone] : [''];
    onChange(norm);
    setSearch(c.nom || '');
    setOpen(false);
  }

  function clearClient() {
    onChange({ nom: '', adresse: '', telephones: [''], agrement: '', nif: '', articlesImp: '', nis: '' });
    setSearch('');
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          type="text"
          className="form-input pr-8"
          placeholder={T('search_client')}
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {(value.nom || search) && (
          <button
            onClick={clearClient}
            className="absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            style={{ right: lang === 'ar' ? 'auto' : '0.5rem', left: lang === 'ar' ? '0.5rem' : 'auto' }}
          >
            <X size={14} />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 rounded-lg shadow-xl max-h-52 overflow-y-auto" style={{background:"var(--bg-card)",border:"1px solid var(--border-input)"}}>
          {filtered.map((c, i) => (
            <button
              key={i}
              onClick={() => selectClient(c)}
              className="w-full text-left px-4 py-2.5 transition-colors border-b last:border-0" style={{borderColor:"var(--border-color)"}} onMouseEnter={e=>e.currentTarget.style.background="var(--bg-hover)"} onMouseLeave={e=>e.currentTarget.style.background=""}
            >
              <div className="font-medium text-sm" style={{color:"var(--text-primary)"}}>{c.nom}</div>
              {c.adresse && <div className="text-xs" style={{color:"var(--text-muted)"}}>{c.adresse}</div>}
              {(c.telephones?.filter(Boolean).join(' / ') || c.telephone) && (
                <div className="text-xs text-slate-400">{c.telephones?.filter(Boolean).join(' / ') || c.telephone}</div>
              )}
            </button>
          ))}
        </div>
      )}
      {value.nom && search === value.nom && (
        <p className="text-xs text-green-600 mt-1">{T('client_selected')}</p>
      )}
    </div>
  );
}
