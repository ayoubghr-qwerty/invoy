import { Plus, X } from 'lucide-react';
import { useLang } from '../App';
import { t } from '../utils/i18n';

/**
 * Reusable phone number list editor.
 * Props: phones (string[]), onChange (fn(newPhones))
 */
export default function PhoneSection({ phones = [''], onChange }) {
  const { lang } = useLang();
  const T = (k) => t(lang, k);

  function update(i, val) {
    const next = [...phones];
    next[i] = val;
    onChange(next);
  }

  function remove(i) {
    onChange(phones.filter((_, idx) => idx !== i));
  }

  function add() {
    onChange([...phones, '']);
  }

  return (
    <div>
      <label className="form-label">{T('field_telephones')}</label>
      <div className="space-y-2">
        {phones.map((p, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="form-input flex-1"
              value={p}
              onChange={e => update(i, e.target.value)}
              placeholder="Ex: +213 58 123 456"
            />
            {phones.length > 1 && (
              <button onClick={() => remove(i)} className="btn-danger p-2">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        <button onClick={add} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
          <Plus size={13} /> {T('btn_add_phone')}
        </button>
      </div>
    </div>
  );
}
