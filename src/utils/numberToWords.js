const ONES = [
  '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

function below100(n) {
  if (n < 20) return ONES[n] || '';
  const t = Math.floor(n / 10);
  const o = n % 10;
  if (t <= 6) {
    if (o === 0) return TENS[t];
    if (o === 1) return TENS[t] + '-et-un';
    return TENS[t] + '-' + ONES[o];
  }
  if (t === 7) {
    if (o === 0) return 'soixante-dix';
    if (o === 1) return 'soixante-et-onze';
    return 'soixante-' + ONES[10 + o];
  }
  if (t === 8) {
    return o === 0 ? 'quatre-vingts' : 'quatre-vingt-' + ONES[o];
  }
  return 'quatre-vingt-' + ONES[10 + o];
}

function below1000(n) {
  if (n === 0) return '';
  if (n < 100) return below100(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  let s = h === 1 ? 'cent' : ONES[h] + ' cent';
  if (r === 0 && h > 1) s += 's';
  if (r > 0) s += ' ' + below100(r);
  return s;
}

function convertInt(n) {
  if (n === 0) return 'zéro';
  let result = '';

  if (n >= 1000000) {
    const m = Math.floor(n / 1000000);
    result += below1000(m) + ' million' + (m > 1 ? 's' : '');
    n %= 1000000;
    if (n > 0) result += ' ';
  }
  if (n >= 1000) {
    const t = Math.floor(n / 1000);
    result += t === 1 ? 'mille' : below1000(t) + ' mille';
    n %= 1000;
    if (n > 0) result += ' ';
  }
  if (n > 0) result += below1000(n);
  return result.trim();
}

export function numberToWordsFR(amount) {
  if (!amount && amount !== 0) return '';
  const num = Math.abs(parseFloat(amount) || 0);
  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);

  let result = convertInt(intPart) + ' dinar' + (intPart > 1 ? 's' : '');
  if (decPart > 0) {
    result += ' et ' + convertInt(decPart) + ' centime' + (decPart > 1 ? 's' : '');
  }
  return result;
}
