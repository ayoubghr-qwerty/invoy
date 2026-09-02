import { useState, useEffect } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Plus,
  X,
  Check,
  List,
} from "lucide-react";
import { useLang } from "../App";
import { t } from "../utils/i18n";
import EmptyState from "../components/EmptyState";
import { getStock, getMovements, addMovement } from "../utils/stockStore";

const TYPE_ICONS = {
  in: ArrowDownCircle,
  out: ArrowUpCircle,
  adjust: RefreshCw,
};
const TYPE_COLORS = {
  in: "text-green-500",
  out: "text-red-500",
  adjust: "text-blue-500",
};

const REASONS = [
  "stock_reason_purchase",
  "stock_reason_sale",
  "stock_reason_return",
  "stock_reason_count",
  "stock_reason_damage",
  "stock_reason_other",
];
const REASON_VALUES = [
  "purchase",
  "sale",
  "return",
  "count",
  "damage",
  "other",
];

export default function StockMovements({ showToast }) {
  const { lang } = useLang();
  const T = (k) => t(lang, k);

  const [movements, setMovements] = useState([]);
  const [stock, setStock] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [form, setForm] = useState({
    productId: "",
    type: "in",
    qty: 0,
    reason: "purchase",
    reference: "",
    unitCost: 0,
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [s, m] = await Promise.all([getStock(), getMovements()]);
    setStock(s);
    setMovements(m);
  }

  function openNew() {
    setForm({
      productId: stock[0]?.id || "",
      type: "in",
      qty: 0,
      reason: "purchase",
      reference: "",
      unitCost: 0,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
  }

  async function save() {
    if (!form.productId || form.qty === "" || form.qty === null) {
      showToast(T("stock_move_qty") + " " + T("validation_required"), "error");
      return;
    }
    const qty = Number(form.qty);
    const movementQty =
      form.type === "out"
        ? -Math.abs(qty)
        : form.type === "adjust"
          ? qty
          : Math.abs(qty);
    await addMovement({
      productId: form.productId,
      type: form.type,
      qty: movementQty,
      reason: form.reason,
      reference: form.reference,
      unitCost: form.unitCost,
    });
    closeForm();
    await load();
    showToast(T("stock_movement_added"));
  }

  const filtered = filterType
    ? movements.filter((m) => m.type === filterType)
    : movements;

  const productMap = Object.fromEntries(stock.map((p) => [p.id, p.name]));

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
            {T("stock_movements_title")}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {T("stock_movements_sub")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex gap-1 rounded-lg overflow-hidden border"
            style={{ borderColor: "var(--border-color)" }}
          >
            {[
              { value: "", label: "all" },
              { value: "in", label: T("stock_move_in") },
              { value: "out", label: T("stock_move_out") },
              { value: "adjust", label: T("stock_move_adjust") },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setFilterType(f.value)}
                aria-pressed={filterType === f.value}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background:
                    filterType === f.value ? "var(--accent)" : "var(--bg-alt)",
                  color:
                    filterType === f.value ? "white" : "var(--text-secondary)",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={openNew} className="btn-primary">
            <Plus size={16} /> {T("stock_add_movement")}
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">{T("stock_add_movement")}</h2>
            <button
              onClick={closeForm}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {T("stock_move_product")}
              </label>
              <select
                className="form-input w-full"
                value={form.productId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, productId: e.target.value }))
                }
              >
                {stock.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {T("stock_move_type")}
              </label>
              <select
                className="form-input w-full"
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, type: e.target.value }))
                }
              >
                <option value="in">{T("stock_move_in")}</option>
                <option value="out">{T("stock_move_out")}</option>
                <option value="adjust">{T("stock_move_adjust")}</option>
              </select>
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {T("stock_move_qty")}
              </label>
              <input
                type="number"
                className="form-input w-full"
                value={form.qty}
                onChange={(e) =>
                  setForm((f) => ({ ...f, qty: Number(e.target.value) }))
                }
                min="0"
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {T("stock_move_reason")}
              </label>
              <select
                className="form-input w-full"
                value={form.reason}
                onChange={(e) =>
                  setForm((f) => ({ ...f, reason: e.target.value }))
                }
              >
                {REASONS.map((r, i) => (
                  <option key={r} value={REASON_VALUES[i]}>
                    {T(r)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {T("stock_move_reference")}
              </label>
              <input
                className="form-input w-full"
                value={form.reference}
                onChange={(e) =>
                  setForm((f) => ({ ...f, reference: e.target.value }))
                }
                maxLength={60}
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {T("stock_move_unit_cost")}
              </label>
              <input
                type="number"
                className="form-input w-full"
                value={form.unitCost}
                onChange={(e) =>
                  setForm((f) => ({ ...f, unitCost: Number(e.target.value) }))
                }
                min="0"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={save} className="btn-primary">
              <Check size={16} /> {T("btn_save")}
            </button>
            <button onClick={closeForm} className="btn-secondary">
              <X size={16} /> {T("btn_cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Movements Table */}
      {movements.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={List}
            title={T("stock_movements_no")}
            subtitle={T("stock_movements_no_sub")}
          />
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr
                style={{
                  background: "var(--bg-alt)",
                  borderBottom: "1px solid var(--border-color)",
                }}
              >
                {[
                  T("stock_move_date"),
                  T("stock_move_product"),
                  T("stock_move_type"),
                  T("stock_move_qty"),
                  T("stock_move_reason"),
                  T("stock_move_reference"),
                  T("stock_move_unit_cost"),
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 font-semibold"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => {
                const Icon = TYPE_ICONS[m.type] || RefreshCw;
                const color = TYPE_COLORS[m.type] || "";
                return (
                  <tr
                    key={m.id}
                    className={i % 2 === 1 ? "table-row-alt" : ""}
                    style={{ borderBottom: "1px solid var(--border-color)" }}
                  >
                    <td className="px-4 py-2 text-slate-500">
                      {m.createdAt
                        ? new Date(m.createdAt).toLocaleDateString("fr-DZ")
                        : "—"}
                    </td>
                    <td
                      className="px-4 py-2 font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {productMap[m.productId] || "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center gap-1 ${color}`}
                      >
                        <Icon size={14} />
                        {T(`stock_move_${m.type}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono">
                      {m.qty > 0 ? "+" : ""}
                      {m.qty}
                    </td>
                    <td className="px-4 py-2">{m.reason || "—"}</td>
                    <td className="px-4 py-2 text-slate-500">
                      {m.reference || "—"}
                    </td>
                    <td className="px-4 py-2 font-mono">
                      {m.unitCost ? `${m.unitCost.toLocaleString()} DA` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
