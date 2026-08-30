import { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileText, FileType } from 'lucide-react';
import { useLang } from '../App';
import { t } from '../utils/i18n';

/**
 * ExportButton — dropdown with PDF (primary) and DOCX (secondary)
 * Props: onExport(format: 'pdf'|'docx'), loading: ''|'pdf'|'docx', color
 */
export default function ExportButton({ onExport, loading = '', color = '#0f2044' }) {
  const { lang } = useLang();
  const T = (k) => t(lang, k);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function close(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const busy = !!loading;

  return (
    <div ref={ref} className="export-dropdown">
      {/* Main PDF button */}
      <button
        onClick={() => { setOpen(false); onExport('pdf'); }}
        disabled={busy}
        className="btn-primary rounded-r-none border-r border-white/20"
        style={{ background: color, minWidth: 120 }}
      >
        <Download size={15} />
        {loading === 'pdf' ? T('btn_exporting') : `${T('btn_export_pdf')}`}
      </button>

      {/* Chevron toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        disabled={busy}
        className="btn-primary rounded-l-none px-2"
        style={{ background: color }}
      >
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="export-dropdown-menu">
          <button onClick={() => { setOpen(false); onExport('pdf'); }}>
            <FileText size={14} style={{ color: '#ef4444' }} /> {T('btn_export_pdf')}
          </button>
          <button onClick={() => { setOpen(false); onExport('docx'); }}>
            <FileType size={14} style={{ color: '#3b82f6' }} />
            {loading === 'docx' ? T('btn_exporting') : T('btn_export_docx')}
          </button>
        </div>
      )}
    </div>
  );
}
