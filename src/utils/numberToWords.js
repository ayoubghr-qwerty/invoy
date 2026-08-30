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

const AR_ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة',
  'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر',
  'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const AR_TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];

function arBelow100(n) {
  if (n < 20) return AR_ONES[n] || '';
  const t = Math.floor(n / 10);
  const o = n % 10;
  if (o === 0) return AR_TENS[t];
  return AR_ONES[o] + ' و' + AR_TENS[t];
}

function arBelow1000(n) {
  if (n === 0) return '';
  if (n < 100) return arBelow100(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  let s = h === 1 ? 'مائة' : h === 2 ? 'مئتان' : AR_ONES[h].replace(/ة$/, 'مئة');
  if (h >= 3 && h <= 10) s = AR_ONES[h] + ' مائة';
  else if (h > 10) s = arBelow100(h) + ' مائة';
  if (r > 0) s += ' و' + arBelow100(r);
  return s;
}

function arConvertInt(n) {
  if (n === 0) return 'صفر';
  let result = '';
  if (n >= 1000000) {
    const m = Math.floor(n / 1000000);
    result += (m === 1 ? 'مليون' : m === 2 ? 'مليان' : arBelow1000(m) + ' ملايين');
    n %= 1000000;
    if (n > 0) result += ' و';
  }
  if (n >= 1000) {
    const t = Math.floor(n / 1000);
    result += t === 1 ? 'ألف' : t === 2 ? 'ألفان' : arBelow100(t) + ' آلاف';
    n %= 1000;
    if (n > 0) result += ' و';
  }
  if (n > 0) result += arBelow1000(n);
  return result.trim();
}

export function numberToWordsAR(amount) {
  if (!amount && amount !== 0) return '';
  const num = Math.abs(parseFloat(amount) || 0);
  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);

  let result = arConvertInt(intPart) + ' دينار';
  if (decPart > 0) {
    result += ' و' + arConvertInt(decPart) + ' سنتيم';
  }
  return result;
}
