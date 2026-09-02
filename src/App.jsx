import {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
} from "react";
import {
  Users,
  Truck,
  Package,
  CreditCard,
  Settings,
  Sun,
  Moon,
  ShoppingCart,
  LayoutList,
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  Warehouse,
  ArrowUpDown,
  AlertTriangle,
  FileOutput,
} from "lucide-react";
import { t } from "./utils/i18n";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { KeyboardActionsProvider } from "./hooks/KeyboardActionsContext";
import { initDb } from "./utils/db";
import { migrateFromStore } from "./utils/migrate";
import { CompanyProvider } from "./context/CompanyContext";
import { getLowStock } from "./utils/stockStore";

import FactureProforma from "./pages/FactureProforma";
import Clients from "./pages/Clients";
import ProgrammeLivraison from "./pages/ProgrammeLivraison";
import BonLivraison from "./pages/BonLivraison";
import BonVersement from "./pages/BonVersement";
import Parametres from "./pages/Parametres";
import Marchandise from "./pages/Marchandise";
import Produits from "./pages/Produits";
import Stock from "./pages/Stock";
import StockMovements from "./pages/StockMovements";
import StockAlerts from "./pages/StockAlerts";
import PurchaseOrders from "./pages/PurchaseOrders";
import ErrorBoundary from "./components/ErrorBoundary";

export const LangContext = createContext({ lang: "fr", setLang: () => {} });
export function useLang() {
  return useContext(LangContext);
}

export default function App() {
  const [page, setPage] = useState("facture");
  const [settings, setSettings] = useState(null);
  const [lang, setLangState] = useState("fr");
  const [darkMode, setDarkModeState] = useState(false);
  const [pendingLoad, setPendingLoad] = useState(null); // { type, data } from history
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);
  const toastTimerRef = useRef(null);
  const toastElRef = useRef(null);
  const T = (k) => t(lang, k);

  function loadFromHistory(histEntry) {
    // Map history type to page id
    const pageMap = {
      facture: "facture",
      livraison: "livraison",
      versement: "versement",
    };
    const targetPage = pageMap[histEntry.type] || "facture";
    setPendingLoad(histEntry);
    setPage(targetPage);
  }

  const loadSettings = useCallback(async () => {
    const s = await window.api.storeGet("settings", {});
    setSettings(s || {});
    if (s?.langue) setLangState(s.langue);
    const dm = await window.api.storeGet("darkMode", false);
    applyDark(dm);
    setDarkModeState(dm);
    // Load low stock count for badge
    try {
      const low = await getLowStock();
      setLowStockCount(low.length);
    } catch {}
  }, []);

  useEffect(() => {
    initDb()
      .then(() => migrateFromStore())
      .then(() => loadSettings());
  }, [loadSettings]);

  // Refresh low stock count when navigating to stock pages
  useEffect(() => {
    if (page === "stock" || page === "stock-alerts") {
      getLowStock()
        .then((low) => setLowStockCount(low.length))
        .catch(() => {});
    }
  }, [page]);

  // Live badge refresh on any stock mutation (receive, marchandise, adjust)
  useEffect(() => {
    const onStockChanged = () => {
      getLowStock()
        .then((low) => setLowStockCount(low.length))
        .catch(() => {});
    };
    window.addEventListener("invoy:stock-changed", onStockChanged);
    return () =>
      window.removeEventListener("invoy:stock-changed", onStockChanged);
  }, []);

  function applyDark(enabled) {
    document.documentElement.classList.toggle("dark", enabled);
  }

  async function toggleDark() {
    const next = !darkMode;
    setDarkModeState(next);
    applyDark(next);
    await window.api.storeSet("darkMode", next);
  }

  async function setLang(l) {
    setLangState(l);
    const current = await window.api.storeGet("settings", {});
    await window.api.storeSet("settings", { ...current, langue: l });
  }

  function ErrorBoundaryWrapper({ children }) {
    const { lang } = useLang();
    return <ErrorBoundary lang={lang}>{children}</ErrorBoundary>;
  }

  function showToast(msg, type = "success") {
    clearTimeout(toastTimerRef.current);
    const el = toastElRef.current;
    if (!el) return;
    el.textContent = (type === "success" ? "✓ " : "✗ ") + msg;
    el.className = `toast toast-${type}`;
    el.style.left = isRTL ? "1.5rem" : "auto";
    el.style.right = isRTL ? "auto" : "1.5rem";
    el.style.display = "flex";
    toastTimerRef.current = setTimeout(() => {
      el.style.display = "none";
    }, 3500);
  }
  // Export for tauriApi.js browser fallback
  if (typeof window !== "undefined") window.__invoyShowToast = showToast;

  const isRTL = lang === "ar";
  const appColor = settings?.couleurApp || "#0f2044";

  const handleDarkToggle = useCallback(() => {
    toggleDark();
  }, [darkMode]);

  useKeyboardShortcuts({
    setPage,
    setDarkMode: handleDarkToggle,
    setLang,
    lang,
    showToast,
  });

  const PAGES = [
    { id: "facture", icon: FileText, key: "nav_facture" },
    { id: "clients", icon: Users, key: "nav_clients" },
    { id: "programme", icon: Truck, key: "nav_programme" },
    { id: "livraison", icon: Package, key: "nav_livraison" },
    { id: "versement", icon: CreditCard, key: "nav_versement" },
    { id: "marchandise", icon: ShoppingCart, key: "nav_marchandise" },
    { id: "produits", icon: LayoutList, key: "nav_produits" },
    { id: "stock", icon: Warehouse, key: "nav_stock" },
    { id: "stock-movements", icon: ArrowUpDown, key: "nav_movements" },
    {
      id: "stock-alerts",
      icon: AlertTriangle,
      key: "nav_alerts",
      badge: lowStockCount,
    },
    { id: "purchase-orders", icon: FileOutput, key: "nav_purchase_orders" },
    { id: "parametres", icon: Settings, key: "nav_parametres" },
  ];

  return (
    <CompanyProvider>
      <LangContext.Provider value={{ lang, setLang }}>
        <KeyboardActionsProvider>
          <div
            className={`flex h-screen overflow-hidden${isRTL ? " rtl" : ""}`}
            dir={isRTL ? "rtl" : "ltr"}
          >
            {/* Sidebar */}
            <aside
              className={`flex flex-col h-full flex-shrink-0 transition-[width] duration-300 ease-in-out overflow-hidden ${sidebarCollapsed ? "w-16 min-w-16" : "w-60 min-w-60"}`}
              style={{ background: appColor, overflowX: "hidden" }}
            >
              {/* Logo / Expand button */}
              <div
                className="flex-shrink-0 flex items-center justify-center border-b"
                style={{
                  borderColor: "rgba(255,255,255,0.1)",
                  height: sidebarCollapsed ? "80px" : "auto",
                  padding: sidebarCollapsed ? "12px 0" : "16px 16px",
                }}
              >
                {sidebarCollapsed ? (
                  <button
                    onClick={() => setSidebarCollapsed(false)}
                    className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-white/10 transition-colors"
                    style={{ color: "rgba(255,255,255,0.7)" }}
                  >
                    <ChevronRight size={20} />
                  </button>
                ) : (
                  <div className="relative w-full flex flex-col items-center">
                    {settings?.logo ? (
                      <img
                        src={settings.logo}
                        alt="logo"
                        className="w-14 h-14 object-contain rounded-lg"
                      />
                    ) : (
                      <img
                        src="/logo.png"
                        alt="Invoy"
                        className="w-14 h-14 object-contain rounded-lg"
                      />
                    )}
                    <span className="text-white font-bold text-sm leading-tight mt-2 text-center">
                      {settings?.organisation || "Invoy"}
                    </span>
                    <span
                      className="text-[10px] text-center"
                      style={{ color: "rgba(255,255,255,0.5)" }}
                    >
                      {settings?.proprietaire || ""}
                    </span>
                    <button
                      onClick={() => setSidebarCollapsed(true)}
                      className="absolute top-0 right-0 flex items-center justify-center w-7 h-7 rounded-lg hover:bg-white/10 transition-colors"
                      style={{ color: "rgba(255,255,255,0.5)" }}
                    >
                      <ChevronLeft size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Nav */}
              <nav
                className="flex-1 overflow-y-auto py-4 sidebar-scroll"
                style={{ overflowX: "hidden" }}
              >
                {PAGES.map(({ id, icon: Icon, key, badge }) => {
                  const isActive = page === id;
                  return (
                    <div
                      key={id}
                      className={`flex ${sidebarCollapsed ? "justify-center px-0" : "px-3"}`}
                    >
                      <button
                        onClick={() => setPage(id)}
                        className={`flex items-center rounded-xl text-sm font-medium transition-all duration-150 relative ${sidebarCollapsed ? "justify-center w-10 h-10" : "w-full px-3 py-2.5 gap-3"}`}
                        style={{
                          background: isActive
                            ? "rgba(255,255,255,0.18)"
                            : "transparent",
                          color: isActive ? "white" : "rgba(255,255,255,0.6)",
                          boxShadow: isActive
                            ? "inset 0 1px 0 rgba(255,255,255,0.15)"
                            : "none",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive)
                            e.currentTarget.style.background =
                              "rgba(255,255,255,0.08)";
                          e.currentTarget.style.color = "rgba(255,255,255,0.9)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color =
                              "rgba(255,255,255,0.6)";
                          }
                        }}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-white opacity-80" />
                        )}
                        <Icon size={17} className="flex-shrink-0" />
                        {!sidebarCollapsed && (
                          <span
                            className={`whitespace-nowrap ${isRTL ? "font-arabic" : ""}`}
                          >
                            {t(lang, key)}
                          </span>
                        )}
                        {badge > 0 && (
                          <span
                            className={`absolute ${sidebarCollapsed ? "top-0 right-0" : "top-1 right-2"} min-w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold bg-red-500 text-white px-1`}
                          >
                            {badge > 99 ? "99+" : badge}
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </nav>

              {/* Bottom controls */}
              <div
                className={`pb-2 space-y-2 ${sidebarCollapsed ? "px-2" : "px-3"}`}
              >
                {/* Dark mode toggle */}
                <div className={sidebarCollapsed ? "flex justify-center" : ""}>
                  <button
                    onClick={toggleDark}
                    className={`flex items-center gap-2 rounded-lg transition-all ${sidebarCollapsed ? "w-10 h-10 justify-center" : "w-full px-3 py-2"}`}
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.75)",
                    }}
                  >
                    {darkMode ? (
                      <Sun size={14} className="flex-shrink-0" />
                    ) : (
                      <Moon size={14} className="flex-shrink-0" />
                    )}
                    {!sidebarCollapsed && (
                      <span style={{ fontSize: "12px" }}>
                        {darkMode ? T("dark_mode_on") : T("dark_mode_off")}
                      </span>
                    )}
                  </button>
                </div>

                {/* Language switcher */}
                {sidebarCollapsed ? (
                  <div className="flex flex-col items-center gap-1">
                    {["fr", "ar"].map((l) => (
                      <button
                        key={l}
                        onClick={() => setLang(l)}
                        className="w-10 h-5 text-[10px] font-bold rounded transition-all flex items-center justify-center"
                        style={{
                          background:
                            lang === l
                              ? "rgba(255,255,255,0.2)"
                              : "transparent",
                          color:
                            lang === l ? "white" : "rgba(255,255,255,0.45)",
                        }}
                      >
                        {l === "fr" ? "FR" : "AR"}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div
                    className="flex rounded-lg overflow-hidden border"
                    style={{ borderColor: "rgba(255,255,255,0.15)" }}
                  >
                    {["fr", "ar"].map((l) => (
                      <button
                        key={l}
                        onClick={() => setLang(l)}
                        className="flex-1 py-1.5 text-xs font-bold transition-all"
                        style={{
                          background:
                            lang === l
                              ? "rgba(255,255,255,0.2)"
                              : "transparent",
                          color:
                            lang === l ? "white" : "rgba(255,255,255,0.45)",
                        }}
                      >
                        {l === "fr" ? "FR" : "عربي"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </aside>

            {/* Main content */}
            <main
              className="flex-1 h-full overflow-y-auto px-8 py-6"
              style={{ background: "var(--bg-app)" }}
            >
              {settings === null ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-pulse text-slate-400 text-sm">
                    {T("loading")}
                  </div>
                </div>
              ) : (
                <ErrorBoundaryWrapper>
                  <div key={page} className="page-enter">
                    {page === "facture" && (
                      <FactureProforma
                        settings={settings}
                        showToast={showToast}
                        pendingLoad={
                          pendingLoad?.type === "facture" ? pendingLoad : null
                        }
                        onLoadConsumed={() => setPendingLoad(null)}
                      />
                    )}
                    {page === "clients" && (
                      <Clients
                        settings={settings}
                        showToast={showToast}
                        onLoadFromHistory={loadFromHistory}
                      />
                    )}
                    {page === "programme" && (
                      <ProgrammeLivraison
                        settings={settings}
                        showToast={showToast}
                      />
                    )}
                    {page === "livraison" && (
                      <BonLivraison
                        settings={settings}
                        showToast={showToast}
                        pendingLoad={
                          pendingLoad?.type === "livraison" ? pendingLoad : null
                        }
                        onLoadConsumed={() => setPendingLoad(null)}
                      />
                    )}
                    {page === "versement" && (
                      <BonVersement
                        settings={settings}
                        showToast={showToast}
                        pendingLoad={
                          pendingLoad?.type === "versement" ? pendingLoad : null
                        }
                        onLoadConsumed={() => setPendingLoad(null)}
                      />
                    )}
                    {page === "marchandise" && (
                      <Marchandise settings={settings} showToast={showToast} />
                    )}
                    {page === "produits" && <Produits showToast={showToast} />}
                    {page === "stock" && <Stock showToast={showToast} />}
                    {page === "stock-movements" && (
                      <StockMovements showToast={showToast} />
                    )}
                    {page === "stock-alerts" && (
                      <StockAlerts showToast={showToast} />
                    )}
                    {page === "purchase-orders" && (
                      <PurchaseOrders showToast={showToast} />
                    )}
                    {page === "parametres" && (
                      <Parametres
                        settings={settings}
                        onSave={loadSettings}
                        showToast={showToast}
                      />
                    )}
                  </div>
                </ErrorBoundaryWrapper>
              )}
            </main>

            {/* Toast - persistent element, updated imperatively */}
            <div
              ref={toastElRef}
              className="toast"
              style={{ display: "none" }}
            />
          </div>
        </KeyboardActionsProvider>
      </LangContext.Provider>
    </CompanyProvider>
  );
}
