/**
 * Serializacja CSV pod Excela.
 *
 * Dwie decyzje podyktowane docelowym użyciem (otwarcie dwuklikiem w Excelu
 * z polskimi ustawieniami), nie czystością standardu:
 *
 * 1. Separator `;` — polski Excel traktuje `,` jako separator dziesiętny
 *    i przy przecinku wrzuca cały wiersz do jednej kolumny.
 * 2. BOM UTF-8 na początku — bez niego Excel czyta plik jako ANSI
 *    i polskie znaki zamieniają się w krzaki.
 *
 * W pandas: `pd.read_csv(plik, sep=";")`.
 */

const SEPARATOR = ";";
const BOM = "﻿";

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  // Cytowanie wymagane, gdy w treści jest separator, cudzysłów albo złamanie linii
  // — a treść wiadomości czatu ma to wszystko regularnie.
  if (text.includes(SEPARATOR) || text.includes('"') || /[\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(escapeCell).join(SEPARATOR),
    ...rows.map((row) => row.map(escapeCell).join(SEPARATOR)),
  ];
  return BOM + lines.join("\r\n") + "\r\n";
}
