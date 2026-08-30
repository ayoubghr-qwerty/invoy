import { describe, it, expect } from 'vitest';
import { t, translations } from '../utils/i18n';

describe('t()', () => {
  it('returns French translation for a known key', () => {
    expect(t('fr', 'nav_facture')).toBe('Facturation');
  });

  it('returns Arabic translation for a known key', () => {
    expect(t('ar', 'nav_facture')).toBe('الفوترة');
  });

  it('returns the key itself if translation is missing', () => {
    expect(t('fr', 'nonexistent_key_xyz')).toBe('nonexistent_key_xyz');
  });

  it('falls back to French if lang is unknown', () => {
    expect(t('de', 'nav_facture')).toBe('Facturation');
  });

  it('returns the raw key string when key has no translation', () => {
    expect(t('fr', 'missing_key')).toBe('missing_key');
  });
});

describe('translations', () => {
  it('French and Arabic have the same keys', () => {
    const frKeys = Object.keys(translations.fr).sort();
    const arKeys = Object.keys(translations.ar).sort();
    expect(frKeys).toEqual(arKeys);
  });

  it('no French translation value is empty', () => {
    const emptyKeys = Object.entries(translations.fr)
      .filter(([, v]) => v === '' || v === undefined);
    expect(emptyKeys).toEqual([]);
  });

  it('no Arabic translation value is empty', () => {
    const emptyKeys = Object.entries(translations.ar)
      .filter(([, v]) => v === '' || v === undefined);
    expect(emptyKeys).toEqual([]);
  });

  it('contains expected section keys', () => {
    expect(translations.fr).toHaveProperty('total_ht');
    expect(translations.ar).toHaveProperty('total_ht');
    expect(translations.fr).toHaveProperty('btn_save');
    expect(translations.ar).toHaveProperty('btn_save');
  });
});
