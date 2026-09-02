import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Package, X, Check, AlertTriangle } from "lucide-react";
import { useLang } from "../App";
import { t } from "../utils/i18n";
import EmptyState from "../components/EmptyState";
import { useKeyboardActions } from "../hooks/KeyboardActionsContext";
import {
  getStock,
  upsertStockProduct,
  deleteStockProduct,
  addMovement,
} from "../utils/stockStore";
import { getStockStatus } from "../utils/stockHelpers";

const STATUS_STYLES = {
  ok: {
    bg: "bg-green-100",
    text: "text-green-700",
    darkBg: "dark:bg-green-900/30",
    darkText: "dark:text-green-400",
  },
  low: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    darkBg: "dark:bg-yellow-900/30",
    darkText: "dark:text-yellow-400",
  },
  out: {
    bg: "bg-red-100",
    text: "text-red-700",
    darkBg: "dark:bg-red-900/30",
    darkText: "dark:text-red-400",
  },
  over: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    darkBg: "dark:bg-blue-900/30",
    darkText: "dark:text-blue-400",
  },
};

export default function Stock({ showToast }) {
  const { lang } = useLang();
  const T = (k) => t(lang, k);

  const [stock, setStock] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    unit: "pcs",
    minQty: 0,
    maxQty: 0,
    currentQty: 0,
    costPrice: 0,
    salePrice: 0,
    supplier: "",
    notes: "",
  });

  const { registerActions, unregisterActions } = useKeyboardActions();
  const actionsRef = useRef({});
  actionsRef.current = {
    new: () => {
      if (!showForm) openNew();
    },
    save: () => {
      if (showForm) save();
    },
  };
  useEffect(() => {
    registerActions("stock", {
      new: (...args) => actionsRef.current.new(...args),
      save: (...args) => actionsRef.current.save(...args),
    });
    return () => unregisterActions("stock");
  }, [registerActions, unregisterActions]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const items = await getStock();
    setStock(items);
  }

  function openNew() {
    setEditingProduct(null);
    setForm({
      name: "",
      unit: "pcs",
      minQty: 0,
      maxQty: 0,
      currentQty: 0,
      costPrice: 0,
      salePrice: 0,
      supplier: "",
      notes: "",
    });
    setShowForm(true);
  }

  function openEdit(product) {
    setEditingProduct(product);
    setForm({
      name: product.name || "",
      unit: product.unit || "pcs",
      minQty: product.minQty || 0,
      maxQty: product.maxQty || 0,
      currentQty: product.currentQty || 0,
      costPrice: product.costPrice || 0,
      salePrice: product.salePrice || 0,
      supplier: product.supplier || "",
      notes: product.notes || "",
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingProduct(null);
  }

  async function save() {
    if (!form.name.trim()) {
      showToast(T("stock_name_required"), "error");
      return;
    }
    if (!form.unit.trim()) {
      showToast(T("stock_unit_required"), "error");
      return;
    }
    // Check duplicate name (exclude current product being edited)
    const dup = stock.some(
      (p) =>
        p.id !== editingProduct?.id &&
        p.name.toLowerCase() === form.name.trim().toLowerCase(),
    );
    if (dup) {
      showToast(T("stock_duplicate"), "error");
      return;
    }
    const id =
      editingProduct?.id ||
      Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
    const newQty = parseInt(form.currentQty) || 0;
    const oldQty = editingProduct ? editingProduct.currentQty || 0 : 0;
    const delta = newQty - oldQty;

    await upsertStockProduct({
      id,
      ...form,
      currentQty: oldQty, // movement below applies the delta to currentQty
      name: form.name.trim(),
      unit: form.unit.trim(),
    });
    // Ledger: manual qty changes go through movements so currentQty always
    // equals the sum of movements (including creation as "initial").
    if (delta !== 0) {
      await addMovement({
        productId: id,
        type: delta > 0 ? "in" : "out",
        qty: delta, // signed — store convention
        reason: "manual_adjust",
        reference: editingProduct ? "stock-edit" : "stock-initial",
        unitCost: parseInt(form.costPrice) || 0,
      });
    }
    closeForm();
    await load();
    showToast(editingProduct ? T("stock_updated") : T("stock_added"));
  }

  async function remove(id) {
    if (removingId) return;
    if (!confirm(T("stock_delete_confirm"))) return;
    setRemovingId(id);
    try {
      await deleteStockProduct(id);
      await load();
      showToast(T("stock_deleted"));
    } finally {
      setRemovingId(null);
    }
  }

  const filtered = search.trim()
    ? stock.filter((p) =>
        p.name.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : stock;

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
            {T("title_stock")}
          </h1>
          <p className="text-slate-500 text-sm mt-1">{T("sub_stock")}</p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
            style={{
              background: "var(--bg-alt)",
              color: "var(--text-secondary)",
            }}
          >
            <Package size={14} />
            {stock.length} {T("produits_count")}
          </div>
          <button onClick={openNew} className="btn-primary">
            <Plus size={16} /> {T("btn_add_stock")}
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">
              {editingProduct ? T("btn_edit") : T("btn_new_stock_product")}
            </h2>
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
                {T("stock_name")}
              </label>
              <input
                className="form-input w-full"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                maxLength={120}
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {T("stock_unit")}
              </label>
              <input
                className="form-input w-full"
                value={form.unit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, unit: e.target.value }))
                }
                placeholder={T("stock_ph_unit")}
                maxLength={20}
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {T("stock_current_qty")}
              </label>
              <input
                type="number"
                className="form-input w-full"
                value={form.currentQty}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currentQty: Number(e.target.value) }))
                }
                min="0"
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {T("stock_min_qty")}
              </label>
              <input
                type="number"
                className="form-input w-full"
                value={form.minQty}
                onChange={(e) =>
                  setForm((f) => ({ ...f, minQty: Number(e.target.value) }))
                }
                min="0"
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {T("stock_max_qty")}
              </label>
              <input
                type="number"
                className="form-input w-full"
                value={form.maxQty}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxQty: Number(e.target.value) }))
                }
                min="0"
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {T("stock_cost_price")}
              </label>
              <input
                type="number"
                className="form-input w-full"
                value={form.costPrice}
                onChange={(e) =>
                  setForm((f) => ({ ...f, costPrice: Number(e.target.value) }))
                }
                min="0"
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {T("stock_sale_price")}
              </label>
              <input
                type="number"
                className="form-input w-full"
                value={form.salePrice}
                onChange={(e) =>
                  setForm((f) => ({ ...f, salePrice: Number(e.target.value) }))
                }
                min="0"
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {T("stock_supplier")}
              </label>
              <input
                className="form-input w-full"
                value={form.supplier}
                onChange={(e) =>
                  setForm((f) => ({ ...f, supplier: e.target.value }))
                }
                maxLength={120}
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {T("stock_notes")}
              </label>
              <input
                className="form-input w-full"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                maxLength={200}
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

      {/* Search */}
      {stock.length > 6 && (
        <div className="mb-4">
          <input
            className="form-input w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={T("stock_search")}
          />
        </div>
      )}

      {/* Table */}
      {stock.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Package}
            title={T("stock_no_items")}
            subtitle={T("stock_no_items_sub")}
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
                  "stock_move_product",
                  "stock_unit",
                  "stock_current_qty",
                  "stock_min_qty",
                  "stock_cost_price",
                  "stock_sale_price",
                  "th_status",
                  "th_actions",
                ].map((k) => (
                  <th
                    key={k}
                    className="text-left px-4 py-3 font-semibold"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {T(k)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-8 text-slate-400 italic"
                  >
                    {T("no_results")} « {search} »
                  </td>
                </tr>
              ) : (
                filtered.map((p, i) => {
                  const status = getStockStatus(p);
                  const ss = STATUS_STYLES[status];
                  return (
                    <tr
                      key={p.id}
                      className={i % 2 === 1 ? "table-row-alt" : ""}
                      style={{ borderBottom: "1px solid var(--border-color)" }}
                    >
                      <td
                        className="px-4 py-2 font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {p.name}
                      </td>
                      <td className="px-4 py-2">{p.unit}</td>
                      <td className="px-4 py-2 font-mono">
                        {p.currentQty || 0}
                      </td>
                      <td className="px-4 py-2 font-mono">{p.minQty || 0}</td>
                      <td className="px-4 py-2 font-mono">
                        {(p.costPrice || 0).toLocaleString("fr-DZ", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        DA
                      </td>
                      <td className="px-4 py-2 font-mono">
                        {(p.salePrice || 0).toLocaleString("fr-DZ", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        DA
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ss.bg} ${ss.text} ${ss.darkBg} ${ss.darkText}`}
                        >
                          {status === "low" || status === "out" ? (
                            <AlertTriangle size={12} />
                          ) : null}
                          {T(`stock_status_${status}`)}
                        </span>
                      </td>
                      <td className="px-3 text-center">
                        <button
                          onClick={() => openEdit(p)}
                          className="text-blue-500 hover:text-blue-700 p-1 transition-colors text-xs"
                        >
                          {T("btn_edit")}
                        </button>
                        <button
                          onClick={() => remove(p.id)}
                          disabled={removingId === p.id}
                          aria-label={T("btn_delete")}
                          className="text-red-400 hover:text-red-600 transition-colors p-1 rounded ml-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
