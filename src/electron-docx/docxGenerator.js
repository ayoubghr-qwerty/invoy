/**
 * DOCX document generator — browser (ESM) port of the original
 * `electron/docxGenerator.cjs`.
 *
 * The layout logic, CSS-less OOXML construction and document type builders are
 * kept byte-for-byte identical to the Electron version so DOCX output (and its
 * colours / fonts) is unchanged. Only the Node-specific parts differ:
 *   - `require('docx')`      → ESM named imports (same names)
 *   - `require('./numberToWords.cjs')` → `../utils/numberToWords.js`
 *   - `Buffer.from(base64)`  → browser `atob` + Uint8Array
 *   - returns a Uint8Array (not a Node Buffer) via `Packer.toBuffer`
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  VerticalAlign,
  TabStopType,
  TabStopPosition,
  PageBreak,
  Header,
  Footer,
  PageNumber,
} from "docx";
import { numberToWordsFR } from "../utils/numberToWords.js";
import { fromCents } from "../utils/money.js";

// Convert cents (integer) to formatted dinars string for DOCX display.
// Convention: pages pass totaux/total/montantVerse in CENTS; article row
// fields (quantite/prixUnitaire/montant) stay in dinars and are NOT converted.
function fmtDinars(cents, decimals = 2) {
  return fromCents(cents, decimals);
}

// ─── Page size constants (DXA: 1440 = 1 inch) ───────────────
const A4_W = 11906;
const A4_H = 16838;
const A5_W = 8391;
const A5_H = 11906;
const MARGIN_A4 = 1000; // ~17.6mm
const MARGIN_A5 = 800; // ~14.1mm
const CW_A4 = A4_W - MARGIN_A4 * 2; // 9906
const CW_A5 = A5_W - MARGIN_A5 * 2; // 6791

function getPageDims(pageSize) {
  if (pageSize === "A5")
    return { w: A5_W, h: A5_H, margin: MARGIN_A5, contentW: CW_A5, isA5: true };
  return { w: A4_W, h: A4_H, margin: MARGIN_A4, contentW: CW_A4, isA5: false };
}

// Font scale: A5 uses 85% of A4 sizes
function sc(size, isA5) {
  return isA5 ? Math.round(size * 0.85) : size;
}

// ─── Helpers ────────────────────────────────────────────────

function noBorder() {
  const n = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: n, bottom: n, left: n, right: n };
}

function thinBorder(color = "CCCCCC") {
  const b = { style: BorderStyle.SINGLE, size: 1, color };
  return {
    top: b,
    bottom: b,
    left: b,
    right: b,
    insideHorizontal: b,
    insideVertical: b,
  };
}

function noTableBorder() {
  const n = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return {
    top: n,
    bottom: n,
    left: n,
    right: n,
    insideHorizontal: n,
    insideVertical: n,
  };
}

function cell(children, opts = {}) {
  return new TableCell({
    children: Array.isArray(children) ? children : [children],
    borders: opts.borders || thinBorder(),
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.shading || undefined,
    verticalAlign: opts.vAlign || VerticalAlign.TOP,
    margins: opts.margins || { top: 80, bottom: 80, left: 120, right: 120 },
    columnSpan: opts.span || undefined,
    rowSpan: opts.rowSpan || undefined,
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    alignment: opts.align || AlignmentType.LEFT,
    spacing: opts.spacing || { before: 0, after: 0 },
    children: [
      new TextRun({
        text: String(text ?? ""),
        bold: opts.bold || false,
        size: opts.size || 20,
        color: opts.color || "000000",
        font: opts.font || "Arial",
      }),
    ],
    tabStops: opts.tabStops || undefined,
    border: opts.border || undefined,
  });
}

function run(text, opts = {}) {
  return new TextRun({
    text: String(text ?? ""),
    bold: opts.bold || false,
    size: opts.size || 20,
    color: opts.color || "000000",
    font: opts.font || "Arial",
    break: opts.break || undefined,
  });
}

function emptyPara(spacing = 100) {
  return new Paragraph({
    spacing: { before: spacing, after: 0 },
    children: [],
  });
}

// Browser-safe base64 → bytes (was Buffer.from(b64, 'base64') in Node)
function base64ToBytes(dataUrl) {
  if (!dataUrl || !dataUrl.includes(",")) return null;
  const b64 = dataUrl.split(",")[1];
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function logoImageRun(logoDataUrl, w = 80, h = 80) {
  if (!logoDataUrl) return null;
  const bytes = base64ToBytes(logoDataUrl);
  if (!bytes) return null;
  const ext = logoDataUrl.includes("image/png")
    ? "png"
    : logoDataUrl.includes("image/gif")
      ? "gif"
      : "jpg";
  try {
    return new ImageRun({
      type: ext,
      data: bytes,
      transformation: { width: w, height: h },
      altText: { title: "Logo", description: "Logo", name: "Logo" },
    });
  } catch {
    return null;
  }
}

function formatNum(n, decimals = 2) {
  const num = parseFloat(n) || 0;
  return num.toLocaleString("fr-DZ", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("fr-DZ");
}

// ─── Document Header Block ───────────────────────────────────
function buildHeaderRows(
  settings,
  title,
  subtitle,
  showFiscal = false,
  cw = CW_A4,
  isA5 = false,
) {
  const primaryColor = (settings.couleur || "#0f2044").replace("#", "");
  const orgName = settings.organisation || "";
  const ownerName = settings.proprietaire || "";
  const address = settings.adresse || "";
  const phones = (settings.telephones || []).join(" / ");
  const email = settings.email || "";
  const rc = settings.rc || "";
  const nif = settings.nif || "";
  const nis = settings.nis || "";
  const artImp = settings.artImp || "";

  const logoSize = isA5 ? 70 : 90;
  const logoImg = logoImageRun(settings.logo, logoSize, logoSize);
  const logoW = isA5 ? 1400 : 1800;

  const logoCell = cell(
    logoImg
      ? [
          new Paragraph({
            children: [logoImg],
            spacing: { before: 0, after: 0 },
          }),
        ]
      : [para(" ")],
    { width: logoW, borders: noBorder() },
  );

  const orgLines = [
    para(orgName, { bold: true, size: sc(28, isA5), color: primaryColor }),
  ];
  if (ownerName)
    orgLines.push(para(ownerName, { size: sc(20, isA5), color: "444444" }));
  if (address)
    orgLines.push(para(address, { size: sc(18, isA5), color: "555555" }));
  if (phones)
    orgLines.push(
      para(`Tél: ${phones}`, { size: sc(18, isA5), color: "555555" }),
    );
  if (email)
    orgLines.push(
      para(`Email: ${email}`, { size: sc(18, isA5), color: "555555" }),
    );

  const fiscalParts = [];
  if (rc) fiscalParts.push(`RC N°: ${rc}`);
  if (artImp) fiscalParts.push(`Art.Imp: ${artImp}`);
  if (nif) fiscalParts.push(`NIF: ${nif}`);
  if (nis) fiscalParts.push(`NIS: ${nis}`);
  if (showFiscal && fiscalParts.length > 0) {
    orgLines.push(emptyPara(40));
    orgLines.push(
      para(fiscalParts.join("   |   "), {
        size: sc(16, isA5),
        color: "666666",
      }),
    );
  }

  const infoCell = cell(orgLines, { borders: noBorder(), width: cw - logoW });

  const headerTable = new Table({
    width: { size: cw, type: WidthType.DXA },
    columnWidths: [logoW, cw - logoW],
    rows: [new TableRow({ children: [logoCell, infoCell] })],
    borders: noTableBorder(),
  });

  const divider = new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 3, color: primaryColor },
    },
    spacing: { before: isA5 ? 80 : 120, after: isA5 ? 100 : 160 },
    children: [],
  });

  const titlePara = para(title, {
    bold: true,
    size: sc(32, isA5),
    color: primaryColor,
    align: AlignmentType.CENTER,
    spacing: { before: 0, after: isA5 ? 60 : 80 },
  });

  const result = [headerTable, divider, titlePara];
  if (subtitle) {
    result.push(
      para(subtitle, {
        size: sc(20, isA5),
        align: AlignmentType.CENTER,
        spacing: { before: 0, after: isA5 ? 120 : 160 },
        color: "666666",
      }),
    );
  }
  result.push(emptyPara(isA5 ? 60 : 80));
  return result;
}

// ─── Client Info Block ───────────────────────────────────────
function buildClientBlock(
  client,
  showFiscal = false,
  cw = CW_A4,
  isA5 = false,
) {
  const primaryColor = "0f2044";
  const rows = [];

  rows.push(
    para("INFORMATIONS CLIENT", {
      bold: true,
      size: sc(20, isA5),
      color: primaryColor,
    }),
  );
  rows.push(emptyPara(40));

  const labelW = isA5 ? 2000 : 2400;
  const valueW = cw - labelW;

  function infoRow(label, value) {
    if (!value) return null;
    return new Table({
      width: { size: cw, type: WidthType.DXA },
      columnWidths: [labelW, valueW],
      borders: noTableBorder(),
      rows: [
        new TableRow({
          children: [
            cell(
              [
                para(label, {
                  bold: true,
                  size: sc(18, isA5),
                  color: "444444",
                }),
              ],
              {
                width: labelW,
                borders: noBorder(),
                margins: { top: 40, bottom: 40, left: 60, right: 40 },
              },
            ),
            cell([para(value, { size: sc(18, isA5) })], {
              width: valueW,
              borders: noBorder(),
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
            }),
          ],
        }),
      ],
    });
  }

  const phones = (client.telephones || []).filter(Boolean);
  if (!phones.length && client.telephone) phones.push(client.telephone);
  const phoneStr = phones.join(" / ");

  const items = [
    infoRow("Nom :", client.nom),
    infoRow("Adresse :", client.adresse),
    infoRow("Téléphone :", phoneStr || null),
  ];
  if (showFiscal) {
    if (client.agrement) items.push(infoRow("Agrément :", client.agrement));
    if (client.nif)
      items.push(infoRow("N° d'identification fiscale :", client.nif));
    if (client.articlesImp)
      items.push(infoRow("N° d'articles :", client.articlesImp));
    if (client.nis) items.push(infoRow("NIS :", client.nis));
  }

  items.forEach((r) => {
    if (r) rows.push(r);
  });
  rows.push(emptyPara(isA5 ? 60 : 80));
  return rows;
}

// ─── Items Table ─────────────────────────────────────────────
function buildItemsTable(
  articles,
  primaryColor = "0f2044",
  showNum = true,
  cw = CW_A4,
  isA5 = false,
) {
  const numW = showNum ? Math.round(cw * 0.06) : 0;
  const qtyW = Math.round(cw * 0.1);
  const puW = Math.round(cw * 0.16);
  const montW = Math.round(cw * 0.17);
  const desigW = cw - numW - qtyW - puW - montW;

  const cols = showNum
    ? [numW, desigW, qtyW, puW, montW]
    : [desigW, qtyW, puW, montW];

  const headerShading = { fill: primaryColor, type: ShadingType.CLEAR };
  const altShading = { fill: "EFF3FA", type: ShadingType.CLEAR };
  const hSz = sc(18, isA5);
  const dSz = sc(18, isA5);

  function hCell(text, w, align = AlignmentType.CENTER) {
    return cell(
      [para(text, { bold: true, size: hSz, color: "FFFFFF", align })],
      {
        width: w,
        shading: headerShading,
        borders: thinBorder(primaryColor),
        margins: {
          top: isA5 ? 60 : 100,
          bottom: isA5 ? 60 : 100,
          left: 60,
          right: 60,
        },
      },
    );
  }

  const headerRow = new TableRow({
    children: showNum
      ? [
          hCell("N°", numW, AlignmentType.CENTER),
          hCell("Désignation", desigW, AlignmentType.LEFT),
          hCell("Quantité", qtyW, AlignmentType.CENTER),
          hCell("Prix Unitaire", puW, AlignmentType.RIGHT),
          hCell("Montant (DA)", montW, AlignmentType.RIGHT),
        ]
      : [
          hCell("Désignation", desigW, AlignmentType.LEFT),
          hCell("Quantité", qtyW, AlignmentType.CENTER),
          hCell("Prix Unitaire", puW, AlignmentType.RIGHT),
          hCell("Montant (DA)", montW, AlignmentType.RIGHT),
        ],
    tableHeader: true,
  });

  const dataRows = (articles || []).map((art, idx) => {
    const isAlt = idx % 2 === 1;
    const shade = isAlt ? altShading : undefined;
    const brd = thinBorder("CCCCCC");
    const cOpts = {
      borders: brd,
      shading: shade,
      margins: {
        top: isA5 ? 50 : 80,
        bottom: isA5 ? 50 : 80,
        left: 60,
        right: 60,
      },
    };

    const qty = parseFloat(art.quantite) || 0;
    const pu = parseFloat(art.prixUnitaire) || 0;
    const montant = parseFloat(art.montant) || qty * pu;

    const cells = [];
    if (showNum)
      cells.push(
        cell(
          [para(String(idx + 1), { align: AlignmentType.CENTER, size: dSz })],
          { ...cOpts, width: numW },
        ),
      );
    cells.push(
      cell([para(art.designation || "", { size: dSz })], {
        ...cOpts,
        width: desigW,
      }),
    );
    cells.push(
      cell(
        [para(formatNum(qty, 0), { align: AlignmentType.CENTER, size: dSz })],
        { ...cOpts, width: qtyW },
      ),
    );
    cells.push(
      cell([para(formatNum(pu), { align: AlignmentType.RIGHT, size: dSz })], {
        ...cOpts,
        width: puW,
      }),
    );
    cells.push(
      cell(
        [para(formatNum(montant), { align: AlignmentType.RIGHT, size: dSz })],
        { ...cOpts, width: montW },
      ),
    );

    return new TableRow({ children: cells });
  });

  return new Table({
    width: { size: cw, type: WidthType.DXA },
    columnWidths: cols,
    rows: [headerRow, ...dataRows],
  });
}

// ─── Totals Block ─────────────────────────────────────────────
function buildTotals(
  totaux,
  primaryColor = "0f2044",
  cw = CW_A4,
  isA5 = false,
) {
  const rightW = isA5 ? 2200 : 2800;
  const labelW = isA5 ? 2200 : 2800;
  const spacerW = cw - labelW - rightW;
  const tSz = sc(19, isA5);

  function totalRow(label, value, isHighlight = false) {
    const bold = isHighlight;
    const color = isHighlight ? primaryColor : "333333";
    const shade = isHighlight
      ? { fill: "EFF3FA", type: ShadingType.CLEAR }
      : undefined;
    const brd = isHighlight ? thinBorder(primaryColor) : thinBorder("DDDDDD");
    const mg = {
      top: isA5 ? 60 : 80,
      bottom: isA5 ? 60 : 80,
      left: 100,
      right: 100,
    };

    return new TableRow({
      children: [
        cell([para("")], { width: spacerW, borders: noBorder() }),
        cell([para(label, { bold, size: tSz, color })], {
          width: labelW,
          borders: brd,
          shading: shade,
          margins: mg,
        }),
        cell(
          [para(value, { bold, size: tSz, color, align: AlignmentType.RIGHT })],
          { width: rightW, borders: brd, shading: shade, margins: mg },
        ),
      ],
    });
  }

  const rows = [];
  rows.push(totalRow("Total HT", `${fmtDinars(totaux.ht)} DA`));
  if (totaux.tvaEnabled && totaux.tva > 0)
    rows.push(
      totalRow(`TVA (${totaux.tvaTaux}%)`, `${fmtDinars(totaux.tva)} DA`),
    );
  if (totaux.timbreEnabled && totaux.timbre > 0)
    rows.push(totalRow("Droit de Timbre", `${fmtDinars(totaux.timbre)} DA`));
  rows.push(totalRow("TOTAL TTC", `${fmtDinars(totaux.ttc)} DA`, true));

  return new Table({
    width: { size: cw, type: WidthType.DXA },
    columnWidths: [spacerW, labelW, rightW],
    rows,
    borders: noTableBorder(),
  });
}

// ─── Main Generator (browser) ────────────────────────────────
async function generateDocxArrayBuffer(type, data) {
  const { settings = {}, ...docData } = data;
  const primaryColor = (settings.couleur || "#0f2044").replace("#", "");
  const pageSize = data.pageSize || "A4";
  const dims = getPageDims(pageSize);

  let children = [];

  if (type === "facture-proforma") {
    children = buildFactureProforma(docData, settings, primaryColor, dims);
  } else if (type === "bon-livraison") {
    children = buildBonLivraison(docData, settings, primaryColor, dims);
  } else if (type === "bon-versement") {
    children = buildBonVersement(docData, settings, primaryColor, dims);
  } else if (type === "programme-livraison") {
    children = buildProgrammeLivraison(docData, settings, primaryColor, dims);
  } else {
    throw new Error("Unknown document type: " + type);
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: settings.fontDoc || "Arial",
            size: dims.isA5 ? 17 : 20,
            color: "111111",
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: dims.w, height: dims.h },
            margin: {
              top: dims.margin,
              right: dims.margin,
              bottom: dims.margin,
              left: dims.margin,
            },
          },
        },
        children,
      },
    ],
  });

  // Browser builds of the `docx` lib cannot use JSZip `type: "nodebuffer"`
  // (that throws "nodebuffer is not supported by this platform"), so we
  // serialize to a base64 string instead and decode it to bytes.
  const b64 = await Packer.toBase64String(doc);
  const bytes = base64ToBytes(`data:application/octet-stream;base64,${b64}`);
  if (!bytes) throw new Error("DOCX serialization failed");
  return bytes;
}

// ─────────────────────────────────────────────────────────────
// FACTURE PROFORMA
// ─────────────────────────────────────────────────────────────
function buildFactureProforma(data, settings, primaryColor, dims) {
  const { contentW: cw, isA5 } = dims;
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
  } = data;
  const subtitle = `N° ${numero || "____"}   |   Date: ${fmtDate(date)}`;

  const children = [
    ...buildHeaderRows(settings, docTitle, subtitle, true, cw, isA5),
    ...buildClientBlock(client, true, cw, isA5),
    para("DÉSIGNATION DES ARTICLES", {
      bold: true,
      size: sc(20, isA5),
      color: primaryColor,
    }),
    emptyPara(isA5 ? 60 : 80),
    buildItemsTable(articles, primaryColor, true, cw, isA5),
    emptyPara(isA5 ? 120 : 160),
    buildTotals(totaux, primaryColor, cw, isA5),
    emptyPara(isA5 ? 140 : 200),
  ];

  const ttcWords = numberToWordsFR((totaux.ttc || 0) / 100);
  if (showArrete) {
    children.push(
      new Paragraph({
        spacing: { before: isA5 ? 80 : 120, after: isA5 ? 80 : 120 },
        border: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        },
        children: [
          run(
            "Arrêté la présente facture à la somme en toutes taxes comprises de : ",
            { bold: true, size: sc(18, isA5) },
          ),
          run(ttcWords.toUpperCase(), {
            bold: true,
            size: sc(18, isA5),
            color: primaryColor,
          }),
        ],
      }),
    );
  }

  children.push(emptyPara(isA5 ? 240 : 400));

  if (showModeReglement) {
    const modeLabel = modeReglement === "cheque" ? "Chèque" : "Espèce";
    const modeW = isA5 ? 2200 : 2800;
    const spacer = cw - modeW;
    children.push(
      new Table({
        width: { size: cw, type: WidthType.DXA },
        columnWidths: [modeW, spacer],
        rows: [
          new TableRow({
            children: [
              cell(
                [
                  para("Mode de règlement", {
                    size: sc(17, isA5),
                    color: "666666",
                    align: AlignmentType.CENTER,
                  }),
                  para(modeLabel, {
                    bold: true,
                    size: sc(22, isA5),
                    color: primaryColor,
                    align: AlignmentType.CENTER,
                  }),
                ],
                {
                  width: modeW,
                  borders: thinBorder(primaryColor),
                  shading: { fill: "EFF3FA", type: ShadingType.CLEAR },
                  margins: { top: 100, bottom: 100, left: 120, right: 120 },
                },
              ),
              cell([para("")], { width: spacer, borders: noBorder() }),
            ],
          }),
        ],
        borders: noTableBorder(),
      }),
    );
    children.push(emptyPara(isA5 ? 140 : 200));
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 60 },
      children: [run("En votre aimable règlement,", { size: sc(18, isA5) })],
    }),
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 60 },
      children: [run("Cordialement,", { size: sc(18, isA5) })],
    }),
  );
  if (settings.proprietaire) {
    children.push(emptyPara(isA5 ? 100 : 160));
    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 0 },
        children: [
          run(settings.proprietaire, { bold: true, size: sc(20, isA5) }),
        ],
      }),
    );
  }

  return children;
}

// ─────────────────────────────────────────────────────────────
// BON DE LIVRAISON
// ─────────────────────────────────────────────────────────────
function buildBonLivraison(data, settings, primaryColor, dims) {
  const { contentW: cw, isA5 } = dims;
  const { client = {}, articles = [], total = 0, date, numero } = data;
  const subtitle = `N° ${numero || "____"}   |   Date: ${fmtDate(date)}`;

  const totW = isA5 ? 1800 : 2400;
  const valW = isA5 ? 2400 : 3000;
  const spacer = cw - totW - valW;
  const sz = sc(20, isA5);

  const totalTable = new Table({
    width: { size: cw, type: WidthType.DXA },
    columnWidths: [spacer, totW, valW],
    rows: [
      new TableRow({
        children: [
          cell([para("")], { width: spacer, borders: noBorder() }),
          cell([para("TOTAL", { bold: true, size: sz, color: primaryColor })], {
            width: totW,
            shading: { fill: primaryColor, type: ShadingType.CLEAR },
            borders: thinBorder(primaryColor),
            margins: {
              top: isA5 ? 80 : 100,
              bottom: isA5 ? 80 : 100,
              left: 100,
              right: 80,
            },
          }),
          cell(
            [
              para(`${fmtDinars(total)} DA`, {
                bold: true,
                size: sz,
                color: primaryColor,
                align: AlignmentType.RIGHT,
              }),
            ],
            {
              width: valW,
              borders: thinBorder(primaryColor),
              margins: {
                top: isA5 ? 80 : 100,
                bottom: isA5 ? 80 : 100,
                left: 80,
                right: 100,
              },
            },
          ),
        ],
      }),
    ],
    borders: noTableBorder(),
  });

  return [
    ...buildHeaderRows(settings, "BON DE LIVRAISON", subtitle, false, cw, isA5),
    ...buildClientBlock(client, false, cw, isA5),
    para("ARTICLES LIVRÉS", { bold: true, size: sz, color: primaryColor }),
    emptyPara(isA5 ? 60 : 80),
    buildItemsTable(articles, primaryColor, true, cw, isA5),
    emptyPara(isA5 ? 100 : 160),
    totalTable,
  ];
}

// ─────────────────────────────────────────────────────────────
// BON DE VERSEMENT
// ─────────────────────────────────────────────────────────────
function buildBonVersement(data, settings, primaryColor, dims) {
  const { contentW: cw, isA5 } = dims;
  const {
    client = {},
    articles = [],
    total = 0,
    montantVerse = 0,
    notes = "",
    date,
    numero,
  } = data;
  const subtitle = `N° ${numero || "____"}   |   Date: ${fmtDate(date)}`;

  const totW = isA5 ? 1800 : 2400;
  const valW = isA5 ? 2400 : 3000;
  const spacer = cw - totW - valW;
  const sz = sc(20, isA5);
  const szSm = sc(18, isA5);

  const verseTable = new Table({
    width: { size: cw, type: WidthType.DXA },
    columnWidths: [spacer, totW, valW],
    rows: [
      new TableRow({
        children: [
          cell([para("")], { width: spacer, borders: noBorder() }),
          cell([para("TOTAL FACTURE", { bold: true, size: szSm })], {
            width: totW,
            borders: thinBorder("CCCCCC"),
            margins: { top: 70, bottom: 70, left: 100, right: 80 },
          }),
          cell(
            [
              para(`${fmtDinars(total)} DA`, {
                size: szSm,
                align: AlignmentType.RIGHT,
              }),
            ],
            {
              width: valW,
              borders: thinBorder("CCCCCC"),
              margins: { top: 70, bottom: 70, left: 80, right: 100 },
            },
          ),
        ],
      }),
      new TableRow({
        children: [
          cell([para("")], { width: spacer, borders: noBorder() }),
          cell(
            [
              para("MONTANT VERSÉ", {
                bold: true,
                size: sz,
                color: primaryColor,
              }),
            ],
            {
              width: totW,
              shading: { fill: primaryColor, type: ShadingType.CLEAR },
              borders: thinBorder(primaryColor),
              margins: {
                top: isA5 ? 80 : 100,
                bottom: isA5 ? 80 : 100,
                left: 100,
                right: 80,
              },
            },
          ),
          cell(
            [
              para(`${fmtDinars(montantVerse)} DA`, {
                bold: true,
                size: sz,
                color: primaryColor,
                align: AlignmentType.RIGHT,
              }),
            ],
            {
              width: valW,
              borders: thinBorder(primaryColor),
              margins: {
                top: isA5 ? 80 : 100,
                bottom: isA5 ? 80 : 100,
                left: 80,
                right: 100,
              },
            },
          ),
        ],
      }),
    ],
    borders: noTableBorder(),
  });

  const children = [
    ...buildHeaderRows(settings, "BON DE VERSEMENT", subtitle, false, cw, isA5),
    ...buildClientBlock(client, false, cw, isA5),
    para("ARTICLES", { bold: true, size: sz, color: primaryColor }),
    emptyPara(isA5 ? 60 : 80),
    buildItemsTable(articles, primaryColor, true, cw, isA5),
    emptyPara(isA5 ? 100 : 160),
    verseTable,
  ];

  if (notes) {
    children.push(emptyPara(isA5 ? 100 : 160));
    children.push(para("Notes :", { bold: true, size: szSm, color: "555555" }));
    children.push(
      para(notes, {
        size: szSm,
        color: "333333",
        spacing: { before: 40, after: 40 },
      }),
    );
  }

  return children;
}

// ─────────────────────────────────────────────────────────────
// PROGRAMME DE LIVRAISON
// ─────────────────────────────────────────────────────────────
function buildProgrammeLivraison(data, settings, primaryColor, dims) {
  const { contentW: cw = CW_A4, isA5 = false } = dims || {};
  const { date, clients = [] } = data;

  const children = [
    ...buildHeaderRows(settings, "PROGRAMME DE LIVRAISON", "", false, cw, isA5),
  ];

  if (date) {
    children.push(
      para(`Date de livraison : ${fmtDate(date)}`, {
        bold: true,
        size: sc(20, isA5),
      }),
    );
    children.push(emptyPara(isA5 ? 100 : 160));
  }

  clients.forEach((cl, idx) => {
    if (idx > 0) {
      children.push(
        new Paragraph({
          children: [new PageBreak()],
          spacing: { before: 0, after: 0 },
        }),
      );
      children.push(
        ...buildHeaderRows(
          settings,
          "PROGRAMME DE LIVRAISON",
          "",
          false,
          cw,
          isA5,
        ),
      );
      children.push(emptyPara(isA5 ? 60 : 80));
    }

    const horaireStr =
      cl.horaireDE || cl.horaireA
        ? `${cl.horaireDE || "?"} — ${cl.horaireA || "?"}`
        : null;

    const horW = isA5 ? 2200 : 2800;
    const nameW = horaireStr ? cw - horW : cw;

    const infoLine = [
      cl.telephone ? `Tél: ${cl.telephone}` : "",
      cl.adresse ? cl.adresse : "",
    ]
      .filter(Boolean)
      .join("   |   ");

    const nameCells = [
      cell(
        [
          para(`${idx + 1}. ${cl.nom || "Client"}`, {
            bold: true,
            size: sc(22, isA5),
            color: primaryColor,
          }),
          ...(infoLine
            ? [para(infoLine, { size: sc(17, isA5), color: "555555" })]
            : []),
        ],
        { width: nameW, borders: noBorder() },
      ),
    ];

    if (horaireStr) {
      nameCells.push(
        cell(
          [
            para("Horaire", {
              size: sc(16, isA5),
              color: "666666",
              align: AlignmentType.CENTER,
            }),
            para(horaireStr, {
              bold: true,
              size: sc(20, isA5),
              color: primaryColor,
              align: AlignmentType.CENTER,
            }),
          ],
          {
            width: horW,
            borders: thinBorder(primaryColor),
            shading: { fill: "EFF3FA", type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            vAlign: VerticalAlign.CENTER,
          },
        ),
      );
    }

    children.push(
      new Table({
        width: { size: cw, type: WidthType.DXA },
        columnWidths: horaireStr ? [nameW, horW] : [nameW],
        rows: [new TableRow({ children: nameCells })],
        borders: noTableBorder(),
      }),
    );

    children.push(emptyPara(isA5 ? 80 : 100));
    children.push(
      buildItemsTable(cl.articles || [], primaryColor, true, cw, isA5),
    );

    const clientTotal = (cl.articles || []).reduce((s, a) => {
      const qty = parseFloat(a.quantite) || 0;
      const pu = parseFloat(a.prixUnitaire) || 0;
      return s + (parseFloat(a.montant) || qty * pu);
    }, 0);

    children.push(emptyPara(isA5 ? 60 : 80));
    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 0 },
        children: [
          run(`Total client : ${formatNum(clientTotal)} DA`, {
            bold: true,
            size: sc(20, isA5),
            color: primaryColor,
          }),
        ],
      }),
    );
    children.push(emptyPara(isA5 ? 140 : 200));
  });

  return children;
}

export { generateDocxArrayBuffer };
