import { useState, useEffect, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useLang } from "../App";
import { t } from "../utils/i18n";

export default function ArticlesTable({
  articles = [],
  onChange,
  showNum = true,
}) {
  const { lang } = useLang();
  const T = (k) => t(lang, k);

  // Use ref for produits so updating it never triggers a re-render (avoids focus stealing)
  const produitsRef = useRef([]);
  const [activeRow, setActiveRow] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const selectingRef = useRef(false);

  useEffect(() => {
    window.api.storeGet("produits", []).then((list) => {
      produitsRef.current = Array.isArray(list) ? list : [];
    });
  }, []);

  function computeSuggestions(value) {
    const q = (value || "").trim().toLowerCase();
    const all = produitsRef.current;
    if (!q) return all.slice(0, 10);
    return all.filter((p) => p.toLowerCase().includes(q)).slice(0, 10);
  }

  function update(index, field, value) {
    const updated = articles.map((a, i) => {
      if (i !== index) return a;
      const next = { ...a, [field]: value };
      if (field === "quantite" || field === "prixUnitaire") {
        const qty = parseFloat(field === "quantite" ? value : a.quantite) || 0;
        const pu =
          parseFloat(field === "prixUnitaire" ? value : a.prixUnitaire) || 0;
        next.montant = qty * pu;
      }
      return next;
    });
    onChange(updated);
  }

  function handleDesigChange(index, value) {
    update(index, "designation", value);
    setSuggestions(computeSuggestions(value));
    setActiveRow(index);
  }

  function handleDesigFocus(index, value) {
    setSuggestions(computeSuggestions(value));
    setActiveRow(index);
  }

  function handleDesigBlur(index, value) {
    if (selectingRef.current) return;
    setActiveRow(null);
    setSuggestions([]);

    // Save to store + update ref — does NOT call setState so no re-render
    const val = (value || "").trim();
    if (val) {
      window.api.storeGet("produits", []).then((current) => {
        const list = Array.isArray(current) ? current : [];
        if (!list.some((p) => p.toLowerCase() === val.toLowerCase())) {
          const updated = [...list, val].sort((a, b) =>
            a.localeCompare(b, "fr", { sensitivity: "base" }),
          );
          window.api.storeSet("produits", updated);
          produitsRef.current = updated; // update ref only — no re-render
          // Unified catalog: new name also gets a Stock item (qty 0, safe
          // defaults, idempotent). prixUnitaire from this line seeds salePrice.
          const line = articles[index] || {};
          import("../utils/stockStore.js")
            .then(({ ensureStockProductFromArticle }) =>
              ensureStockProductFromArticle({
                name: val,
                salePrice: line.prixUnitaire || 0,
              }),
            )
            .catch((e) => console.error("Stock auto-create failed:", e));
        }
      });
    }
  }

  function selectSuggestion(index, s) {
    selectingRef.current = false;
    update(index, "designation", s);
    setActiveRow(null);
    setSuggestions([]);
  }

  function addRow() {
    onChange([
      ...articles,
      {
        id: Date.now(),
        designation: "",
        quantite: "",
        prixUnitaire: "",
        montant: "",
      },
    ]);
  }

  function removeRow(i) {
    onChange(articles.filter((_, idx) => idx !== i));
  }

  const total = articles.reduce((s, a) => s + (parseFloat(a.montant) || 0), 0);

  return (
    <div>
      <div
        className="overflow-x-auto rounded-lg border"
        style={{ borderColor: "var(--border-input)" }}
      >
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ background: "var(--bg-table-header, #1e293b)" }}>
              {showNum && (
                <th className="table-header w-10 text-center">
                  {T("field_num_ordre")}
                </th>
              )}
              <th className="table-header text-left">
                {T("field_designation")}
              </th>
              <th className="table-header w-24 text-center">
                {T("field_quantite")}
              </th>
              <th className="table-header w-32 text-right">
                {T("field_prix_unitaire")}
              </th>
              <th className="table-header w-32 text-right">
                {T("field_montant")}
              </th>
              <th className="table-header w-10"></th>
            </tr>
          </thead>
          <tbody>
            {articles.length === 0 && (
              <tr>
                <td
                  colSpan={showNum ? 6 : 5}
                  className="text-center py-6 text-slate-400 text-sm italic"
                >
                  {T("no_articles")}
                </td>
              </tr>
            )}
            {articles.map((a, i) => (
              <tr
                key={a.id || i}
                className={i % 2 === 1 ? "table-row-alt" : ""}
              >
                {showNum && (
                  <td className="table-cell text-center text-slate-500 font-mono">
                    {i + 1}
                  </td>
                )}

                <td className="table-cell relative overflow-visible">
                  <input
                    type="text"
                    className="w-full border-0 bg-transparent focus:outline-none text-sm text-slate-800 placeholder-slate-300"
                    value={a.designation || ""}
                    onChange={(e) => handleDesigChange(i, e.target.value)}
                    onFocus={() => handleDesigFocus(i, a.designation || "")}
                    onBlur={() => handleDesigBlur(i, a.designation || "")}
                    placeholder={T("field_designation")}
                    autoComplete="off"
                  />
                  {activeRow === i && suggestions.length > 0 && (
                    <div
                      className="absolute left-0 z-50 w-full min-w-[200px] max-h-44 overflow-y-auto rounded-lg shadow-xl"
                      style={{
                        top: "calc(100% + 2px)",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onMouseDown={() => {
                            selectingRef.current = true;
                          }}
                          onMouseUp={() => selectSuggestion(i, s)}
                          className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-blue-50 hover:text-blue-700"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </td>

                <td className="table-cell">
                  <input
                    type="number"
                    min="0"
                    className="w-full border-0 bg-transparent focus:outline-none text-sm text-right text-slate-800"
                    value={a.quantite || ""}
                    onChange={(e) => update(i, "quantite", e.target.value)}
                    placeholder="0"
                  />
                </td>
                <td className="table-cell">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full border-0 bg-transparent focus:outline-none text-sm text-right text-slate-800"
                    value={a.prixUnitaire || ""}
                    onChange={(e) => update(i, "prixUnitaire", e.target.value)}
                    placeholder="0.00"
                  />
                </td>
                <td className="table-cell text-right font-medium text-slate-800">
                  {(parseFloat(a.montant) || 0).toLocaleString("fr-DZ", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="table-cell text-center">
                  <button
                    onClick={() => removeRow(i)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {articles.length > 0 && (
            <tfoot>
              <tr style={{ background: "var(--bg-table-footer, #f0f3f9)" }}>
                {showNum && <td></td>}
                <td
                  colSpan={2}
                  className="px-3 py-2 text-xs text-slate-500 italic"
                >
                  {articles.length}{" "}
                  {articles.length > 1
                    ? T("articles_count_plural")
                    : T("articles_count")}
                </td>
                <td className="px-3 py-2 text-right font-bold text-slate-700 text-sm">
                  {T("total")}
                </td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">
                  {total.toLocaleString("fr-DZ", { minimumFractionDigits: 2 })}{" "}
                  DA
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <button
        onClick={addRow}
        className="mt-3 flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
      >
        <Plus size={16} /> {T("btn_add_article")}
      </button>
    </div>
  );
}
