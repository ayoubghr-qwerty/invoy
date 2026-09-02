import { t } from "./i18n";
import { toCents, isPositiveCents } from "./money";

export function validateDoc({ client, articles, lang = "fr" }) {
  const T = (key) => t(lang, key);
  const errors = [];

  if (!client?.nom?.trim()) {
    errors.push(T("validation_client_nom_required"));
  }

  if (!articles || articles.length === 0) {
    errors.push(T("validation_articles_required"));
    return { valid: false, errors };
  }

  articles.forEach((a, i) => {
    if (!a.designation?.trim()) {
      errors.push(
        `${T("validation_article_designation_required")} (ligne ${i + 1})`,
      );
    }
    if (!isPositiveCents(a.quantite)) {
      errors.push(`${T("validation_article_qty_positive")} (ligne ${i + 1})`);
    }
    if (!isPositiveCents(a.prixUnitaire)) {
      errors.push(`${T("validation_article_pu_positive")} (ligne ${i + 1})`);
    }
  });

  return { valid: errors.length === 0, errors };
}
