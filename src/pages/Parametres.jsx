import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Trash2,
  Save,
  Download,
  Upload,
  RotateCcw,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useLang } from "../App";
import { useCompany } from "../context/CompanyContext";
import { t } from "../utils/i18n";
import { useKeyboardActions } from "../hooks/KeyboardActionsContext";

const APP_THEMES = [
  { label: "Bleu Marine", labelAr: "أزرق داكن", color: "#0f2044" },
  { label: "Vert Foncé", labelAr: "أخضر داكن", color: "#1a4d2e" },
  { label: "Bordeaux", labelAr: "أحمر داكن", color: "#7c1c1c" },
  { label: "Ardoise", labelAr: "رمادي داكن", color: "#1e293b" },
  { label: "Violet", labelAr: "بنفسجي", color: "#3b1f5e" },
  { label: "Anthracite", labelAr: "أنثراسيت", color: "#1f1f2e" },
];

export default function Parametres({ settings, onSave, showToast }) {
  const { lang } = useLang();
  const T = (k) => t(lang, k);

  const [form, setForm] = useState({
    organisation: "",
    proprietaire: "",
    email: "",
    adresse: "",
    telephones: [""],
    rc: "",
    artImp: "",
    nif: "",
    nis: "",
    couleur: "#0f2044",
    couleurApp: "#0f2044",
    logo: "",
    fontDoc: "Arial",
  });

  const [counters, setCounters] = useState({});
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [dangerCollapsed, setDangerCollapsed] = useState(true);
  const [editingCompany, setEditingCompany] = useState(null);
  const [companyForm, setCompanyForm] = useState({
    name: "",
    adresse: "",
    telephone: "",
    nif: "",
    nis: "",
    agrement: "",
    rc: "",
  });
  const [showAddCompany, setShowAddCompany] = useState(false);

  const {
    companies,
    activeCompanyId,
    setActiveCompanyId,
    addCompany,
    updateCompany,
    deleteCompany,
  } = useCompany();

  useEffect(() => {
    loadCounters();
  }, []);

  // Keyboard actions registration
  const { registerActions, unregisterActions } = useKeyboardActions();
  const actionsRef = useRef({});
  actionsRef.current = {
    save: save,
    close: () => {
      setShowAddCompany(false);
      setEditingCompany(null);
      setShowClearConfirm(false);
    },
  };
  useEffect(() => {
    registerActions("parametres", {
      save: (...args) => actionsRef.current.save(...args),
      close: (...args) => actionsRef.current.close(...args),
    });
    return () => unregisterActions("parametres");
  }, [registerActions, unregisterActions]);

  async function loadCounters() {
    const c = await window.api.storeGet("counters", {});
    setCounters(c || {});
  }

  const COUNTER_DOCS = [
    { key: "facture", labelKey: "counter_facture" },
    { key: "bonLivraison", labelKey: "counter_bon_livraison" },
    { key: "bonVersement", labelKey: "counter_bon_versement" },
    { key: "programme", labelKey: "counter_programme" },
    { key: "marchandise", labelKey: "counter_marchandise" },
  ];

  async function resetOneCounter(key) {
    if (
      !confirm(
        `${T("reset_counter_confirm")} "${T(COUNTER_DOCS.find((d) => d.key === key)?.labelKey)}" ?`,
      )
    )
      return;
    const updated = { ...counters, [key]: 0 };
    await window.api.storeSet("counters", updated);
    setCounters(updated);
    showToast(T("counter_reset_one"));
  }

  async function resetAllCounters() {
    if (!confirm(T("counter_reset_all_confirm"))) return;
    await window.api.storeSet("counters", {});
    setCounters({});
    showToast(T("reset_counters_ok"));
  }

  async function clearAllData() {
    setShowClearConfirm(false);
    const KEYS = [
      "settings",
      "clients",
      "counters",
      "produits",
      "marchandise",
      "historique",
      "stock",
      "stock_movements",
      "purchase_orders",
    ];
    await Promise.all(
      KEYS.map((k) =>
        window.api.storeSet(
          k,
          k === "counters" ? {} : k === "settings" ? {} : [],
        ),
      ),
    );
    setCounters({});
    showToast(T("clear_all_ok"));
  }

  useEffect(() => {
    if (settings) {
      setForm({
        organisation: settings.organisation || "",
        proprietaire: settings.proprietaire || "",
        email: settings.email || "",
        adresse: settings.adresse || "",
        telephones: settings.telephones?.length ? settings.telephones : [""],
        rc: settings.rc || "",
        artImp: settings.artImp || "",
        nif: settings.nif || "",
        nis: settings.nis || "",
        couleur: settings.couleur || "#0f2044",
        couleurApp: settings.couleurApp || "#0f2044",
        logo: settings.logo || "",
        fontDoc: settings.fontDoc || "Arial",
      });
    }
  }, [settings]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  function setPhone(i, val) {
    const p = [...form.telephones];
    p[i] = val;
    set("telephones", p);
  }
  function addPhone() {
    set("telephones", [...form.telephones, ""]);
  }
  function removePhone(i) {
    set(
      "telephones",
      form.telephones.filter((_, idx) => idx !== i),
    );
  }

  // Auto-save debounce
  const saveTimeoutRef = useRef(null);
  function debouncedSave() {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      save();
    }, 800);
  }

  async function pickLogo() {
    const dataUrl = await window.api.pickImage();
    if (dataUrl) set("logo", dataUrl);
  }

  async function save() {
    const clean = {
      ...form,
      telephones: form.telephones.filter((p) => p.trim()),
    };
    await window.api.storeSet("settings", clean);
    await onSave();
    showToast(T("settings_saved"));
  }

  async function exportBackup() {
    const [s, clients, counters, produits, marchandise, historique] =
      await Promise.all([
        window.api.storeGet("settings", {}),
        window.api.storeGet("clients", []),
        window.api.storeGet("counters", {}),
        window.api.storeGet("produits", []),
        window.api.storeGet("marchandise", []),
        window.api.storeGet("historique", []),
      ]);
    const backup = {
      version: 2,
      exportedAt: new Date().toISOString(),
      settings: s,
      clients,
      counters,
      produits,
      marchandise,
      historique,
    };
    const json = JSON.stringify(backup, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    const filePath = await window.api.saveDialog({
      defaultName: `Invoy-sauvegarde-${date}.json`,
      filters: [{ name: T("backup_json_filter"), extensions: ["json"] }],
    });
    if (!filePath) return;
    const result = await window.api.exportBackupFile({ filePath, json });
    showToast(
      result?.success ? T("backup_exported") : T("export_error"),
      result?.success ? "success" : "error",
    );
  }

  function validateBackup(data) {
    if (!data || typeof data !== "object") return false;
    if (typeof data.version !== "string") return false;
    if (!data.settings || typeof data.settings !== "object") return false;
    if (
      data.settings.__proto__ &&
      Object.keys(data.settings.__proto__).length > 0
    )
      return false;
    if (data.clients != null && !Array.isArray(data.clients)) return false;
    if (data.counters != null && typeof data.counters !== "object")
      return false;
    if (data.produits != null && !Array.isArray(data.produits)) return false;
    if (data.marchandise != null && !Array.isArray(data.marchandise))
      return false;
    if (data.historique != null && !Array.isArray(data.historique))
      return false;
    if (data.clients && data.clients.length > 10000) return false;
    if (data.historique && data.historique.length > 50000) return false;
    for (const key of ["settings", "counters"]) {
      if (data[key]) {
        for (const k of Object.keys(data[key])) {
          if (k === "__proto__" || k === "constructor" || k === "prototype")
            return false;
        }
      }
    }
    return true;
  }

  async function importBackup() {
    const raw = await window.api.pickJson();
    if (!raw) return;
    let backup;
    try {
      backup = JSON.parse(raw);
    } catch {
      showToast(T("backup_json_error"), "error");
      return;
    }
    if (!validateBackup(backup)) {
      showToast(T("backup_invalid"), "error");
      return;
    }
    if (!confirm(T("backup_confirm"))) return;

    // Auto-backup current state before restore
    try {
      const current = {};
      for (const key of [
        "settings",
        "clients",
        "counters",
        "produits",
        "marchandise",
        "historique",
      ]) {
        current[key] = await window.api.storeGet(
          key,
          key === "settings" ? {} : [],
        );
      }
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const autoPath = `${ts}-invoy-auto-backup.json`;
      await window.api.exportBackupFile({
        filePath: autoPath,
        json: JSON.stringify({ version: "2.0.0", ...current }, null, 2),
      });
    } catch {
      /* best-effort, don't block restore */
    }

    await Promise.all([
      window.api.storeSet("settings", backup.settings || {}),
      window.api.storeSet("clients", backup.clients || []),
      window.api.storeSet("counters", backup.counters || {}),
      window.api.storeSet("produits", backup.produits || []),
      window.api.storeSet("marchandise", backup.marchandise || []),
      window.api.storeSet("historique", backup.historique || []),
    ]);
    await onSave();
    showToast(T("backup_imported"));
  }

  const appColor = form.couleurApp || "#0f2044";
  const docColor = form.couleur || "#0f2044";

  return (
    <div className="max-w-4xl mx-auto">
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
            {T("title_parametres")}
          </h1>
          <p className="text-slate-500 text-sm mt-1">{T("sub_parametres")}</p>
        </div>
        <button onClick={save} className="btn-primary">
          <Save size={16} /> {T("btn_save")}
        </button>
      </div>

      {/* Company Management */}
      <div className="card mb-6">
        <h2 className="section-title">{T("company_title")}</h2>
        <div className="flex items-center gap-3 mb-4">
          <select
            value={activeCompanyId || ""}
            onChange={(e) => setActiveCompanyId(Number(e.target.value))}
            className="form-input flex-1"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setShowAddCompany(true);
              setEditingCompany(null);
              setCompanyForm({
                name: "",
                adresse: "",
                telephone: "",
                nif: "",
                nis: "",
                agrement: "",
                rc: "",
              });
            }}
            className="btn-secondary text-sm"
          >
            <Plus size={14} /> {T("company_add")}
          </button>
        </div>

        {(showAddCompany || editingCompany) && (
          <div
            className="p-4 rounded-lg border"
            style={{
              borderColor: "var(--border-color)",
              background: "var(--bg-alt)",
            }}
          >
            <h3
              className="text-sm font-semibold mb-3"
              style={{ color: "var(--text-primary)" }}
            >
              {editingCompany ? T("btn_edit") : T("company_add")}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="form-label">{T("company_name")}</label>
                <input
                  className="form-input"
                  value={companyForm.name}
                  onChange={(e) =>
                    setCompanyForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Ex: Ma Société SARL"
                />
              </div>
              <div>
                <label className="form-label">{T("company_adresse")}</label>
                <input
                  className="form-input"
                  value={companyForm.adresse}
                  onChange={(e) =>
                    setCompanyForm((f) => ({ ...f, adresse: e.target.value }))
                  }
                  placeholder="Ex: 123 Rue Didouche Mourad, Alger"
                />
              </div>
              <div>
                <label className="form-label">{T("company_telephone")}</label>
                <input
                  className="form-input"
                  value={companyForm.telephone}
                  onChange={(e) =>
                    setCompanyForm((f) => ({ ...f, telephone: e.target.value }))
                  }
                  placeholder="Ex: +213 58 123 456"
                />
              </div>
              <div>
                <label className="form-label">{T("field_nif")}</label>
                <input
                  className="form-input"
                  value={companyForm.nif}
                  onChange={(e) =>
                    setCompanyForm((f) => ({ ...f, nif: e.target.value }))
                  }
                  placeholder="Ex: 1234567890123"
                />
              </div>
              <div>
                <label className="form-label">{T("field_nis")}</label>
                <input
                  className="form-input"
                  value={companyForm.nis}
                  onChange={(e) =>
                    setCompanyForm((f) => ({ ...f, nis: e.target.value }))
                  }
                  placeholder="Ex: 1234567890123"
                />
              </div>
              <div>
                <label className="form-label">{T("field_agrement")}</label>
                <input
                  className="form-input"
                  value={companyForm.agrement}
                  onChange={(e) =>
                    setCompanyForm((f) => ({ ...f, agrement: e.target.value }))
                  }
                  placeholder="Ex: AGR-2024-00123"
                />
              </div>
              <div>
                <label className="form-label">{T("field_rc")}</label>
                <input
                  className="form-input"
                  value={companyForm.rc}
                  onChange={(e) =>
                    setCompanyForm((f) => ({ ...f, rc: e.target.value }))
                  }
                  placeholder="Ex: 12/A/12345"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={async () => {
                  if (!companyForm.name.trim()) return;
                  if (editingCompany) {
                    await updateCompany(editingCompany.id, companyForm);
                    showToast(T("company_saved"));
                  } else {
                    await addCompany(companyForm.name);
                    showToast(T("company_added"));
                  }
                  setShowAddCompany(false);
                  setEditingCompany(null);
                }}
                className="btn-primary text-sm"
              >
                <Save size={14} /> {T("btn_save")}
              </button>
              <button
                onClick={() => {
                  setShowAddCompany(false);
                  setEditingCompany(null);
                }}
                className="btn-secondary text-sm"
              >
                {T("btn_cancel")}
              </button>
            </div>
          </div>
        )}

        {!showAddCompany && !editingCompany && companies.length > 0 && (
          <div className="space-y-2">
            {companies.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between px-4 py-2.5 rounded-lg"
                style={{
                  background:
                    c.id === activeCompanyId
                      ? appColor + "10"
                      : "var(--bg-alt)",
                  border:
                    c.id === activeCompanyId
                      ? `1px solid ${appColor}30`
                      : "1px solid var(--border-color)",
                }}
              >
                <div>
                  <span
                    className="font-medium text-sm"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {c.name}
                  </span>
                  {c.id === activeCompanyId && (
                    <span
                      className="ml-2 text-xs px-2 py-0.5 rounded-full"
                      style={{ background: appColor, color: "white" }}
                    >
                      {T("company_active")}
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditingCompany(c);
                      setCompanyForm({
                        name: c.name,
                        adresse: c.adresse || "",
                        telephone: c.telephone || "",
                        nif: c.nif || "",
                        nis: c.nis || "",
                        agrement: c.agrement || "",
                        rc: c.rc || "",
                      });
                    }}
                    className="text-xs px-2 py-1 rounded border transition-colors hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300"
                    style={{
                      color: "var(--text-secondary)",
                      borderColor: "var(--border-color)",
                    }}
                  >
                    {T("btn_edit")}
                  </button>
                  {c.id !== 1 && (
                    <button
                      onClick={async () => {
                        if (!confirm(T("company_delete_confirm"))) return;
                        await deleteCompany(c.id);
                        showToast(T("company_deleted"));
                      }}
                      className="text-xs px-2 py-1 rounded border transition-colors hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                      style={{
                        color: "var(--text-secondary)",
                        borderColor: "var(--border-color)",
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* App Theme */}
      <div className="card mb-6">
        <h2 className="section-title">{T("sec_app_theme")}</h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          {T("color_used_app")}
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {APP_THEMES.map((th) => (
            <button
              key={th.color}
              onClick={() => set("couleurApp", th.color)}
              title={lang === "ar" ? th.labelAr : th.label}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all"
              style={{
                borderColor:
                  form.couleurApp === th.color ? th.color : "#e2e8f0",
                background:
                  form.couleurApp === th.color
                    ? th.color + "22"
                    : "var(--bg-input)",
                color:
                  form.couleurApp === th.color
                    ? th.color
                    : "var(--text-secondary)",
              }}
            >
              <span
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ background: th.color }}
              />
              {lang === "ar" ? th.labelAr : th.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={form.couleurApp}
            onChange={(e) => set("couleurApp", e.target.value)}
            className="w-10 h-10 rounded cursor-pointer border border-slate-200"
          />
          <span className="text-sm text-slate-500 font-mono">
            {form.couleurApp}
          </span>
        </div>
      </div>

      {/* Logo + Doc color */}
      <div className="card mb-6">
        <h2 className="section-title">{T("sec_logo_color")}</h2>
        <div className="flex items-start gap-6">
          <div>
            <label className="form-label">{T("field_logo")}</label>
            <div className="flex items-center gap-3 mt-1">
              {form.logo ? (
                <img
                  src={form.logo}
                  alt="logo"
                  className="w-20 h-20 object-contain border border-slate-200 rounded-lg p-1"
                />
              ) : (
                <div className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400 text-xs text-center p-2">
                  {T("logo_none")}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <button onClick={pickLogo} className="btn-secondary text-sm">
                  {T("btn_choose_image")}
                </button>
                {form.logo && (
                  <button
                    onClick={() => set("logo", "")}
                    className="btn-danger text-xs"
                  >
                    <Trash2 size={12} /> {T("logo_delete")}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="form-label">{T("field_couleur_doc")}</label>
            <p className="text-xs text-slate-400 mb-2">
              {T("color_used_docs")}
            </p>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.couleur}
                onChange={(e) => set("couleur", e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-slate-200"
              />
              <div className="flex flex-col">
                <span
                  className="text-sm font-medium font-mono"
                  style={{ color: docColor }}
                >
                  {form.couleur}
                </span>
                <div className="mt-1 flex gap-1">
                  {[
                    "#0f2044",
                    "#1a4d2e",
                    "#7c1c1c",
                    "#2d4a6e",
                    "#4a1942",
                    "#1a3a2f",
                  ].map((c) => (
                    <button
                      key={c}
                      onClick={() => set("couleur", c)}
                      className="w-5 h-5 rounded border border-white shadow-sm"
                      style={{ background: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Font for documents */}
      <div className="card mb-6">
        <h2 className="section-title">{T("field_font_doc")}</h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          {T("font_hint")}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { name: "Arial", label: "Arial", subKey: "font_standard_label" },
            { name: "Calibri", label: "Calibri", subKey: "font_moderne_label" },
            {
              name: "Helvetica",
              label: "Helvetica",
              subKey: "font_elegant_label",
            },
            {
              name: "Inter",
              label: "Inter",
              subKey: "font_contemporain_label",
            },
            { name: "Roboto", label: "Roboto", subKey: "font_tech_label" },
            {
              name: "Times New Roman",
              label: "Times New Roman",
              subKey: "font_classique_label",
            },
          ].map((f) => (
            <button
              key={f.name}
              onClick={() => set("fontDoc", f.name)}
              className="p-3 rounded-lg border-2 text-left transition-all"
              style={{
                borderColor: form.fontDoc === f.name ? appColor : "#e2e8f0",
                background:
                  form.fontDoc === f.name ? appColor + "22" : "var(--bg-input)",
              }}
            >
              <div
                className="font-semibold text-sm"
                style={{
                  fontFamily: f.name,
                  color: form.fontDoc === f.name ? appColor : "#334155",
                }}
              >
                {f.label}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">{T(f.subKey)}</div>
              <div
                className="text-xs mt-1"
                style={{ fontFamily: f.name, color: "#64748b" }}
              >
                Abc 123
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="card mb-6">
        <h2 className="section-title">{T("sec_org")}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">{T("field_organisation")} *</label>
            <input
              className="form-input"
              value={form.organisation}
              onChange={(e) => set("organisation", e.target.value)}
              onBlur={debouncedSave}
              placeholder={T("org_placeholder")}
            />
          </div>
          <div>
            <label className="form-label">{T("field_proprietaire")}</label>
            <input
              className="form-input"
              value={form.proprietaire}
              onChange={(e) => set("proprietaire", e.target.value)}
              onBlur={debouncedSave}
              placeholder={T("owner_placeholder")}
            />
          </div>
          <div className="col-span-2">
            <label className="form-label">{T("field_adresse")}</label>
            <input
              className="form-input"
              value={form.adresse}
              onChange={(e) => set("adresse", e.target.value)}
              onBlur={debouncedSave}
              placeholder={T("address_placeholder")}
            />
          </div>
          <div>
            <label className="form-label">{T("field_email")}</label>
            <input
              type="email"
              className="form-input"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              onBlur={debouncedSave}
              placeholder={T("email_placeholder")}
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="form-label">{T("field_telephones")}</label>
          <div className="space-y-2">
            {form.telephones.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="form-input flex-1"
                  value={p}
                  onChange={(e) => setPhone(i, e.target.value)}
                  placeholder="Ex: +213 58 123 456"
                />
                {form.telephones.length > 1 && (
                  <button
                    onClick={() => removePhone(i)}
                    className="btn-danger p-2"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addPhone}
            className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
          >
            <Plus size={14} /> {T("btn_add_phone")}
          </button>
        </div>
      </div>

      {/* Fiscal */}
      <div className="card mb-6">
        <h2 className="section-title">{T("sec_fiscal_org")}</h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          {T("fiscal_hint")}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">{T("field_rc")}</label>
            <input
              className="form-input"
              value={form.rc}
              onChange={(e) => set("rc", e.target.value)}
              onBlur={debouncedSave}
              placeholder="Ex: 12/A/12345"
            />
          </div>
          <div>
            <label className="form-label">{T("field_art_imp")}</label>
            <input
              className="form-input"
              value={form.artImp}
              onChange={(e) => set("artImp", e.target.value)}
              onBlur={debouncedSave}
              placeholder="Ex: 123"
            />
          </div>
          <div>
            <label className="form-label">{T("field_nif")}</label>
            <input
              className="form-input"
              value={form.nif}
              onChange={(e) => set("nif", e.target.value)}
              onBlur={debouncedSave}
              placeholder="Ex: 1234567890123"
            />
          </div>
          <div>
            <label className="form-label">{T("field_nis")}</label>
            <input
              className="form-input"
              value={form.nis}
              onChange={(e) => set("nis", e.target.value)}
              onBlur={debouncedSave}
              placeholder="Ex: 1234567890123"
            />
          </div>
        </div>
      </div>

      {/* Backup */}
      <div className="card mb-6">
        <h2 className="section-title">{T("sec_backup")}</h2>
        <p className="text-sm text-slate-500 mb-5">{T("backup_hint")}</p>
        <div className="flex gap-3">
          <button
            onClick={exportBackup}
            className="btn-secondary flex-1 justify-center py-3"
          >
            <Download size={16} /> {T("btn_export_backup")}
          </button>
          <button
            onClick={importBackup}
            className="btn-secondary flex-1 justify-center py-3"
            style={{ borderColor: "#c9a327", color: "#b08c1e" }}
          >
            <Upload size={16} /> {T("btn_import_backup")}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-3">{T("backup_format_hint")}</p>
      </div>

      {/* Counters */}
      <div className="card mb-6">
        <h2 className="section-title flex items-center gap-2">
          <RotateCcw size={16} /> {T("counter_section_title")}
        </h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          {T("counter_hint")}
        </p>
        <div className="space-y-2 mb-4">
          {COUNTER_DOCS.map(({ key, labelKey }) => (
            <div
              key={key}
              className="flex items-center justify-between px-4 py-2.5 rounded-lg"
              style={{
                background: "var(--bg-alt)",
                border: "1px solid var(--border-color)",
              }}
            >
              <div>
                <span
                  className="font-medium text-sm"
                  style={{ color: "var(--text-primary)" }}
                >
                  {T(labelKey)}
                </span>
                <span
                  className="ml-3 text-xs font-mono px-2 py-0.5 rounded"
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text-secondary)",
                  }}
                >
                  N° {String((counters[key] || 0) + 1).padStart(4, "0")}{" "}
                  {T("counter_next")}
                </span>
              </div>
              <button
                onClick={() => resetOneCounter(key)}
                className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg border transition-colors hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300"
                style={{
                  color: "var(--text-secondary)",
                  borderColor: "var(--border-color)",
                }}
              >
                <RotateCcw size={12} /> {T("reset")}
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={resetAllCounters}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-colors hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300"
          style={{
            color: "var(--text-secondary)",
            borderColor: "var(--border-color)",
          }}
        >
          <RotateCcw size={14} /> {T("btn_reset_counters")}
        </button>
      </div>

      {/* Danger zone */}
      <div
        className="card mb-6"
        style={{ borderColor: "#ef4444", border: "1.5px solid #ef4444" }}
      >
        <button
          onClick={() => setDangerCollapsed(!dangerCollapsed)}
          className="w-full flex items-center justify-between cursor-pointer"
        >
          <h2
            className="section-title flex items-center gap-2"
            style={{ color: "#ef4444" }}
          >
            <AlertTriangle size={16} /> {T("sec_danger")}
          </h2>
          {dangerCollapsed ? (
            <ChevronRight
              size={18}
              style={{ color: "#ef4444", transition: "transform 0.25s ease" }}
            />
          ) : (
            <ChevronDown
              size={18}
              style={{ color: "#ef4444", transition: "transform 0.25s ease" }}
            />
          )}
        </button>
        <div
          style={{
            display: "grid",
            gridTemplateRows: dangerCollapsed ? "0fr" : "1fr",
            transition: "grid-template-rows 0.25s ease",
          }}
        >
          <div style={{ overflow: "hidden" }}>
            <p
              className="text-sm mb-4 mt-3"
              style={{ color: "var(--text-secondary)" }}
            >
              {T("clear_all_hint")}
            </p>

            {!showClearConfirm ? (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: "#dc2626", color: "white" }}
              >
                <Trash2 size={14} /> {T("btn_clear_all")}
              </button>
            ) : (
              <div
                className="p-4 rounded-lg"
                style={{
                  border: "1px solid #ef4444",
                  background: "var(--bg-alt)",
                }}
              >
                <p
                  className="text-sm font-semibold mb-3"
                  style={{ color: "#ef4444" }}
                >
                  {T("clear_all_confirm")}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={clearAllData}
                    className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors"
                  >
                    {T("confirm_delete_all")}
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
                    style={{
                      color: "var(--text-secondary)",
                      borderColor: "var(--border-color)",
                    }}
                  >
                    {T("cancel")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
