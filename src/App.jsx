import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { Users, Truck, Package, CreditCard, Settings, Sun, Moon, ShoppingCart, LayoutList } from 'lucide-react';
import { t } from './utils/i18n';

import FactureProforma from './pages/FactureProforma';
import Clients from './pages/Clients';
import ProgrammeLivraison from './pages/ProgrammeLivraison';
import BonLivraison from './pages/BonLivraison';
import BonVersement from './pages/BonVersement';
import Parametres from './pages/Parametres';
import Marchandise from './pages/Marchandise';
import Produits from './pages/Produits';

function InvoiceIcon({ size = 28, color = 'white' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="2" width="19" height="25" rx="2" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.5"/>
      <rect x="7" y="7" width="10" height="1.6" rx="0.8" fill={color}/>
      <rect x="7" y="11" width="13" height="1.6" rx="0.8" fill={color}/>
      <rect x="7" y="15" width="9" height="1.6" rx="0.8" fill={color}/>
      <circle cx="24" cy="24" r="7" fill={color} fillOpacity="0.95"/>
      <text x="24" y="28" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#0f2044" fontFamily="Arial">DA</text>
    </svg>
  );
}

export const LangContext = createContext({ lang: 'fr', setLang: () => {} });
export function useLang() { return useContext(LangContext); }

export default function App() {
  const [page, setPage] = useState('facture');
  const [settings, setSettings] = useState(null);
  const [toast, setToast] = useState(null);
  const [lang, setLangState] = useState('fr');
  const [darkMode, setDarkModeState] = useState(false);
  const [pendingLoad, setPendingLoad] = useState(null); // { type, data } from history

  function loadFromHistory(histEntry) {
    // Map history type to page id
    const pageMap = { facture: 'facture', livraison: 'livraison', versement: 'versement' };
    const targetPage = pageMap[histEntry.type] || 'facture';
    setPendingLoad(histEntry);
    setPage(targetPage);
  }

  const loadSettings = useCallback(async () => {
    const s = await window.api.storeGet('settings', {});
    setSettings(s || {});
    if (s?.langue) setLangState(s.langue);
    const dm = await window.api.storeGet('darkMode', false);
    applyDark(dm);
    setDarkModeState(dm);
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  function applyDark(enabled) {
    document.documentElement.classList.toggle('dark', enabled);
  }

  async function toggleDark() {
    const next = !darkMode;
    setDarkModeState(next);
    applyDark(next);
    await window.api.storeSet('darkMode', next);
  }

  async function setLang(l) {
    setLangState(l);
    const current = await window.api.storeGet('settings', {});
    await window.api.storeSet('settings', { ...current, langue: l });
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const isRTL = lang === 'ar';
  const appColor = settings?.couleurApp || '#0f2044';

  const PAGES = [
    { id: 'facture',    icon: () => <InvoiceIcon size={18} />, key: 'nav_facture' },
    { id: 'clients',    icon: Users,      key: 'nav_clients' },
    { id: 'programme',  icon: Truck,      key: 'nav_programme' },
    { id: 'livraison',    icon: Package,      key: 'nav_livraison' },
    { id: 'versement',   icon: CreditCard,   key: 'nav_versement' },
    { id: 'marchandise', icon: ShoppingCart, key: 'nav_marchandise' },
    { id: 'produits',    icon: LayoutList,   key: 'nav_produits' },
    { id: 'parametres',  icon: Settings,     key: 'nav_parametres' },
  ];

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <div className={`flex h-screen overflow-hidden${isRTL ? ' rtl' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Sidebar */}
        <aside className="flex flex-col w-60 min-w-60 h-full flex-shrink-0" style={{ background: appColor }}>
          {/* Logo */}
          <div className="flex flex-col items-center px-4 py-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            {settings?.logo ? (
              <img src={settings.logo} alt="logo" className="w-14 h-14 object-contain rounded-lg mb-2" />
            ) : (
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-2" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <InvoiceIcon size={32} />
              </div>
            )}
            <span className="text-white font-bold text-sm text-center leading-tight">
              {settings?.organisation || 'Invoy'}
            </span>
            <span className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {settings?.proprietaire || ''}
            </span>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
            {PAGES.map(({ id, icon: Icon, key }) => {
              const isActive = page === id;
              return (
                <button key={id} onClick={() => setPage(id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
                    color: isActive ? 'white' : 'rgba(255,255,255,0.6)',
                    boxShadow: isActive ? 'inset 0 1px 0 rgba(255,255,255,0.15)' : 'none',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; } }}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-white opacity-80" />
                  )}
                  <Icon size={17} />
                  <span className={isRTL ? 'font-arabic' : ''}>{t(lang, key)}</span>
                </button>
              );
            })}
          </nav>

          {/* Bottom controls */}
          <div className="px-3 pb-2 space-y-2">
            {/* Dark mode toggle */}
            <button
              onClick={toggleDark}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)' }}
            >
              {darkMode
                ? <Sun size={14} />
                : <Moon size={14} />}
              <span style={{ fontSize: '12px' }}>{darkMode ? (lang === 'ar' ? 'وضع النهار' : 'Mode clair') : (lang === 'ar' ? 'وضع الليل' : 'Mode sombre')}</span>
            </button>

            {/* Language switcher */}
            <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
              {['fr', 'ar'].map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className="flex-1 py-1.5 text-xs font-bold transition-all"
                  style={{
                    background: lang === l ? 'rgba(255,255,255,0.2)' : 'transparent',
                    color: lang === l ? 'white' : 'rgba(255,255,255,0.45)',
                  }}>
                  {l === 'fr' ? 'FR' : 'عربي'}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 py-2 text-center" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>
            Invoy v2.0
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 h-full overflow-y-auto" style={{ background: 'var(--bg-app)' }}>
          {settings !== null && (
            <div key={page} className="page-enter">
              {page === 'facture'    && <FactureProforma settings={settings} showToast={showToast} pendingLoad={pendingLoad?.type==='facture' ? pendingLoad : null} onLoadConsumed={() => setPendingLoad(null)} />}
              {page === 'clients'    && <Clients         settings={settings} showToast={showToast} onLoadFromHistory={loadFromHistory} />}
              {page === 'programme'  && <ProgrammeLivraison settings={settings} showToast={showToast} />}
              {page === 'livraison'  && <BonLivraison    settings={settings} showToast={showToast} pendingLoad={pendingLoad?.type==='livraison' ? pendingLoad : null} onLoadConsumed={() => setPendingLoad(null)} />}
              {page === 'versement'  && <BonVersement    settings={settings} showToast={showToast} pendingLoad={pendingLoad?.type==='versement' ? pendingLoad : null} onLoadConsumed={() => setPendingLoad(null)} />}
              {page === 'marchandise'&& <Marchandise settings={settings} showToast={showToast} />}
              {page === 'produits'   && <Produits showToast={showToast} />}
              {page === 'parametres' && <Parametres      settings={settings} onSave={loadSettings} showToast={showToast} />}
            </div>
          )}
        </main>

        {/* Toast */}
        {toast && (
          <div className={`toast toast-${toast.type}`} style={{ left: isRTL ? '1.5rem' : 'auto', right: isRTL ? 'auto' : '1.5rem' }}>
            {toast.type === 'success' ? '✓' : '✗'} {toast.msg}
          </div>
        )}
      </div>
    </LangContext.Provider>
  );
}
