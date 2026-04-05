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
