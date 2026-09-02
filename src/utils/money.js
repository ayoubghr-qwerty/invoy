export function toCents(value) {
  if (value == null || value === "") return 0;
  let n;
  if (typeof value === "string") {
    // Accept French/Algerian formats: "1 500,50", "2,5", "1.234,56" → dot decimal
    let s = value.trim().replace(/\s/g, "");
    if (s.includes(",") && !s.includes(".")) {
      s = s.replace(",", ".");
    } else if (
      s.includes(",") &&
      s.includes(".") &&
      s.lastIndexOf(",") > s.lastIndexOf(".")
    ) {
      // "1.234,56" → "1234.56"
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (s.includes(",") && s.includes(".")) {
      // "1,234.56" → remove thousand commas
      s = s.replace(/,/g, "");
    }
    n = Number(s);
  } else {
    n = Number(value);
  }
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromCents(cents, decimals = 2) {
  if (cents == null) return "0".padEnd(decimals + 2, "0");
  const n = cents / 100;
  return n.toLocaleString("fr-DZ", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function add(a, b) {
  return toCents(a) + toCents(b);
}

export function sub(a, b) {
  return toCents(a) - toCents(b);
}

export function mul(a, b) {
  return Math.round(toCents(a) * (b == null ? 0 : Number(b)));
}

export function div(a, b) {
  const divisor = b == null ? 1 : Number(b);
  return divisor === 0 ? 0 : Math.round(toCents(a) / divisor);
}

export function sumCents(values) {
  return (values || []).reduce((s, v) => s + toCents(v), 0);
}

export function calcTva(htCents, taux) {
  if (!htCents || !taux) return 0;
  return Math.round(htCents * (Number(taux) / 100));
}

export function calcTimbreCents(baseCents) {
  if (baseCents < 30000) return 0;
  const tranches = Math.ceil(baseCents / 10000);
  let t;
  if (baseCents < 3000000) t = tranches * 100;
  else if (baseCents < 10000000) t = tranches * 150;
  else t = tranches * 200;
  return Math.max(500, t);
}

export function isPositiveCents(value) {
  return toCents(value) > 0;
}

export function isZeroOrNegativeCents(value) {
  return toCents(value) <= 0;
}
