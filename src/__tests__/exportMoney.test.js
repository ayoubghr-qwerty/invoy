import { describe, it, expect } from "vitest";
import { buildFacturePdf } from "../utils/pdfTemplate";
import { fromCents } from "../utils/money";

// Phase 1 regression: cents/dinars display contract on exports.
// Convention: totaux/total/montantVerse = CENTS; article row fields = dinars.

describe("Phase 1: export money display contract", () => {
  const settings = {
    couleur: "#0f2044",
    fontDoc: "Arial",
    langue: "fr",
    nomSociete: "Test SARL",
  };

  it("renders totals via fromCents (cents → dinars, not 100x)", () => {
    const html = buildFacturePdf(
      {
        client: { nom: "Client Test" },
        articles: [
          {
            designation: "Article A",
            quantite: 2,
            prixUnitaire: "1500.50",
            montant: "3001.00",
          },
        ],
        totaux: {
          ht: 300100,
          tva: 57019,
          tvaEnabled: true,
          tvaTaux: 19,
          timbre: 0,
          timbreEnabled: true,
          ttc: 357119,
        },
        numero: "0001",
        date: "2026-09-02",
        modeReglement: "espece",
        pageSize: "A4",
      },
      settings,
    );
    // 300100 cents must render as 3 001,00 (not 300 100,00)
    expect(html).toContain(fromCents(300100));
    expect(html).toContain(fromCents(357119));
    expect(html).not.toContain("300 100");
  });

  it("numberToWords receives dinars (ttc/100) — legal Arrêté text", () => {
    const html = buildFacturePdf(
      {
        client: { nom: "Client Test" },
        articles: [
          {
            designation: "Article A",
            quantite: 1,
            prixUnitaire: "1500.50",
            montant: "1500.50",
          },
        ],
        // ttc = 150 050 cents = 1 500,50 DA
        totaux: {
          ht: 150050,
          tva: 0,
          tvaEnabled: false,
          tvaTaux: 19,
          timbre: 0,
          timbreEnabled: false,
          ttc: 150050,
        },
        numero: "0002",
        date: "2026-09-02",
        showArrete: true,
        modeReglement: "espece",
      },
      settings,
    );
    // 1500.50 in words — "mille cinq cents" appears when dinars passed.
    // If cents were passed raw (150050), output would say "cent cinquante mille".
    expect(html.toLowerCase()).toContain("mille cinq cents");
    expect(html.toLowerCase()).not.toContain("cent cinquante mille");
  });

  it("FactureProforma pageSize=A5 propagates to @page size", () => {
    const html = buildFacturePdf(
      {
        client: { nom: "Client Test" },
        articles: [],
        totaux: { ht: 0, ttc: 0 },
        numero: "0003",
        date: "2026-09-02",
        pageSize: "A5",
      },
      settings,
    );
    expect(html).toContain("@page { size: A5");
  });
});
