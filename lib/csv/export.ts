"use client";

import Papa from "papaparse";
import type { CrmRecord } from "@/types/crm";

const EXPORT_COLUMNS: Array<keyof CrmRecord> = [
  "full_name",
  "email",
  "mobile_without_country_code",
  "city",
  "crm_status",
  "data_source",
  "created_at",
  "crm_note",
  "project_name",
  "property_type",
  "budget",
  "lead_source_campaign",
  "country_code",
  "assigned_to",
];

export function buildCrmCsv(records: CrmRecord[]): string {
  const normalizedRows = records.map((record) =>
    Object.fromEntries(EXPORT_COLUMNS.map((column) => [column, record[column]])),
  );

  return Papa.unparse(normalizedRows, {
    columns: EXPORT_COLUMNS as string[],
    quotes: false,
    newline: "\n",
  });
}

export function downloadCsvFile(csv: string, fileName: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function makeExportFileName(sourceFileName: string): string {
  const base = sourceFileName.replace(/\.csv$/i, "").trim() || "crm-export";
  return `${base}-modified.csv`;
}
