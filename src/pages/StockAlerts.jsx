import { useState, useEffect } from "react";
import { AlertTriangle, Package } from "lucide-react";
import { useLang } from "../App";
import { t } from "../utils/i18n";
import EmptyState from "../components/EmptyState";
import { getLowStock } from "../utils/stockStore";
import { getStockStatus } from "../utils/stockHelpers";

export default function StockAlerts({ showToast }) {
  const { lang } = useLang();
  const T = (k) => t(lang, k);

  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const items = await getLowStock();
    setAlerts(items);
  }

  const outOfStock = alerts.filter((p) => getStockStatus(p) === "out");
  const lowStock = alerts.filter((p) => getStockStatus(p) === "low");

  return (
    <div className="max-w-6xl mx-auto">
      <div
        className="sticky top-0 z-10 flex items-center justify-between py-4 mb-6 -mx-8 px-8"
        style={{
          background: "var(--bg-app)",
          borderBottom: "1px solid var(--border-color)",
        }}
      >
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {T("stock_alerts_title")}
          </h1>
          <p className="text-slate-500 text-sm mt-1">{T("stock_alerts_sub")}</p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
          style={{
            background: alerts.length > 0 ? "#fef2f2" : "var(--bg-alt)",
            color: alerts.length > 0 ? "#dc2626" : "var(--text-secondary)",
          }}
        >
          <AlertTriangle size={14} />
          {alerts.length} {T("stock_alerts_count")}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Package}
            title={T("stock_alerts_no")}
            subtitle={T("stock_alerts_no_sub")}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Out of stock */}
          {outOfStock.length > 0 && (
            <div className="card" style={{ borderLeft: "4px solid #dc2626" }}>
              <h3
                className="font-semibold mb-3 flex items-center gap-2"
                style={{ color: "#dc2626" }}
              >
                <AlertTriangle size={18} /> {T("stock_status_out")} (
                {outOfStock.length})
              </h3>
              <div className="space-y-2">
                {outOfStock.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg"
                    style={{ background: "var(--bg-alt)" }}
                  >
                    <div>
                      <span
                        className="font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {p.name}
                      </span>
                      <span className="ml-2 text-sm text-slate-500">
                        — {p.supplier || "—"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-red-600 font-bold">
                        0 {p.unit}
                      </span>
                      <span className="ml-2 text-xs text-slate-400">
                        / {p.minQty} min
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Low stock */}
          {lowStock.length > 0 && (
            <div className="card" style={{ borderLeft: "4px solid #f59e0b" }}>
              <h3
                className="font-semibold mb-3 flex items-center gap-2"
                style={{ color: "#f59e0b" }}
              >
                <AlertTriangle size={18} /> {T("stock_status_low")} (
                {lowStock.length})
              </h3>
              <div className="space-y-2">
                {lowStock.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg"
                    style={{ background: "var(--bg-alt)" }}
                  >
                    <div>
                      <span
                        className="font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {p.name}
                      </span>
                      <span className="ml-2 text-sm text-slate-500">
                        — {p.supplier || "—"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-yellow-600 font-bold">
                        {p.currentQty} {p.unit}
                      </span>
                      <span className="ml-2 text-xs text-slate-400">
                        / {p.minQty} min
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
