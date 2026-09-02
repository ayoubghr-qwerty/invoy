import { describe, it, expect } from "vitest";
import { validateDoc } from "../utils/validation";

describe("validateDoc", () => {
  const validClient = { nom: "Client Test", adresse: "123 Rue" };
  const validArticles = [
    {
      designation: "Produit A",
      quantite: "10",
      prixUnitaire: "100",
      montant: "1000",
    },
  ];

  it("returns valid for correct data", () => {
    const result = validateDoc({
      client: validClient,
      articles: validArticles,
      lang: "fr",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when client nom is empty", () => {
    const result = validateDoc({
      client: { nom: "" },
      articles: validArticles,
      lang: "fr",
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("nom");
  });

  it("fails when no articles", () => {
    const result = validateDoc({
      client: validClient,
      articles: [],
      lang: "fr",
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("article");
  });

  it("fails when article has no designation", () => {
    const articles = [
      { designation: "", quantite: "1", prixUnitaire: "100", montant: "100" },
    ];
    const result = validateDoc({ client: validClient, articles, lang: "fr" });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("désignation");
  });

  it("fails when quantite is zero", () => {
    const articles = [
      { designation: "Test", quantite: "0", prixUnitaire: "100", montant: "0" },
    ];
    const result = validateDoc({ client: validClient, articles, lang: "fr" });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("quantité");
  });

  it("fails when pu is negative", () => {
    const articles = [
      {
        designation: "Test",
        quantite: "1",
        prixUnitaire: "-50",
        montant: "-50",
      },
    ];
    const result = validateDoc({ client: validClient, articles, lang: "fr" });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("prix");
  });

  it("works with Arabic language", () => {
    const result = validateDoc({
      client: { nom: "" },
      articles: validArticles,
      lang: "ar",
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/اسم/);
  });
});
