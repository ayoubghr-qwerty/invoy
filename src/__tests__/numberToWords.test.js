import { describe, it, expect } from 'vitest';
import { numberToWordsFR, numberToWordsAR } from '../utils/numberToWords';

describe('numberToWordsFR', () => {
  it('handles zero', () => {
    expect(numberToWordsFR(0)).toContain('zéro');
  });

  it('handles simple amounts', () => {
    const result = numberToWordsFR(1);
    expect(result).toContain('un');
    expect(result).toContain('dinar');
  });

  it('handles decimals', () => {
    const result = numberToWordsFR(1.50);
    expect(result).toContain('dinar');
    expect(result).toContain('centime');
  });

  it('handles large numbers', () => {
    const result = numberToWordsFR(1000000);
    expect(result).toContain('million');
  });

  it('handles negative amounts', () => {
    const result = numberToWordsFR(-5);
    expect(result).toContain('cinq');
  });

  it('handles string input', () => {
    const result = numberToWordsFR('42');
    expect(result).toContain('quarante-deux');
  });
});

describe('numberToWordsAR', () => {
  it('handles zero', () => {
    expect(numberToWordsAR(0)).toContain('صفر');
  });

  it('handles simple amounts', () => {
    const result = numberToWordsAR(1);
    expect(result).toContain('واحد');
    expect(result).toContain('دينار');
  });

  it('handles decimals', () => {
    const result = numberToWordsAR(1.50);
    expect(result).toContain('دينار');
    expect(result).toContain('سنتيم');
  });

  it('handles large numbers', () => {
    const result = numberToWordsAR(1000000);
    expect(result).toContain('مليون');
  });
});
