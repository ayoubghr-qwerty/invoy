import { useEffect } from "react";
import { t } from "../utils/i18n";
import { useKeyboardActions } from "./KeyboardActionsContext";

const SHORTCUTS = [
  {
    key: "1",
    ctrl: true,
    action: "facture",
    label: { fr: "Facture", ar: "فاتورة" },
  },
  {
    key: "2",
    ctrl: true,
    action: "clients",
    label: { fr: "Clients", ar: "العملاء" },
  },
  {
    key: "3",
    ctrl: true,
    action: "programme",
    label: { fr: "Programme", ar: "جدول" },
  },
  {
    key: "4",
    ctrl: true,
    action: "livraison",
    label: { fr: "Livraison", ar: "تسليم" },
  },
  {
    key: "5",
    ctrl: true,
    action: "versement",
    label: { fr: "Versement", ar: "صرف" },
  },
  {
    key: "6",
    ctrl: true,
    action: "marchandise",
    label: { fr: "Marchandise", ar: "بضائع" },
  },
  {
    key: "7",
    ctrl: true,
    action: "produits",
    label: { fr: "Produits", ar: "منتجات" },
  },
  {
    key: "8",
    ctrl: true,
    action: "parametres",
    label: { fr: "Paramètres", ar: "إعدادات" },
  },
  {
    key: "d",
    ctrl: true,
    action: "toggle_dark",
    label: { fr: "Mode sombre", ar: "الوضع الداكن" },
  },
  {
    key: "l",
    ctrl: true,
    action: "toggle_lang",
    label: { fr: "Changer langue", ar: "تغيير اللغة" },
  },
  {
    key: "s",
    ctrl: true,
    action: "save",
    label: { fr: "Enregistrer", ar: "حفظ" },
  },
  {
    key: "p",
    ctrl: true,
    action: "print",
    label: { fr: "Imprimer", ar: "طباعة" },
  },
  { key: "n", ctrl: true, action: "new", label: { fr: "Nouveau", ar: "جديد" } },
];

export function useKeyboardShortcuts({
  setPage,
  setDarkMode,
  setLang,
  lang,
  showToast,
}) {
  const { actions } = useKeyboardActions();
  const currentPage = Object.keys(actions).find((key) => actions[key]) || null;
  useEffect(() => {
    function handleKeyDown(e) {
      // Escape key - close modal (no ctrl required)
      if (e.key === "Escape") {
        const pageActions = actions[currentPage];
        if (pageActions?.close) {
          e.preventDefault();
          pageActions.close();
          return;
        }
      }

      // Ctrl+Key shortcuts
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;

      const shortcut = SHORTCUTS.find(
        (s) =>
          s.key.toLowerCase() === e.key.toLowerCase() && (s.ctrl || s.meta),
      );

      if (!shortcut) return;
      e.preventDefault();

      if (shortcut.action === "toggle_dark") {
        setDarkMode((d) => !d);
        showToast(
          `${t(lang, "shortcut_toast").replace("{action}", shortcut.label[lang])}`,
        );
      } else if (shortcut.action === "toggle_lang") {
        setLang((l) => (l === "fr" ? "ar" : "fr"));
        showToast(
          `${t(lang, "shortcut_toast").replace("{action}", shortcut.label[lang])}`,
        );
      } else if (shortcut.action === "save") {
        const pageActions = actions[currentPage];
        if (pageActions?.save) {
          pageActions.save();
          showToast(
            `${t(lang, "shortcut_toast").replace("{action}", shortcut.label[lang])}`,
          );
        }
      } else if (shortcut.action === "print") {
        const pageActions = actions[currentPage];
        if (pageActions?.print) {
          pageActions.print();
          showToast(
            `${t(lang, "shortcut_toast").replace("{action}", shortcut.label[lang])}`,
          );
        }
      } else if (shortcut.action === "new") {
        const pageActions = actions[currentPage];
        if (pageActions?.new) {
          pageActions.new();
          showToast(
            `${t(lang, "shortcut_toast").replace("{action}", shortcut.label[lang])}`,
          );
        }
      } else {
        setPage(shortcut.action);
        showToast(
          `${t(lang, "shortcut_toast").replace("{action}", shortcut.label[lang])}`,
        );
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setPage, setDarkMode, setLang, lang, showToast, actions, currentPage]);
}
