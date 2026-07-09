"use client";

import Papa from "papaparse";
import type { CsvRow } from "@/types/crm";

export type CsvParseResult =
  | { ok: true; rows: CsvRow[]; fields: string[] }
  | { ok: false; error: string };

export function parseCsvFile(file: File): Promise<CsvParseResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      dynamicTyping: false,
      complete: (result) => {
        if (result.errors.length > 0) {
          resolve({
            ok: false,
            error: result.errors[0]?.message ?? "CSV parsing failed.",
          });
          return;
        }

        const rows = result.data.map((row) => normalizeRow(row));
        const fields = result.meta.fields ?? collectFields(rows);
        resolve({ ok: true, rows, fields });
      },
      error: (error) => {
        resolve({ ok: false, error: error.message });
      },
    });
  });
}

export function collectFields(rows: CsvRow[]): string[] {
  return [...new Set(rows.flatMap((row) => Object.keys(row)))];
}

function normalizeRow(row: Record<string, unknown>): CsvRow {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.trim(), value ?? ""]),
  );
}
