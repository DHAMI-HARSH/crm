import type { CsvRow } from "@/types/crm";

export const MAX_CSV_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export type CsvValidationResult =
  | { valid: true }
  | { valid: false; error: string };

export function validateCsvFile(file: File | undefined | null): CsvValidationResult {
  if (!file || typeof file.name !== "string") {
    return { valid: false, error: "Choose a valid CSV file." };
  }

  const name = file.name.toLowerCase();
  const type = typeof file.type === "string" ? file.type : "";
  if (!name.endsWith(".csv") && type !== "text/csv") {
    return { valid: false, error: "Only .csv files are accepted." };
  }

  if (typeof file.size === "number" && file.size > MAX_CSV_FILE_SIZE_BYTES) {
    return { valid: false, error: "CSV file must be 10MB or smaller." };
  }

  return { valid: true };
}

export function hasDetectedRows(rows: CsvRow[]): CsvValidationResult {
  if (rows.length === 0) {
    return { valid: false, error: "No rows detected in this file." };
  }

  return { valid: true };
}
