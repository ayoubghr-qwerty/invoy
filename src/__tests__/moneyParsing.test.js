import { describe, it, expect } from "vitest";
import { toCents, fromCents } from "../utils/money";
import { buildFacturePdf } from "../utils/pdfTemplate";

describe("Phase 3: toCents locale parsing (H6)", () => {
  it("parses French decimal comma", () => {
    expect(toCents("2,5")).toBe(250);
    expect(toCents("1500,50")).toBe(150050);
  });

  it("parses space thousand separators", () => {
    expect(toCents("1 500,50")).toBe(150050);
  });

  it("parses European format 1.234,56", () => {
    expect(toCents("1.234,56")).toBe(123456);
  });

  it("parses US format 1,234.56", () => {
    expect(toCents("1,234.56")).toBe(123456);
  });

  it("numbers and dot decimals unchanged", () => {
    expect(toCents(2.5)).toBe(250);
    expect(toCents("12.5")).toBe(1250);
    expect(toCents(1500.5)).toBe(150050);
  });

  it("invalid input → 0 (no NaN)", () => {
    expect(toCents("abc")).toBe(0);
    expect(toCents(null)).toBe(0);
    expect(toCents("")).toBe(0);
    expect(toCents(undefined)).toBe(0);
  });

  it("negative values parse with comma", () => {
    expect(toCents("-2,5")).toBe(-250);
  });
});

describe("Phase 3: multi-word fonts in PDF (H7)", () => {
  const settings = {
    couleur: "#0f2044",
    fontDoc: "Times New Roman",
    langue: "fr",
  };

  it("quotes multi-word font-family in PDF CSS", () => {
    const html = buildFacturePdf(
      {
        client: { nom: "X" },
        articles: [],
        totaux: { ht: 0, ttc: 0 },
        numero: "0001",
        date: "2026-09-02",
      },
      settings,
    );
    expect(html).toContain('font-family: "Times New Roman", Arial, sans-serif');
  });

  it("CSS injection chars stripped from font name", () => {
    const html = buildFacturePdf(
      {
        client: { nom: "X" },
        articles: [],
        totaux: { ht: 0, ttc: 0 },
        numero: "0002",
        date: "2026-09-02",
      },
      { ...settings, fontDoc: 'Arial"; body { display: none } .x{' },
    );
    expect(html).not.toContain("display: none }");
    expect(html).not.toContain(".x{");
  });
});
