import { numberToWordsFR, numberToWordsAR } from "./numberToWords";
import { translations } from "./i18n";
import { fromCents, toCents, calcTva, calcTimbreCents } from "./money";

function pdfT(lang, key) {
  const dict = translations[lang] || translations.fr;
  return dict[key] ?? translations.fr[key] ?? key;
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "\u0026\u0061\u006d\u0070\u003b")
    .replace(/</g, "\u0026\u006c\u0074\u003b")
    .replace(/>/g, "\u0026\u0067\u0074\u003b")
    .replace(/"/g, "\u0026\u0071\u0075\u006f\u0074\u003b")
    .replace(/'/g, "\u0026\u0023\u0033\u0039\u003b");
}

function escapeAttr(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "\u0026\u0061\u006d\u0070\u003b")
    .replace(/"/g, "\u0026\u0071\u0075\u006f\u0074\u003b")
    .replace(/'/g, "\u0026\u0023\u0033\u0039\u003b")
    .replace(/</g, "\u0026\u006c\u0074\u003b")
    .replace(/>/g, "\u0026\u0067\u0074\u003b");
}

function escapeCss(s) {
  if (s == null) return "";
  // Allow spaces (multi-word font names); strip CSS injection chars (quotes,
  // backslash, braces, semicolons, parens).
  return String(s).replace(/[^a-zA-Z0-9#\-_.%\s]/g, "");
}

function fmtCents(cents, d = 2) {
  return fromCents(cents, d);
}

function parseAmount(value) {
  return toCents(value);
}

function fmtDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toLocaleDateString("fr-DZ");
  return dateStr;
}

function baseStyles(
  primaryColor = "#0f2044",
  fontFamily = "Arial",
  pageSize = "A4",
) {
  const isA5 = pageSize === "A5";
  const bodyFontSize = isA5 ? "10.5px" : "11px";
  const pageMargin = isA5 ? "8mm 8mm" : "18mm 16mm";
  const safePrimary = escapeCss(primaryColor);
  const safeFont = escapeCss(fontFamily);
  return `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      @page { size: ${escapeCss(pageSize)}; margin: ${pageMargin}; }
      body { font-family: "${safeFont}", Arial, sans-serif; font-size: ${bodyFontSize}; color: #111; background: #fff; }
      .doc { max-width: 100%; }
      .header-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
      .header-logo { width: ${isA5 ? "80px" : "100px"}; vertical-align: top; }
      .header-logo img { max-width: ${isA5 ? "70px" : "90px"}; max-height: ${isA5 ? "70px" : "90px"}; object-fit: contain; }
      .header-info { vertical-align: top; padding-left: ${isA5 ? "10px" : "14px"}; }
      .org-name { font-size: ${isA5 ? "16px" : "18px"}; font-weight: bold; color: ${safePrimary}; white-space: normal; word-break: break-word; font-variant-ligatures: none; }
      .org-sub { font-size: ${isA5 ? "10px" : "11px"}; color: #555; margin-top: 2px; white-space: pre-wrap; word-break: break-word; font-variant-ligatures: none; }
      .fiscal-line { font-size: ${isA5 ? "9px" : "10px"}; color: #666; margin-top: ${isA5 ? "4px" : "6px"}; word-break: break-word; }
      hr.divider { border: none; border-top: 2.5px solid ${safePrimary}; margin: ${isA5 ? "7px 0" : "10px 0"}; }
      .doc-title { text-align: center; font-size: ${isA5 ? "15px" : "18px"}; font-weight: bold; color: ${safePrimary}; margin: ${isA5 ? "6px 0 2px" : "8px 0 2px"}; }
      .doc-subtitle { text-align: center; font-size: ${isA5 ? "10px" : "11px"}; color: #666; margin-bottom: ${isA5 ? "10px" : "14px"}; }
      .client-block { background: #f8f9fd; border: 1px solid #e0e4f0; border-radius: 6px; padding: ${isA5 ? "7px 11px" : "10px 14px"}; margin-bottom: ${isA5 ? "10px" : "14px"}; }
      .client-title { font-size: ${isA5 ? "10px" : "11px"}; font-weight: bold; color: ${safePrimary}; margin-bottom: ${isA5 ? "5px" : "6px"}; text-transform: uppercase; letter-spacing: 0.5px; }
      .client-row { display: flex; margin-bottom: ${isA5 ? "2px" : "3px"}; flex-wrap: wrap; align-items: baseline; }
      .client-label { font-weight: bold; color: #555; width: ${isA5 ? "120px" : "155px"}; min-width: ${isA5 ? "120px" : "155px"}; font-size: ${isA5 ? "10px" : "10.5px"}; white-space: nowrap; }
      .client-value { font-size: ${isA5 ? "10.5px" : "11px"}; }
      table.items { width: 100%; border-collapse: collapse; margin-bottom: ${isA5 ? "10px" : "14px"}; }
      table.items th { background: ${safePrimary}; color: white; font-size: ${isA5 ? "10px" : "10.5px"}; font-weight: bold; padding: ${isA5 ? "5px 6px" : "7px 8px"}; }
      table.items td { padding: ${isA5 ? "5px 6px" : "6px 8px"}; font-size: ${isA5 ? "10.5px" : "11px"}; border-bottom: 1px solid #e8ecf4; }
      table.items tr:nth-child(even) td { background: #f4f6fb; }
      .text-right { text-align: right; }
      .text-center { text-align: center; }
      .totals-table { width: 100%; border-collapse: collapse; margin-top: ${isA5 ? "6px" : "8px"}; }
      .totals-table td { padding: ${isA5 ? "4px 8px" : "5px 10px"}; font-size: ${isA5 ? "10.5px" : "11px"}; }
      .totals-label { text-align: right; font-weight: 500; color: #444; width: ${isA5 ? "150px" : "180px"}; }
      .totals-value { text-align: right; width: ${isA5 ? "120px" : "150px"}; }
      .totals-highlight td { background: #eef2fa; font-weight: bold; color: ${safePrimary}; font-size: ${isA5 ? "11px" : "12px"}; border-top: 1.5px solid ${safePrimary}; }
      .arrete { border-top: 1px solid #dde; margin-top: ${isA5 ? "10px" : "14px"}; padding-top: ${isA5 ? "7px" : "10px"}; font-size: ${isA5 ? "10px" : "11px"}; line-height: 1.6; }
      .arrete strong { color: ${safePrimary}; }
      .cordialement { text-align: right; margin-top: ${isA5 ? "24px" : "40px"}; font-size: ${isA5 ? "10px" : "11px"}; line-height: 1.8; }
      .owner-name { font-weight: bold; font-size: ${isA5 ? "11px" : "12px"}; margin-top: 6px; white-space: pre-wrap; word-break: break-word; font-variant-ligatures: none; }
      .section-label { font-size: ${isA5 ? "10px" : "11px"}; font-weight: bold; color: ${safePrimary}; margin-bottom: ${isA5 ? "5px" : "6px"}; text-transform: uppercase; letter-spacing: 0.5px; }
      .notes-block { background: #fafafa; border: 1px solid #e8ecf4; border-radius: 5px; padding: ${isA5 ? "6px 10px" : "8px 12px"}; margin: ${isA5 ? "6px 0" : "8px 0"}; font-size: ${isA5 ? "10.5px" : "11px"}; }
      .versement-row td { background: ${safePrimary}; color: white; font-weight: bold; font-size: ${isA5 ? "12px" : "13px"}; }
      .mode-reglement-box { display: inline-block; border: 1.5px solid ${safePrimary}; border-radius: 6px; padding: ${isA5 ? "5px 12px" : "8px 20px"}; }
      .mode-reglement-label { font-size: ${isA5 ? "8px" : "10px"}; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
      .mode-reglement-value { font-size: ${isA5 ? "11px" : "13px"}; font-weight: bold; color: ${safePrimary}; }
      .total-badge { font-weight: bold; }
      .total-badge.primary { color: ${safePrimary}; }
      .hr-hr { border: none; border-top: 2.5px solid ${safePrimary}; }
    </style>
  `;
}

function headerHtml(
  settings,
  title,
  subtitle,
  showFiscal = false,
  pageSize = "A4",
) {
  const isA5 = pageSize === "A5";
  const logoHtml = settings.logo
    ? `<img src="${escapeAttr(settings.logo)}" alt="logo" />`
    : "";
  const fiscalParts = [];
  if (settings.rc) fiscalParts.push(`RC N\u00b0: ${escapeHtml(settings.rc)}`);
  if (settings.artImp)
    fiscalParts.push(`Art.Imp: ${escapeHtml(settings.artImp)}`);
  if (settings.nif) fiscalParts.push(`NIF: ${escapeHtml(settings.nif)}`);
  if (settings.nis) fiscalParts.push(`NIS: ${escapeHtml(settings.nis)}`);

  const phones = (settings.telephones || []).map(escapeHtml).join(" / ");

  return `
    <table class="header-table">
      <tr>
        <td class="header-logo">${logoHtml}</td>
        <td class="header-info">
          <div class="org-name"><span dir="auto">${escapeHtml(settings.organisation || "")}</span></div>
          ${settings.proprietaire ? `<div class="org-sub"><span dir="auto">${escapeHtml(settings.proprietaire)}</span></div>` : ""}
          ${settings.adresse ? `<div class="org-sub">${escapeHtml(settings.adresse)}</div>` : ""}
          ${phones ? `<div class="org-sub">T\u00e9l: ${phones}</div>` : ""}
          ${settings.email ? `<div class="org-sub">Email: ${escapeHtml(settings.email)}</div>` : ""}
          ${showFiscal && fiscalParts.length ? `<div class="fiscal-line">${fiscalParts.join(isA5 ? " | " : "   |   ")}</div>` : ""}
        </td>
      </tr>
    </table>
    <hr class="divider hr-hr" />
    <div class="doc-title">${escapeHtml(title)}</div>
    ${subtitle ? `<div class="doc-subtitle">${escapeHtml(subtitle)}</div>` : ""}
  `;
}

function clientHtml(client, showFiscal = false) {
  const phones = (client.telephones || []).filter(Boolean);
  if (!phones.length && client.telephone) phones.push(client.telephone);
  const phoneStr = phones.join(" / ");

  const rows = [
    ["Nom :", client.nom],
    ["Adresse :", client.adresse],
    ["T\u00e9l :", phoneStr || null],
    ...(showFiscal
      ? [
          ["Agr\u00e9ment :", client.agrement],
          ["N\u00b0 d'identification fiscale :", client.nif],
          ["N\u00b0 d'articles :", client.articlesImp],
          ["NIS :", client.nis],
        ]
      : []),
  ].filter(([, v]) => v);

  const rowsHtml = rows
    .map(
      ([l, v]) =>
        `<div class="client-row"><span class="client-label">${l}</span><span class="client-value" dir="auto">${escapeHtml(v)}</span></div>`,
    )
    .join("");

  return `
    <div class="client-block">
      <div class="client-title">Informations client</div>
      ${rowsHtml}
    </div>
  `;
}

function itemsTableHtml(articles, lang = "fr") {
  const rows = (articles || [])
    .map((a, i) => {
      const qty = parseAmount(a.quantite);
      const pu = parseAmount(a.prixUnitaire);
      const montant = parseAmount(a.montant) || Math.round((qty * pu) / 100);
      return `<tr>
      <td class="text-center">${i + 1}</td>
      <td dir="auto">${escapeHtml(a.designation || "")}</td>
      <td class="text-center">${fmtCents(qty, 0)}</td>
      <td class="text-right">${fmtCents(pu)}</td>
      <td class="text-right">${fmtCents(montant)}</td>
    </tr>`;
    })
    .join("");

  return `
    <table class="items">
      <thead><tr>
        <th style="width:40px; text-align:center">N\u00b0</th>
        <th style="text-align:left">${pdfT(lang, "pdf_designation_col")}</th>
        <th style="width:80px; text-align:center">${pdfT(lang, "pdf_quantite_col")}</th>
        <th style="width:110px; text-align:right">${pdfT(lang, "pdf_prix_unitaire_col")}</th>
        <th style="width:120px; text-align:right">${pdfT(lang, "pdf_montant_da_col")}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export function buildFacturePdf(data, settings) {
  const {
    client = {},
    articles = [],
    totaux = {},
    date,
    numero,
    modeReglement = "espece",
    docTitle = "FACTURE PROFORMA",
    showArrete = true,
    showModeReglement = true,
    pageSize = "A4",
  } = data;
  const primary = settings.couleur || "#0f2044";
  const fontFamily = settings.fontDoc || "Arial";
  const lang = settings.langue || "fr";
  const subtitle = `N\u00b0 ${numero || "____"}   &nbsp;|&nbsp;   Date: ${fmtDate(date)}`;
  const ttcWords = (lang === "ar" ? numberToWordsAR : numberToWordsFR)(
    (totaux.ttc || 0) / 100,
  );

  const modeReg =
    modeReglement === "cheque"
      ? pdfT(lang, "pdf_cheque")
      : pdfT(lang, "pdf_espece");

  const totauxRows = [
    `
    <tr><td></td><td class="totals-label">${pdfT(lang, "total_ht")}</td><td class="totals-value">${fmtCents(totaux.ht)} DA</td></tr>
    ${totaux.tvaEnabled && totaux.tva > 0 ? `<tr><td></td><td class="totals-label">${pdfT(lang, "total_tva")} (${totaux.tvaTaux}%)</td><td class="totals-value">${fmtCents(totaux.tva)} DA</td></tr>` : ""}
    ${totaux.timbreEnabled && totaux.timbre > 0 ? `<tr><td></td><td class="totals-label">${pdfT(lang, "pdf_droit_timbre")}</td><td class="totals-value">${fmtCents(totaux.timbre)} DA</td></tr>` : ""}
    <tr class="totals-highlight"><td></td><td class="totals-label">${pdfT(lang, "total_ttc")}</td><td class="totals-value">${fmtCents(totaux.ttc)} DA</td></tr>
  `,
  ];

  return `<!DOCTYPE html><html lang="${escapeAttr(lang)}"><head><meta charset="UTF-8">${baseStyles(primary, fontFamily, pageSize)}</head><body>
    <div class="doc">
      ${headerHtml(settings, docTitle, subtitle, true, pageSize)}
      ${clientHtml(client, true)}
      <div class="section-label">${pdfT(lang, "pdf_designation_articles")}</div>
      ${itemsTableHtml(articles, lang)}
      <table class="totals-table"><tbody>${totauxRows.join("")}</tbody></table>
      ${
        showArrete
          ? `<div class="arrete">
        ${pdfT(lang, "pdf_arrete_facture")}<br>
        <strong>${escapeHtml(ttcWords.toUpperCase())}</strong>
      </div>`
          : ""
      }
      <div class="footer-flex" style="margin-top:${pageSize === "A5" ? "20px" : "40px"};">
        ${
          showModeReglement
            ? `<div class="mode-reglement-box">
          <div class="mode-reglement-label">${pdfT(lang, "pdf_mode_reglement")}</div>
          <div class="mode-reglement-value">${escapeHtml(modeReg)}</div>
        </div>`
            : "<div></div>"
        }
        <div class="cordialement" style="margin-top:0;">
          ${pdfT(lang, "pdf_reglement")}<br>
          ${pdfT(lang, "pdf_cordialement")}<br>
          ${settings.proprietaire ? `<div class="owner-name"><span dir="auto">${escapeHtml(settings.proprietaire)}</span></div>` : ""}
        </div>
      </div>
    </div>
  </body></html>`;
}

export function buildBonLivraisonPdf(data, settings) {
  const {
    client = {},
    articles = [],
    total = 0,
    date,
    numero,
    pageSize = "A4",
  } = data;
  const primary = settings.couleur || "#0f2044";
  const fontFamily = settings.fontDoc || "Arial";
  const lang = settings.langue || "fr";
  const subtitle = `N\u00b0 ${numero || "____"}   &nbsp;|&nbsp;   Date: ${fmtDate(date)}`;

  return `<!DOCTYPE html><html lang="${escapeAttr(lang)}"><head><meta charset="UTF-8">${baseStyles(primary, fontFamily, pageSize)}</head><body>
    <div class="doc">
      ${headerHtml(settings, lang === "ar" ? "\u0633\u0646\u062f \u0627\u0644\u062a\u0633\u0644\u064a\u0645" : "BON DE LIVRAISON", subtitle, true, pageSize)}
      ${clientHtml(client, false)}
      <div class="section-label">${pdfT(lang, "pdf_articles_livres")}</div>
      ${itemsTableHtml(articles, lang)}
      <table class="totals-table"><tbody>
        <tr class="totals-highlight"><td></td><td class="totals-label">${pdfT(lang, "pdf_total_label")}</td><td class="totals-value">${fmtCents(total)} DA</td></tr>
      </tbody></table>
    </div>
  </body></html>`;
}

export function buildBonVersementPdf(data, settings) {
  const {
    client = {},
    articles = [],
    total = 0,
    montantVerse = 0,
    notes = "",
    date,
    numero,
    pageSize = "A4",
  } = data;
  const primary = settings.couleur || "#0f2044";
  const fontFamily = settings.fontDoc || "Arial";
  const lang = settings.langue || "fr";
  const subtitle = `N\u00b0 ${numero || "____"}   &nbsp;|&nbsp;   Date: ${fmtDate(date)}`;

  return `<!DOCTYPE html><html lang="${escapeAttr(lang)}"><head><meta charset="UTF-8">${baseStyles(primary, fontFamily, pageSize)}</head><body>
    <div class="doc">
      ${headerHtml(settings, lang === "ar" ? "\u0633\u0646\u062f \u0627\u0644\u062f\u0641\u0639" : "BON DE VERSEMENT", subtitle, false, pageSize)}
      ${clientHtml(client, false)}
      <div class="section-label">${pdfT(lang, "pdf_articles")}</div>
      ${itemsTableHtml(articles, lang)}
      <table class="totals-table"><tbody>
        <tr><td></td><td class="totals-label">${pdfT(lang, "pdf_total_facture")}</td><td class="totals-value">${fmtCents(total)} DA</td></tr>
        <tr class="versement-row"><td></td><td class="totals-label">${pdfT(lang, "pdf_montant_verse")}</td><td class="totals-value">${fmtCents(montantVerse)} DA</td></tr>
      </tbody></table>
      ${notes ? `<div class="notes-block" dir="auto"><strong>${pdfT(lang, "pdf_notes_label")}</strong><br>${escapeHtml(notes)}</div>` : ""}
    </div>
  </body></html>`;
}

export function buildProgrammePdf(data, settings) {
  const { date, clients = [], pageSize = "A4" } = data;
  const primary = settings.couleur || "#0f2044";
  const fontFamily = settings.fontDoc || "Arial";
  const lang = settings.langue || "fr";
  const isA5 = pageSize === "A5";
  const titleFs = isA5 ? "12px" : "13px";
  const infoFs = isA5 ? "10px" : "10.5px";
  const horaireFs = isA5 ? "11px" : "12px";

  const clientsHtml = (clients || [])
    .map((cl, idx) => {
      const clTotal = (cl.articles || []).reduce((s, a) => {
        const qty = parseAmount(a.quantite);
        const pu = parseAmount(a.prixUnitaire);
        return s + (parseAmount(a.montant) || Math.round((qty * pu) / 100));
      }, 0);

      const horaireStr =
        cl.horaireDE || cl.horaireA
          ? `${escapeHtml(cl.horaireDE || "?")} \u2014 ${escapeHtml(cl.horaireA || "?")}`
          : "";

      const infoLine = [
        cl.telephone ? `T\u00e9l: ${escapeHtml(cl.telephone)}` : "",
        escapeHtml(cl.adresse || ""),
      ]
        .filter(Boolean)
        .join("&nbsp;&nbsp;|&nbsp;&nbsp;");

      return `
      ${idx > 0 ? '<div style="page-break-before:always"></div>' : ""}
      <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <strong class="total-badge primary" style="font-size:${titleFs}" dir="auto">${idx + 1}. ${escapeHtml(cl.nom || "Client")}</strong>
          ${infoLine ? `<div style="color:#666;font-size:${infoFs};margin-top:2px" dir="auto">${infoLine}</div>` : ""}
        </div>
        ${
          horaireStr
            ? `
          <div class="horaire-box" style="border:1.5px solid ${escapeCss(primary)};border-radius:5px;padding:4px 12px;text-align:center;">
            <div style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:0.4px;">Horaire</div>
            <div style="font-size:${horaireFs};font-weight:bold;color:${escapeCss(primary)};">${horaireStr}</div>
          </div>`
            : ""
        }
      </div>
      ${itemsTableHtml(cl.articles || [], lang)}
      <div class="client-total" style="text-align:right;font-weight:bold;color:${escapeCss(primary)};margin-bottom:${isA5 ? "12px" : "20px"}">
        ${pdfT(lang, "pdf_total_client")} ${fmtCents(clTotal)} DA
      </div>
    `;
    })
    .join("");

  return `<!DOCTYPE html><html lang="${escapeAttr(lang)}"><head><meta charset="UTF-8">${baseStyles(primary, fontFamily, pageSize)}</head><body>
    <div class="doc">
      ${headerHtml(settings, lang === "ar" ? "\u0628\u0631\u0646\u0627\u0645\u062c \u0627\u0644\u062a\u0648\u0632\u064a\u0639" : "PROGRAMME DE LIVRAISON", "", false, pageSize)}
      <div style="margin-bottom:${isA5 ? "10px" : "14px"}">
        ${date ? `<div><strong>${pdfT(lang, "pdf_date_livraison")}</strong> ${fmtDate(date)}</div>` : ""}
      </div>
      ${clientsHtml}
    </div>
  </body></html>`;
}

export function buildMarchandisePdf(data, settings) {
  const { date, numero, produits = [] } = data;
  const primary = settings.couleur || "#0f2044";
  const fontFamily = settings.fontDoc || "Arial";
  const lang = settings.langue || "fr";
  const subtitle = `N\u00b0 ${numero || "____"}   &nbsp;|&nbsp;   Date: ${fmtDate(date)}`;

  const rows = produits
    .map(
      (p, i) => `
    <tr>
      <td class="text-center">${i + 1}</td>
      <td>${escapeHtml(p.designation || "")}</td>
      <td class="text-center">${escapeHtml(p.quantite || "")}</td>
      <td>${escapeHtml(p.description || "")}</td>
      <td>${escapeHtml(p.lieuAchat || "")}</td>
    </tr>
  `,
    )
    .join("");

  return `<!DOCTYPE html><html lang="${escapeAttr(lang)}"><head><meta charset="UTF-8">${baseStyles(primary, fontFamily)}</head><body>
    <div class="doc">
      ${headerHtml(settings, lang === "ar" ? "\u0648\u062b\u064a\u0642\u0629 \u0627\u0644\u0628\u0636\u0627\u0639\u0629" : "BON DE MARCHANDISE", subtitle)}
      <div class="section-label">${pdfT(lang, "pdf_liste_produits")}</div>
      <table class="items">
        <thead><tr>
          <th style="width:40px">N\u00b0</th>
          <th style="text-align:left">${pdfT(lang, "pdf_designation_col")}</th>
          <th style="width:70px">${pdfT(lang, "pdf_quantite_col")}</th>
          <th style="text-align:left">${lang === "ar" ? "\u0627\u0644\u0648\u0635\u0641" : "Description"}</th>
          <th style="text-align:left;width:130px">${lang === "ar" ? "\u0645\u0643\u0627\u0646 \u0627\u0644\u0634\u0631\u0627\u0621" : "Lieu d'achat"}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </body></html>`;
}
