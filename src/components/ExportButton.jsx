import { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileText, FileType, Printer, Mail } from 'lucide-react';
import { useLang } from '../App';
import { t } from '../utils/i18n';
import { printDocument } from '../utils/printPdf';
import { composeEmail } from '../utils/email';

/**
 * ExportButton — dropdown with PDF (primary), DOCX (secondary), Print, and Email
 * Props: onExport(format: 'pdf'|'docx'), loading, color, htmlContent, T, client, docTitle, num, showToast
 */
export default function ExportButton({ onExport, loading = '', color = '#0f2044', htmlContent, T: TProp, client, docTitle, num, showToast }) {
  const { lang } = useLang();
  const T = TProp || ((k) => t(lang, k));
  const [open, setOpen] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function close(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const busy = !!loading || printLoading;

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
          {htmlContent && (
            <button onClick={() => { setOpen(false); setPrintLoading(true); printDocument(htmlContent); setTimeout(() => setPrintLoading(false), 500); }} disabled={busy}>
              <Printer size={14} style={{ color: '#10b981' }} />
              {T('btn_print')}
            </button>
          )}
          {client && (
            <button onClick={() => {
              const email = client.email || '';
              if (!email) { showToast(T('email_client_required'), 'error'); return; }
              composeEmail({
                to: email,
                subject: `${docTitle || 'Document'} N° ${num || ''}`,
                body: `Veuillez trouver ci-joint le document.`,
              });
            }}>
              <Mail size={14} style={{ color: '#8b5cf6' }} />
              {T('btn_email')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
