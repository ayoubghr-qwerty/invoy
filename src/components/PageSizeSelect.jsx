import { useLang } from '../App';
import { t } from '../utils/i18n';
import { PAGE_SIZES } from '../utils/helpers';

/**
 * A4 / A5 toggle button group.
 * Props: value ('A4'|'A5'), onChange fn, color string
 */
export default function PageSizeSelect({ value, onChange, color = '#0f2044' }) {
  const { lang } = useLang();
  const T = (k) => t(lang, k);

  return (
    <div>
      <label className="form-label">{T('field_taille_pdf')}</label>
      <div className="flex gap-2 mt-1">
        {PAGE_SIZES.map(s => (
          <button
            key={s}
            onClick={() => onChange(s)}
            className="flex-1 py-2 rounded-lg border text-sm font-bold transition-all"
            style={{
              background: value === s ? color : 'var(--bg-input)',
              color: value === s ? 'white' : 'var(--text-secondary)',
              borderColor: value === s ? color : 'var(--border-input)',
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
