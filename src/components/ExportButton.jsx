import { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileText, FileType } from 'lucide-react';

/**
 * ExportButton — dropdown with PDF (primary) and DOCX (secondary)
 * Props: onExport(format: 'pdf'|'docx'), loading: ''|'pdf'|'docx', color
 */
export default function ExportButton({ onExport, loading = '', color = '#0f2044', label = 'Exporter' }) {
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
        {loading === 'pdf' ? 'Export...' : `${label} PDF`}
      </button>

      {/* Chevron toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        disabled={busy}
        className="btn-primary rounded-l-none px-2"
        style={{ background: color }}
        title="Plus d'options"
      >
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="export-dropdown-menu">
          <button onClick={() => { setOpen(false); onExport('pdf'); }}>
            <FileText size={14} style={{ color: '#ef4444' }} /> Exporter en PDF
          </button>
          <button onClick={() => { setOpen(false); onExport('docx'); }}>
            <FileType size={14} style={{ color: '#3b82f6' }} />
            {loading === 'docx' ? 'Export...' : 'Exporter en DOCX'}
          </button>
        </div>
      )}
    </div>
  );
}
