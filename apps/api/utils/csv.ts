import type { Response } from "express";

/**
 * Escape one CSV field (RFC 4180): quote it when it contains a quote, comma
 * or line break, doubling inner quotes. Fields that a spreadsheet would run
 * as a formula (=, +, -, @, tab, CR) are prefixed with a quote character.
 */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Build a CSV document (CRLF line endings) from a header row and data rows. */
export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}

/** Send `csv` as a downloadable file. */
export function sendCsv(res: Response, filename: string, csv: string) {
  res.status(200);
  res.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
    "Cache-Control": "no-store",
  });
  res.send(csv);
}
