import { useState, useEffect } from "react";
import { Plus, Trash2, ShoppingCart, X, Check, Eye } from "lucide-react";
import { useLang } from "../App";
import { t } from "../utils/i18n";
import EmptyState from "../components/EmptyState";
import {
  getStock,
  getPurchaseOrders,
  upsertPurchaseOrder,
  receivePO,
  getMovements,
  reverseMovementsGuarded,
} from "../utils/stockStore";
import { toCents, fromCents, mul } from "../utils/money";

const STATUSES = ["draft", "sent", "partial", "received", "cancelled"];
const STATUS_COLORS = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-700",
  partial: "bg-yellow-100 text-yellow-700",
  received: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function PurchaseOrders({ showToast }) {
  const { lang } = useLang();
  const T = (k) => t(lang, k);

  const [pos, setPos] = useState([]);
  const [stock, setStock] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showReceive, setShowReceive] = useState(null); // PO id
  const [form, setForm] = useState({
    number: "",
    supplierName: "",
    date: new Date().toISOString().slice(0, 10),
    status: "draft",
    lines: [],
  });
  const [receiveLines, setReceiveLines] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [s, p] = await Promise.all([getStock(), getPurchaseOrders()]);
    setStock(s);
    setPos(p);
  }

  function openNew() {
    const nextNum = `PO-${String(pos.length + 1).padStart(4, "0")}`;
    setForm({
      number: nextNum,
      supplierName: "",
      date: new Date().toISOString().slice(0, 10),
      status: "draft",
      lines: [],
    });
    setShowForm(true);
  }

  function addLine() {
    if (stock.length === 0) {
      showToast(T("stock_po_no_stock"), "error");
      return;
    }
    setForm((f) => ({
      ...f,
      lines: [
        ...f.lines,
        {
          productId: stock[0]?.id || "",
          productName: "",
          qtyOrdered: 1,
          qtyReceived: 0,
          unit: "pcs",
          unitCost: 0,
        },
      ],
    }));
  }

  function updateLine(idx, field, value) {
    setForm((f) => {
      const lines = [...f.lines];
      lines[idx] = { ...lines[idx], [field]: value };
      if (field === "productId") {
        const p = stock.find((s) => s.id === value);
        if (p) {
          lines[idx].productName = p.name;
          lines[idx].unit = p.unit;
        }
      }
      return { ...f, lines };
    });
  }

  function removeLine(idx) {
    setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));
  }

  function closeForm() {
    setShowForm(false);
  }

  async function save() {
    if (!form.supplierName.trim()) {
      showToast(T("stock_po_supplier_required"), "error");
      return;
    }
    const validLines = form.lines.filter((l) => l.productId);
    if (validLines.length !== form.lines.length) {
      showToast(T("stock_po_line_product_required"), "error");
      return;
    }
    const total = form.lines.reduce(
      (s, l) => s + mul(l.unitCost, l.qtyOrdered),
      0,
    );
    await upsertPurchaseOrder({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 9),
      ...form,
      totalCost: total,
    });
    closeForm();
    await load();
    showToast(T("stock_po_saved"));
  }

  async function openReceive(po) {
    setShowReceive(po.id);
    setReceiveLines(po.lines.map((l) => ({ ...l, qtyReceived: 0 })));
  }

  function updateReceiveQty(idx, qty) {
    setReceiveLines((lines) => {
      const updated = [...lines];
      updated[idx] = { ...updated[idx], qtyReceived: Number(qty) };
      return updated;
    });
  }

  async function confirmReceive() {
    await receivePO(showReceive, receiveLines);
    setShowReceive(null);
    await load();
    showToast(T("stock_po_receive_ok"));
  }

  async function deletePO(id) {
    if (!confirm(T("stock_po_delete_confirm"))) return;
    const all = await window.api.storeGet("purchase_orders", []);
    const po = (Array.isArray(all) ? all : []).find((p) => p.id === id);
    if (po && (po.status === "received" || po.status === "partial")) {
      // Reverse stock received from this PO (clamped to available stock)
      try {
        const movements = await getMovements({
          type: "in",
        });
        const poMovements = movements.filter(
          (m) => m.reason === "purchase" && m.reference === po.number,
        );
        const skipped = await reverseMovementsGuarded(
          poMovements,
          `PO-${po.number}-REV`,
        );
        if (skipped.length > 0) {
          showToast(T("stock_po_reverse_clamped"), "error");
        }
      } catch (e) {
        console.error("PO stock reversal failed:", e);
      }
    }
    const filtered = (Array.isArray(all) ? all : []).filter((p) => p.id !== id);
    await window.api.storeSet("purchase_orders", filtered);
    await load();
    showToast(T("stock_po_deleted"));
  }

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
            {T("stock_po_title")}
          </h1>
          <p className="text-slate-500 text-sm mt-1">{T("stock_po_sub")}</p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
            style={{
              background: "var(--bg-alt)",
              color: "var(--text-secondary)",
            }}
          >
            <ShoppingCart size={14} />
            {pos.length} {T("stock_po_count")}
          </div>
          <button onClick={openNew} className="btn-primary">
            <Plus size={16} /> {T("stock_po_new")}
          </button>
        </div>
      </div>

      {/* Receive Modal */}
      {showReceive && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">{T("stock_po_receive")}</h2>
            <button
              onClick={() => setShowReceive(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </div>
          <div className="space-y-3">
            {receiveLines.map((l, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-3 rounded-lg"
                style={{ background: "var(--bg-alt)" }}
              >
                <span
                  className="font-medium flex-1"
                  style={{ color: "var(--text-primary)" }}
                >
                  {l.productName || "—"}
                </span>
                <span className="text-sm text-slate-500">
                  {T("stock_po_qty_ordered")}: {l.qtyOrdered} {l.unit}
                </span>
                <span className="text-sm text-slate-500">
                  {T("stock_po_qty_received")}: {l.qtyReceived || 0}
                </span>
                <input
                  type="number"
                  className="form-input w-24 py-1"
                  value={l.qtyReceived}
                  onChange={(e) => updateReceiveQty(i, e.target.value)}
                  min="0"
                  placeholder={T("stock_po_ph_received")}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={confirmReceive} className="btn-primary">
              <Check size={16} /> {T("stock_po_receive")}
            </button>
            <button
              onClick={() => setShowReceive(null)}
              className="btn-secondary"
            >
              <X size={16} /> {T("btn_cancel")}
            </button>
          </div>
        </div>
      )}

      {/* New PO Form */}
      {showForm && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">{T("stock_po_new")}</h2>
            <button
              onClick={closeForm}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {T("stock_po_number")}
              </label>
              <input
                className="form-input w-full"
                value={form.number}
                onChange={(e) =>
                  setForm((f) => ({ ...f, number: e.target.value }))
                }
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {T("stock_po_supplier")}
              </label>
              <input
                className="form-input w-full"
                value={form.supplierName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, supplierName: e.target.value }))
                }
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {T("stock_po_date")}
              </label>
              <input
                type="date"
                className="form-input w-full"
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Lines */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {T("stock_po_lines")}
              </h3>
              <button
                onClick={addLine}
                className="text-xs text-blue-500 hover:text-blue-700"
              >
                + {T("stock_po_add_line")}
              </button>
            </div>
            {form.lines.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                {T("stock_po_lines_empty")}
              </p>
            ) : (
              <div className="space-y-2">
                {/* Column titles — aligned with the input widths below */}
                <div
                  className="flex items-center gap-2 px-2 text-xs font-semibold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <span className="flex-1">{T("stock_move_product")}</span>
                  <span className="w-20 text-center">
                    {T("stock_po_ph_qty")}
                  </span>
                  <span className="w-16 text-center">
                    {T("stock_po_ph_unit")}
                  </span>
                  <span className="w-24 text-right">
                    {T("stock_po_ph_price")}
                  </span>
                  <span className="w-8" aria-hidden="true" />
                </div>
                {form.lines.map((l, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 rounded-lg"
                    style={{ background: "var(--bg-alt)" }}
                  >
                    <select
                      className="form-input py-1.5 flex-1"
                      style={{
                        backgroundColor: "var(--bg-input)",
                        color: "var(--text-primary)",
                      }}
                      value={l.productId}
                      aria-label={T("stock_move_product")}
                      onChange={(e) =>
                        updateLine(i, "productId", e.target.value)
                      }
                    >
                      {stock.length === 0 && (
                        <option value="">— {T("stock_no_items")} —</option>
                      )}
                      {stock.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="form-input py-1.5 w-20"
                      value={l.qtyOrdered}
                      aria-label={T("stock_po_ph_qty")}
                      onChange={(e) =>
                        updateLine(i, "qtyOrdered", Number(e.target.value))
                      }
                      min="1"
                      placeholder={T("stock_po_ph_qty")}
                    />
                    <input
                      className="form-input py-1.5 w-16"
                      value={l.unit}
                      aria-label={T("stock_po_ph_unit")}
                      onChange={(e) => updateLine(i, "unit", e.target.value)}
                      placeholder={T("stock_po_ph_unit")}
                    />
                    <input
                      type="number"
                      className="form-input py-1.5 w-24"
                      value={l.unitCost}
                      aria-label={T("stock_po_ph_price")}
                      onChange={(e) =>
                        updateLine(i, "unitCost", Number(e.target.value))
                      }
                      min="0"
                      placeholder={T("stock_po_ph_price")}
                    />
                    <button
                      onClick={() => removeLine(i)}
                      aria-label={T("btn_delete")}
                      className="text-red-400 hover:text-red-600 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            className="text-sm font-semibold mb-4"
            style={{ color: "var(--text-primary)" }}
          >
            {T("stock_po_total")}:{" "}
            {fromCents(
              form.lines.reduce((s, l) => s + mul(l.unitCost, l.qtyOrdered), 0),
            )}{" "}
            DA
          </div>

          <div className="flex gap-2">
            <button onClick={save} className="btn-primary">
              <Check size={16} /> {T("btn_save")}
            </button>
            <button onClick={closeForm} className="btn-secondary">
              <X size={16} /> {T("btn_cancel")}
            </button>
          </div>
        </div>
      )}

      {/* PO List */}
      {pos.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ShoppingCart}
            title={T("stock_po_no")}
            subtitle={T("stock_po_no_sub")}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {pos.map((po) => (
            <div key={po.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <span
                      className="font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {po.number}
                    </span>
                    <span className="ml-2 text-sm text-slate-500">
                      {po.supplierName}
                    </span>
                    <span className="ml-2 text-sm text-slate-400">
                      {po.date}
                    </span>
                  </div>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[po.status] || ""}`}
                  >
                    {T(`stock_po_status_${po.status}`)}
                  </span>
                  <span
                    className="text-sm font-mono"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {fromCents(po.totalCost || 0)} DA
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {po.status !== "received" && po.status !== "cancelled" && (
                    <button
                      onClick={() => openReceive(po)}
                      className="text-xs text-green-500 hover:text-green-700 p-1 px-2 rounded transition-colors"
                    >
                      {T("stock_po_receive")}
                    </button>
                  )}
                  <button
                    onClick={() => deletePO(po.id)}
                    aria-label={T("btn_delete")}
                    className="text-red-400 hover:text-red-600 p-1 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {po.lines.length > 0 && (
                <div className="mt-2 text-xs text-slate-500">
                  {po.lines.map((l, i) => (
                    <span key={i} className="mr-3">
                      {l.productName}: {l.qtyOrdered} {l.unit} (
                      {l.qtyReceived || 0} {T("stock_po_received_short")})
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
