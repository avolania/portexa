export interface Currency {
  code: string;
  symbol: string;
  label: string;
  locale: string;
}

export const CURRENCIES: Currency[] = [
  { code: "TRY", symbol: "₺", label: "Türk Lirası",    locale: "tr-TR" },
  { code: "USD", symbol: "$", label: "Amerikan Doları", locale: "en-US" },
  { code: "EUR", symbol: "€", label: "Euro",            locale: "de-DE" },
  { code: "GBP", symbol: "£", label: "İngiliz Sterlini",locale: "en-GB" },
  { code: "CHF", symbol: "₣", label: "İsviçre Frangı", locale: "de-CH" },
  { code: "JPY", symbol: "¥", label: "Japon Yeni",      locale: "ja-JP" },
  { code: "AED", symbol: "د.إ", label: "BAE Dirhemi",   locale: "ar-AE" },
  { code: "SAR", symbol: "﷼", label: "Suudi Riyali",   locale: "ar-SA" },
];

export const DEFAULT_CURRENCY = "TRY";

export function getCurrency(code?: string): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

export function formatCurrency(amount: number, currencyCode?: string): string {
  const cur = getCurrency(currencyCode);
  return amount.toLocaleString(cur.locale, {
    style: "currency",
    currency: cur.code,
    maximumFractionDigits: cur.code === "JPY" ? 0 : 0,
  });
}

// ─── Exchange rate conversion ──────────────────────────────────────────────────

export interface ExchangeRates {
  EUR_TRY: number;
  USD_TRY: number;
  USD_EUR: number;
  updatedAt: string | null;
}

export const FALLBACK_RATES: ExchangeRates = {
  EUR_TRY: 38.5,
  USD_TRY: 35.5,
  USD_EUR: 0.923,
  updatedAt: null,
};

/** Tutarı bir para biriminden diğerine çevirir. EUR pivot olarak kullanılır. */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: ExchangeRates
): number {
  if (from === to || !isFinite(amount)) return amount;

  // 1. from → EUR
  let eur: number;
  if (from === "EUR") eur = amount;
  else if (from === "TRY") eur = amount / rates.EUR_TRY;
  else if (from === "USD") eur = amount * rates.USD_EUR;
  else return amount; // bilinmeyen para birimi → dönüştürme

  // 2. EUR → to
  if (to === "EUR") return eur;
  if (to === "TRY") return eur * rates.EUR_TRY;
  if (to === "USD") return eur / rates.USD_EUR;
  return amount;
}
