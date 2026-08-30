import { describe, it, expect } from 'vitest';
import {
  buildFacturePdf,
  buildBonLivraisonPdf,
  buildBonVersementPdf,
  buildProgrammePdf,
  buildMarchandisePdf,
} from '../utils/pdfTemplate';

const mockSettings = {
  couleur: '#0f2044',
  fontDoc: 'Arial',
  langue: 'fr',
  organisation: 'Test Org',
  proprietaire: 'Test Owner',
  adresse: '123 Test St',
  telephones: ['0555123456'],
  email: 'test@test.com',
  rc: '12345',
  nif: '67890',
  nis: '11111',
};

const mockClient = {
  nom: 'Client Test',
  adresse: '456 Client St',
  telephone: '0555987654',
  nif: '99999',
};

const mockArticles = [
  { designation: 'Article 1', quantite: 10, prixUnitaire: 100, montant: 1000 },
  { designation: 'Article 2', quantite: 5, prixUnitaire: 200, montant: 1000 },
];

describe('PDF template builders', () => {
  it('buildFacturePdf returns valid HTML', () => {
    const html = buildFacturePdf(
      {
        client: mockClient,
        articles: mockArticles,
        totaux: { ht: 2000, tva: 400, tvaTaux: 20, timbre: 20, ttc: 2420, tvaEnabled: true, timbreEnabled: true },
        date: '2026-01-15',
        numero: '0001',
      },
      mockSettings
    );
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('lang="fr"');
    expect(html).toContain('Test Org');
    expect(html).toContain('Client Test');
    expect(html).toContain('Article 1');
    expect(html).toContain('Total TTC');
  });

  it('buildFacturePdf escapes XSS in client name', () => {
    const html = buildFacturePdf(
      {
        client: { ...mockClient, nom: '<script>alert(1)</script>' },
        articles: [],
        totaux: { ht: 0, ttc: 0 },
        date: '2026-01-15',
        numero: '0001',
      },
      mockSettings
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('buildBonLivraisonPdf shows fiscal IDs', () => {
    const html = buildBonLivraisonPdf(
      { client: mockClient, articles: mockArticles, total: 2000, date: '2026-01-15', numero: '0001' },
      mockSettings
    );
    expect(html).toContain('RC N°: 12345');
    expect(html).toContain('NIF: 67890');
  });

  it('buildBonVersementPdf includes notes', () => {
    const html = buildBonVersementPdf(
      { client: mockClient, articles: mockArticles, total: 2000, montantVerse: 1500, notes: 'Test note', date: '2026-01-15', numero: '0001' },
      mockSettings
    );
    expect(html).toContain('Test note');
  });

  it('buildProgrammePdf renders clients', () => {
    const html = buildProgrammePdf(
      { date: '2026-01-15', clients: [{ ...mockClient, articles: mockArticles }] },
      mockSettings
    );
    expect(html).toContain('Client Test');
    expect(html).toContain('Article 1');
  });

  it('buildMarchandisePdf renders products', () => {
    const html = buildMarchandisePdf(
      { date: '2026-01-15', numero: '0001', produits: [{ designation: 'Product 1', quantite: 10, description: 'Desc', lieuAchat: 'Store' }] },
      mockSettings
    );
    expect(html).toContain('Product 1');
    expect(html).toContain('Store');
  });

  it('PDF uses Arabic when language is ar', () => {
    const arSettings = { ...mockSettings, langue: 'ar' };
    const html = buildFacturePdf(
      {
        client: mockClient,
        articles: mockArticles,
        totaux: { ht: 2000, ttc: 2420 },
        date: '2026-01-15',
        numero: '0001',
      },
      arSettings
    );
    expect(html).toContain('lang="ar"');
    expect(html).toContain('المجموع');
  });

  it('PDF escapes XSS in notes', () => {
    const html = buildBonVersementPdf(
      { client: mockClient, articles: [], total: 0, montantVerse: 0, notes: '<img src=x onerror=alert(1)>', date: '2026-01-15', numero: '0001' },
      mockSettings
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});
